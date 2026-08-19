import traceback

import pandas as pd

from fastapi import HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.business.models import Business
from app.store import models as store_models
from app.core.roles import SUPER_ADMIN


# ==========================================================
# HELPERS
# ==========================================================

def clean_string(value) -> int:
    """
    Convert Excel values into clean strings.

    Empty / NaN values become an empty string.
    """

    if value is None:
        return ""

    if pd.isna(value):
        return ""

    return str(value).strip()


def clean_price(value) -> float:
    """
    Convert Excel price to float.

    Empty / invalid values become 0.0.

    IMPORTANT:
    Prices are never stored as None.
    """

    if value is None:
        return 0.0

    if pd.isna(value):
        return 0.0

    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def clean_quantity(value) -> float:
    """
    Convert Excel quantity to float.

    Empty / invalid values become 0.0.
    """

    if value is None:
        return 0.0

    if pd.isna(value):
        return 0.0

    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def clean_category_id(value):
    """
    Convert category_id from Excel into an integer.

    Empty values return None because category_id itself
    is optional.
    """

    if value is None:
        return None

    if pd.isna(value):
        return None

    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


# ==========================================================
# IMPORT STORE ITEMS
# ==========================================================

def import_from_excel(
    db: Session,
    file: UploadFile,
    current_user,
    business_id: int | None,
):
    """
    Import Store Items from Excel.

    Excel columns:

        name
        unit
        category
        category_id
        unit_price
        selling_price
        item_type
        opening_stock

    Rules:

    1. Super Admin must provide business_id.
    2. Normal business users automatically use their
       own business.
    3. Unit price defaults to 0.0.
    4. Selling price defaults to 0.0.
    5. Opening stock defaults to 0.0.
    6. Category can be resolved by category_id or name.
    7. Category must belong to the selected business.
    8. Duplicate item is skipped.
    """

    # ======================================================
    # 1. DETERMINE USER TYPE
    # ======================================================

    is_super_admin = (
        current_user.role_code == SUPER_ADMIN
        or current_user.business_id is None
    )

    # ======================================================
    # 2. DETERMINE BUSINESS
    # ======================================================

    if is_super_admin:

        if business_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Business is required for Super Admin "
                    "item import."
                ),
            )

        selected_business_id = business_id

    else:

        if current_user.business_id is None:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Your account is not assigned "
                    "to a business."
                ),
            )

        selected_business_id = current_user.business_id

    # ======================================================
    # 3. VERIFY BUSINESS
    # ======================================================

    business = (
        db.query(Business)
        .filter(
            Business.id == selected_business_id
        )
        .first()
    )

    if not business:

        raise HTTPException(
            status_code=404,
            detail="Business not found.",
        )

    # ======================================================
    # 4. VALIDATE FILE
    # ======================================================

    if not file:

        raise HTTPException(
            status_code=400,
            detail="Excel file is required.",
        )

    filename = (
        file.filename
        or ""
    ).lower()

    if not (
        filename.endswith(".xlsx")
        or filename.endswith(".xls")
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid file format. "
                "Please upload an Excel file."
            ),
        )

    # ======================================================
    # 5. READ EXCEL
    # ======================================================

    try:

        df = pd.read_excel(
            file.file
        )

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unable to read Excel file: {str(exc)}"
            ),
        )

    # ======================================================
    # 6. CHECK EMPTY FILE
    # ======================================================

    if df.empty:

        raise HTTPException(
            status_code=400,
            detail="The Excel file contains no data.",
        )

    # ======================================================
    # 7. NORMALIZE COLUMN NAMES
    # ======================================================

    df.columns = [
        str(column)
        .strip()
        .lower()
        .replace(" ", "_")
        for column in df.columns
    ]

    # ======================================================
    # 8. REQUIRED COLUMNS
    # ======================================================

    required_columns = [
        "name",
        "unit",
        "category",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:

        raise HTTPException(
            status_code=400,
            detail=(
                "Missing required Excel column(s): "
                + ", ".join(missing_columns)
            ),
        )

    # ======================================================
    # 9. IMPORT COUNTERS
    # ======================================================

    created = 0
    updated = 0
    skipped = 0
    errors = []

    # ======================================================
    # 10. PROCESS EACH ROW
    # ======================================================

    for index, row in df.iterrows():

        excel_row = index + 2

        try:

            # ------------------------------------------------
            # BASIC VALUES
            # ------------------------------------------------

            name = clean_string(
                row.get("name")
            )

            unit = clean_string(
                row.get("unit")
            )

            category_name = clean_string(
                row.get("category")
            )

            item_type = clean_string(
                row.get("item_type")
            )

            if not item_type:
                item_type = None

            # ------------------------------------------------
            # NUMERIC VALUES
            # ------------------------------------------------

            unit_price = clean_price(
                row.get("unit_price")
            )

            selling_price = clean_price(
                row.get("selling_price")
            )

            opening_stock = clean_quantity(
                row.get("opening_stock")
            )

            category_id = clean_category_id(
                row.get("category_id")
            )

            # =================================================
            # 11. VALIDATE NAME / UNIT
            # =================================================

            if not name:

                skipped += 1

                errors.append({
                    "row": excel_row,
                    "item": "",
                    "reason": "Item name is required.",
                })

                continue

            if not unit:

                skipped += 1

                errors.append({
                    "row": excel_row,
                    "item": name,
                    "reason": "Unit is required.",
                })

                continue

            # =================================================
            # 12. VALIDATE CATEGORY INFORMATION
            # =================================================

            if (
                category_id is None
                and not category_name
            ):

                skipped += 1

                errors.append({
                    "row": excel_row,
                    "item": name,
                    "reason": (
                        "Category name or category_id "
                        "is required."
                    ),
                })

                continue

            # =================================================
            # 13. RESOLVE CATEGORY
            # =================================================

            category = None

            # -------------------------------------------------
            # First try category_id
            # -------------------------------------------------

            if category_id is not None:

                category = (
                    db.query(
                        store_models.StoreCategory
                    )
                    .filter(
                        store_models.StoreCategory.id
                        == category_id,

                        store_models.StoreCategory.business_id
                        == selected_business_id,
                    )
                    .first()
                )

            # -------------------------------------------------
            # If category_id did not resolve it,
            # try category name.
            # -------------------------------------------------

            if category is None and category_name:

                category = (
                    db.query(
                        store_models.StoreCategory
                    )
                    .filter(
                        store_models.StoreCategory.business_id
                        == selected_business_id,

                        store_models.StoreCategory.name
                        == category_name,
                    )
                    .first()
                )

            # =================================================
            # 14. CATEGORY NOT FOUND
            # =================================================

            if category is None:

                skipped += 1

                if category_id is not None:

                    reason = (
                        f"Category '{category_name}' "
                        f"(ID: {category_id}) was not "
                        f"found in the selected business."
                    )

                else:

                    reason = (
                        f"Category '{category_name}' "
                        f"was not found in the selected business."
                    )

                errors.append({
                    "row": excel_row,
                    "item": name,
                    "reason": reason,
                })

                continue

            # =================================================
            # 15. CHECK IF ITEM ALREADY EXISTS
            # =================================================

            existing_item = (
                db.query(
                    store_models.StoreItem
                )
                .filter(
                    store_models.StoreItem.business_id
                    == selected_business_id,

                    store_models.StoreItem.name
                    == name,

                    store_models.StoreItem.category_id
                    == category.id,
                )
                .first()
            )


            


            # ==========================================================
            # 15.1 EXISTING ITEM
            # ==========================================================

            if existing_item:

                # ------------------------------------------------------
                # FIND EXISTING INVENTORY
                # ------------------------------------------------------

                inventory = (
                    db.query(store_models.StoreInventory)
                    .filter(
                        store_models.StoreInventory.item_id
                        == existing_item.id,

                        store_models.StoreInventory.business_id
                        == selected_business_id,
                    )
                    .first()
                )

                # ------------------------------------------------------
                # IF INVENTORY DOES NOT EXIST
                # ------------------------------------------------------

                if not inventory:

                    inventory = store_models.StoreInventory(
                        item_id=existing_item.id,

                        opening_quantity=opening_stock,

                        quantity=opening_stock,

                        business_id=selected_business_id,
                    )

                    db.add(inventory)

                # ------------------------------------------------------
                # EXISTING INVENTORY
                #
                # IMPORTANT:
                #
                # The stock balance endpoint calculates:
                #
                # opening_stock
                # + purchases
                # + adjustments
                # - issues
                #
                # Therefore we MUST update opening_quantity.
                # Updating only quantity will NOT change the
                # displayed stock balance.
                # ------------------------------------------------------

                else:

                    current_opening = (
                        inventory.opening_quantity or 0
                    )

                    inventory.opening_quantity = (
                        current_opening + opening_stock
                    )

                    # Keep quantity synchronized as well.
                    #
                    # This is useful for any other part of the
                    # application that reads StoreInventory.quantity.

                    current_quantity = (
                        inventory.quantity or 0
                    )

                    inventory.quantity = (
                        current_quantity + opening_stock
                    )

                # ------------------------------------------------------
                # OPTIONAL PRICE UPDATE
                #
                # Excel blank prices become 0.
                #
                # We do NOT replace an existing price with 0 when
                # the Excel price is blank.
                # ------------------------------------------------------

                if unit_price > 0:
                    existing_item.unit_price = unit_price

                if selling_price > 0:
                    existing_item.selling_price = selling_price

                # ------------------------------------------------------
                # DO NOT CREATE A NEW ITEM
                # ------------------------------------------------------

                updated += 1

                continue

            # =================================================
            # 16. CREATE STORE ITEM
            # =================================================

            item = store_models.StoreItem(

                name=name,

                unit=unit,

                category_id=category.id,

                # Never None
                unit_price=unit_price,

                # Never None
                selling_price=selling_price,

                item_type=item_type,

                business_id=selected_business_id,
            )

            db.add(item)

            # ------------------------------------------------
            # Flush so item.id is available.
            # ------------------------------------------------

            db.flush()

            # =================================================
            # 17. CREATE INVENTORY
            # =================================================

            inventory = (
                store_models.StoreInventory(

                    item_id=item.id,

                    # Never None
                    opening_quantity=opening_stock,

                    # Never None
                    quantity=opening_stock,

                    business_id=selected_business_id,
                )
            )

            db.add(inventory)

            # ------------------------------------------------
            # Flush inventory as well.
            # ------------------------------------------------

            db.flush()

            created += 1

        except Exception as exc:

            # ------------------------------------------------
            # Roll back the current transaction state.
            # ------------------------------------------------

            db.rollback()

            traceback.print_exc()

            skipped += 1

            errors.append({
                "row": excel_row,
                "item": clean_string(
                    row.get("name")
                ),
                "reason": str(exc),
            })

            # ------------------------------------------------
            # Continue processing the remaining rows.
            # ------------------------------------------------

            continue

    # ======================================================
    # 18. COMMIT
    # ======================================================

    try:

        db.commit()

    except IntegrityError as exc:

        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=(
                "Import failed because of a database "
                f"constraint: {str(exc.orig)}"
            ),
        )

    except Exception as exc:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                f"Import failed: {str(exc)}"
            ),
        )

    # ======================================================
    # 19. RETURN RESULT
    # ======================================================

    return {
        "message": "Store items import completed.",

        "business_id": selected_business_id,

        "business_name": business.name,

        "created": created,

        "updated": updated,

        "skipped": skipped,

        "total_rows": len(df),

        "errors": errors,
    }