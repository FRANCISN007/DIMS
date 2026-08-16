from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from datetime import date
from fastapi import Query

from app.catering.models import (
    CateringUsage,
    CateringUsageItem,
    CateringUsageAudit,
)

from app.catering import models as catering_models

from app.catering.schemas import (
    CateringUsageDisplay,
    CateringUsageItemDisplay,
)

from app.locations.models import (
    Location,
    LocationInventory,
)

from app.store.models import StoreItem

from app.core.timezone import now_wat, to_wat  # ✅ centralized WAT functions

# ==========================================================
# RESPONSE HELPERS
# ==========================================================

def build_catering_usage_item_display(
    usage_item,
) -> CateringUsageItemDisplay:

    return CateringUsageItemDisplay(
        id=usage_item.id,
        usage_id=usage_item.usage_id,
        location_id=usage_item.location_id,
        item_id=usage_item.item_id,

        item_name=(
            usage_item.item.name
            if usage_item.item
            else None
        ),

        unit=(
            usage_item.item.unit
            if usage_item.item
            else None
        ),

        quantity_used=usage_item.quantity_used,
        unit_price=usage_item.unit_price,
        total_amount=usage_item.total_amount,
        created_at=usage_item.created_at,
    )


def build_catering_usage_display(
    usage,
) -> CateringUsageDisplay:

    return CateringUsageDisplay(
        id=usage.id,
        business_id=usage.business_id,

        location_id=usage.location_id,

        location_name=(
            usage.location.name
            if usage.location
            else None
        ),

        usage_date=usage.usage_date,

        note=usage.note,

        created_by=usage.created_by,

        created_at=usage.created_at,

        updated_at=usage.updated_at,

        status=usage.status,

        voided_by=usage.voided_by,

        voided_at=usage.voided_at,

        void_reason=usage.void_reason,

        items=[
            build_catering_usage_item_display(item)
            for item in usage.items
        ],
    )


def build_usage_snapshot(usage):

    return {
        "location_id": usage.location_id,
        "usage_date": (
            usage.usage_date.isoformat()
            if usage.usage_date
            else None
        ),
        "note": usage.note,
        "status": usage.status,
        "items": [
            {
                "item_id": item.item_id,
                "quantity_used": item.quantity_used,
                "unit_price": item.unit_price,
                "total_amount": item.total_amount,
            }
            for item in usage.items
        ],
    }

# ==========================================================
# CREATE CATERING USAGE
# ==========================================================

def create_catering_usage(
    db,
    usage_data,
    current_user,
    business_id,
):
    """
    Create catering usage.

    Flow:

    1. Validate business.
    2. Validate location.
    3. Validate usage items.
    4. Validate store items.
    5. Check location stock.
    6. Deduct location stock.
    7. Create usage header.
    8. Create usage items.
    9. Commit everything together.
    """

    # ------------------------------------------------------
    # BUSINESS
    # ------------------------------------------------------

    business_id = current_user.business_id

    if business_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Super Admin must operate against a "
                "specific business."
            ),
        )


        # ------------------------------------------------------
    # CAMP BOSS LOCATION RESTRICTION
    # ------------------------------------------------------

    if "camp_boss" in current_user.roles:

        if current_user.location_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Camp Boss is not assigned to a location."
                ),
            )

        # Ignore location supplied by frontend.
        usage_data.location_id = current_user.location_id

        
    # ------------------------------------------------------
    # LOCATION
    # ------------------------------------------------------

    location = (
        db.query(Location)
        .filter(
            Location.id == usage_data.location_id,
            Location.business_id == business_id,
        )
        .first()
    )

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found.",
        )

    if location.status != "active":
        raise HTTPException(
            status_code=400,
            detail="This location is not active.",
        )

    # ------------------------------------------------------
    # ITEMS REQUIRED
    # ------------------------------------------------------

    if not usage_data.items:
        raise HTTPException(
            status_code=400,
            detail="At least one item is required.",
        )

    # ------------------------------------------------------
    # PREVENT DUPLICATE ITEMS
    # ------------------------------------------------------

    item_ids = [
        usage_item.item_id
        for usage_item in usage_data.items
    ]

    if len(item_ids) != len(set(item_ids)):
        raise HTTPException(
            status_code=400,
            detail=(
                "The same item cannot appear more than once."
            ),
        )

    # ------------------------------------------------------
    # CREATE USAGE HEADER
    # ------------------------------------------------------

    usage = CateringUsage(
        business_id=business_id,
        location_id=location.id,
        usage_date=(
            usage_data.usage_date
            if usage_data.usage_date
            else None
        ),
        note=(
            usage_data.note.strip()
            if usage_data.note
            else None
        ),
        created_by=current_user.username,
    )

    db.add(usage)

    # Get usage ID before creating items
    db.flush()

    # ------------------------------------------------------
    # PROCESS ITEMS
    # ------------------------------------------------------

    for usage_item in usage_data.items:

        # ----------------------------------------------
        # STORE ITEM
        # ----------------------------------------------

        store_item = (
            db.query(StoreItem)
            .filter(
                StoreItem.id == usage_item.item_id,
                StoreItem.business_id == business_id,
            )
            .first()
        )

        if not store_item:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Item ID {usage_item.item_id} "
                    f"not found."
                ),
            )

        # ----------------------------------------------
        # LOCATION INVENTORY
        # ----------------------------------------------

        inventory = (
            db.query(LocationInventory)
            .filter(
                LocationInventory.location_id == location.id,
                LocationInventory.item_id == store_item.id,
                LocationInventory.business_id == business_id,
            )
            .with_for_update()
            .first()
        )

        if not inventory:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{store_item.name} "
                    f"is not available in this location."
                ),
            )

        # ----------------------------------------------
        # CHECK QUANTITY
        # ----------------------------------------------

        available_quantity = (
            inventory.quantity or 0
        )

        requested_quantity = (
            usage_item.quantity_used
        )

        if requested_quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Quantity for {store_item.name} "
                    f"must be greater than zero."
                ),
            )

        if requested_quantity > available_quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient stock for "
                    f"{store_item.name}. "
                    f"Available: {available_quantity}, "
                    f"Requested: {requested_quantity}."
                ),
            )

        # ----------------------------------------------
        # UNIT PRICE
        # ----------------------------------------------

        unit_price = inventory.unit_price

        if unit_price is None:
            unit_price = store_item.unit_price

        # ----------------------------------------------
        # TOTAL AMOUNT
        # ----------------------------------------------

        total_amount = None

        if unit_price is not None:
            total_amount = (
                requested_quantity *
                unit_price
            )

        # ----------------------------------------------
        # DEDUCT LOCATION STOCK
        # ----------------------------------------------

        inventory.quantity = (
            available_quantity -
            requested_quantity
        )

        # ----------------------------------------------
        # CREATE USAGE ITEM
        # ----------------------------------------------

        new_usage_item = CateringUsageItem(
            business_id=business_id,
            usage_id=usage.id,
            location_id=location.id,
            item_id=store_item.id,
            quantity_used=requested_quantity,
            unit_price=unit_price,
            total_amount=total_amount,
        )

        db.add(new_usage_item)

    # ------------------------------------------------------
    # COMMIT
    # ------------------------------------------------------

    try:

        db.commit()

    except Exception:

        db.rollback()
        raise

    # ------------------------------------------------------
    # RELOAD WITH RELATIONSHIPS
    # ------------------------------------------------------

    created_usage = (
        db.query(CateringUsage)
        .options(
            joinedload(
                CateringUsage.location
            ),
            joinedload(
                CateringUsage.items
            ).joinedload(
                CateringUsageItem.item
            ),
        )
        .filter(
            CateringUsage.id == usage.id,
            CateringUsage.business_id == business_id,
        )
        .first()
    )

    return created_usage


from datetime import date, datetime, timedelta


# ==========================================================
# LIST CATERING USAGE
# ==========================================================

def get_catering_usages(
    db,
    current_user,
    business_id,
    location_id=None,
    start_date=None,
    end_date=None,
):
    """
    Return catering usage history for the current business.

    Camp Boss:
        - Can only see usage for their assigned location.
        - Any location_id supplied by the frontend is ignored.

    Other authorized users:
        - Can filter by location_id when supplied.

    Date filtering:
        start_date = beginning of selected day
        end_date   = beginning of the day after selected end date
    """

    business_id = current_user.business_id

    # ------------------------------------------------------
    # BUSINESS
    # ------------------------------------------------------

    if business_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Super Admin must operate against "
                "a specific business."
            ),
        )

    # ------------------------------------------------------
    # CAMP BOSS LOCATION RESTRICTION
    # ------------------------------------------------------

    if "camp_boss" in current_user.roles:

        if current_user.location_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Camp Boss is not assigned to a location."
                ),
            )

        # IMPORTANT:
        # Never trust location_id coming from frontend.
        location_id = current_user.location_id

    # ------------------------------------------------------
    # BASE QUERY
    # ------------------------------------------------------

    query = (
        db.query(CateringUsage)
        .options(
            joinedload(
                CateringUsage.location
            ),
            joinedload(
                CateringUsage.items
            ).joinedload(
                CateringUsageItem.item
            ),
        )
        .filter(
            CateringUsage.business_id == business_id
        )
    )

    # ------------------------------------------------------
    # LOCATION FILTER
    # ------------------------------------------------------

    if location_id is not None:

        query = query.filter(
            CateringUsage.location_id == location_id
        )

    # ------------------------------------------------------
    # START DATE FILTER
    # ------------------------------------------------------

    if start_date is not None:

        start_datetime = datetime.combine(
            start_date,
            datetime.min.time(),
        )

        query = query.filter(
            CateringUsage.usage_date >= start_datetime
        )

    # ------------------------------------------------------
    # END DATE FILTER
    # ------------------------------------------------------

    if end_date is not None:

        end_datetime = datetime.combine(
            end_date + timedelta(days=1),
            datetime.min.time(),
        )

        query = query.filter(
            CateringUsage.usage_date < end_datetime
        )

    # ------------------------------------------------------
    # ORDER
    # ------------------------------------------------------

    return (
        query
        .order_by(
            CateringUsage.usage_date.desc(),
            CateringUsage.id.desc(),
        )
        .all()
    )


# ==========================================================
# GET ONE CATERING USAGE
# ==========================================================

def get_catering_usage(
    db: Session,
    usage_id: int,
    current_user,
    business_id,
):
    business_id = current_user.business_id

    # ------------------------------------------------------
    # BUSINESS
    # ------------------------------------------------------

    if business_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Super Admin must operate against "
                "a specific business."
            ),
        )

    # ------------------------------------------------------
    # CAMP BOSS LOCATION
    # ------------------------------------------------------

    camp_boss_location_id = None

    if "camp_boss" in current_user.roles:

        if current_user.location_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Camp Boss is not assigned to a location."
                ),
            )

        camp_boss_location_id = current_user.location_id

    # ------------------------------------------------------
    # BASE QUERY
    # ------------------------------------------------------

    query = (
        db.query(CateringUsage)
        .options(
            joinedload(
                CateringUsage.location
            ),
            joinedload(
                CateringUsage.items
            ).joinedload(
                CateringUsageItem.item
            ),
        )
        .filter(
            CateringUsage.id == usage_id,
            CateringUsage.business_id == business_id,
        )
    )

    # ------------------------------------------------------
    # CAMP BOSS LOCATION RESTRICTION
    # ------------------------------------------------------

    if camp_boss_location_id is not None:

        query = query.filter(
            CateringUsage.location_id
            == camp_boss_location_id
        )

    # ------------------------------------------------------
    # GET USAGE
    # ------------------------------------------------------

    usage = (
        db.query(catering_models.CateringUsage)
        .filter(
            catering_models.CateringUsage.id == usage_id,
            catering_models.CateringUsage.business_id
            == business_id,
        )
        .first()
    )

    if not usage:
        raise HTTPException(
            status_code=404,
            detail="Catering usage not found.",
        )

    return usage



# ==========================================================
# UPDATE CATERING USAGE
# ==========================================================

def update_catering_usage(
    db: Session,
    usage_id: int,
    usage_data,
    current_user,
    business_id,
):
    """
    Edit an existing catering usage.

    Inventory is corrected using quantity differences.

    Examples:

        Original: 20
        New:      30
        Difference: -10 inventory

        Original: 30
        New:      20
        Difference: +10 inventory

    If the location changes, stock is returned to the old
    location and deducted from the new location.
    """

    business_id = current_user.business_id

    if business_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Super Admin must operate against a "
                "specific business."
            ),
        )

    # ------------------------------------------------------
    # LOCK USAGE
    # ------------------------------------------------------

    usage = (
        db.query(CateringUsage)
        .filter(
            CateringUsage.id == usage_id,
            CateringUsage.business_id == business_id,
        )
        .with_for_update()
        .first()
    )

    if not usage:
        raise HTTPException(
            status_code=404,
            detail="Catering usage not found.",
        )

    # ------------------------------------------------------
    # VOIDED USAGE CANNOT BE EDITED
    # ------------------------------------------------------

    if usage.status == "voided":
        raise HTTPException(
            status_code=400,
            detail="A voided catering usage cannot be edited.",
        )

    # ------------------------------------------------------
    # LOAD CURRENT ITEMS
    # ------------------------------------------------------

    db.refresh(usage)

    current_items = {
        item.item_id: item
        for item in usage.items
    }

    # ------------------------------------------------------
    # DETERMINE NEW LOCATION
    # ------------------------------------------------------

    new_location_id = (
        usage_data.location_id
        if usage_data.location_id is not None
        else usage.location_id
    )

    new_location = (
        db.query(Location)
        .filter(
            Location.id == new_location_id,
            Location.business_id == business_id,
        )
        .first()
    )

    if not new_location:
        raise HTTPException(
            status_code=404,
            detail="Location not found.",
        )

    if new_location.status != "active":
        raise HTTPException(
            status_code=400,
            detail="This location is not active.",
        )

    old_location_id = usage.location_id

    # ------------------------------------------------------
    # VALIDATE NEW ITEMS
    # ------------------------------------------------------

    if usage_data.items is not None:

        if not usage_data.items:
            raise HTTPException(
                status_code=400,
                detail="At least one item is required.",
            )

        item_ids = [
            item.item_id
            for item in usage_data.items
        ]

        if len(item_ids) != len(set(item_ids)):
            raise HTTPException(
                status_code=400,
                detail=(
                    "The same item cannot appear "
                    "more than once."
                ),
            )

        new_items = {
            item.item_id: item
            for item in usage_data.items
        }

    else:

        new_items = {
            item.item_id: {
                "item_id": item.item_id,
                "quantity_used": item.quantity_used,
            }
            for item in usage.items
        }

    # ------------------------------------------------------
    # LOAD STORE ITEMS
    # ------------------------------------------------------

    store_item_ids = set(new_items.keys())

    if store_item_ids:

        store_items = (
            db.query(StoreItem)
            .filter(
                StoreItem.business_id == business_id,
                StoreItem.id.in_(store_item_ids),
            )
            .all()
        )

        store_items_map = {
            item.id: item
            for item in store_items
        }

        missing_items = (
            store_item_ids -
            set(store_items_map.keys())
        )

        if missing_items:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Item ID(s) not found: "
                    f"{', '.join(map(str, missing_items))}"
                ),
            )

    else:
        store_items_map = {}

    # ------------------------------------------------------
    # DETERMINE WHETHER LOCATION CHANGED
    # ------------------------------------------------------

    location_changed = (
        old_location_id != new_location_id
    )

    # ------------------------------------------------------
    # LOCK ALL AFFECTED INVENTORY
    # ------------------------------------------------------

    affected_item_ids = (
        set(current_items.keys()) |
        set(new_items.keys())
    )

    inventory_map = {}

    if affected_item_ids:

        location_ids = {
            old_location_id,
            new_location_id,
        }

        inventories = (
            db.query(LocationInventory)
            .filter(
                LocationInventory.business_id == business_id,
                LocationInventory.location_id.in_(
                    location_ids
                ),
                LocationInventory.item_id.in_(
                    affected_item_ids
                ),
            )
            .with_for_update()
            .all()
        )

        for inventory in inventories:

            inventory_map[
                (
                    inventory.location_id,
                    inventory.item_id,
                )
            ] = inventory

    # ------------------------------------------------------
    # PROCESS INVENTORY
    # ------------------------------------------------------

    for item_id in affected_item_ids:

        old_item = current_items.get(item_id)
        new_item = new_items.get(item_id)

        old_quantity = (
            old_item.quantity_used
            if old_item
            else 0
        )

        if new_item:

            if isinstance(
                new_item,
                dict,
            ):
                new_quantity = (
                    new_item["quantity_used"]
                )
            else:
                new_quantity = (
                    new_item.quantity_used
                )

        else:

            new_quantity = 0

        # ==================================================
        # LOCATION DID NOT CHANGE
        # ==================================================

        if not location_changed:

            difference = (
                new_quantity -
                old_quantity
            )

            if difference > 0:

                inventory = inventory_map.get(
                    (
                        new_location_id,
                        item_id,
                    )
                )

                if not inventory:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"{store_items_map[item_id].name} "
                            "is not available in this location."
                        ),
                    )

                available = (
                    inventory.quantity or 0
                )

                if difference > available:

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Insufficient stock for "
                            f"{store_items_map[item_id].name}. "
                            f"Available: {available}, "
                            f"Additional required: "
                            f"{difference}."
                        ),
                    )

                inventory.quantity = (
                    available - difference
                )

            elif difference < 0:

                inventory = inventory_map.get(
                    (
                        new_location_id,
                        item_id,
                    )
                )

                if not inventory:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Inventory record not found for "
                            f"{store_items_map[item_id].name}."
                        ),
                    )

                inventory.quantity = (
                    inventory.quantity or 0
                ) + abs(difference)

        # ==================================================
        # LOCATION CHANGED
        # ==================================================

        else:

            # ----------------------------------------------
            # RETURN ORIGINAL USAGE TO OLD LOCATION
            # ----------------------------------------------

            if old_quantity > 0:

                old_inventory = inventory_map.get(
                    (
                        old_location_id,
                        item_id,
                    )
                )

                if not old_inventory:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Inventory record not found for "
                            f"{store_items_map.get(item_id).name if item_id in store_items_map else item_id} "
                            "in the original location."
                        ),
                    )

                old_inventory.quantity = (
                    old_inventory.quantity or 0
                ) + old_quantity

            # ----------------------------------------------
            # DEDUCT NEW LOCATION
            # ----------------------------------------------

            if new_quantity > 0:

                new_inventory = inventory_map.get(
                    (
                        new_location_id,
                        item_id,
                    )
                )

                if not new_inventory:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"{store_items_map[item_id].name} "
                            "is not available in the new location."
                        ),
                    )

                available = (
                    new_inventory.quantity or 0
                )

                if new_quantity > available:

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Insufficient stock for "
                            f"{store_items_map[item_id].name} "
                            f"in the new location. "
                            f"Available: {available}, "
                            f"Requested: {new_quantity}."
                        ),
                    )

                new_inventory.quantity = (
                    available -
                    new_quantity
                )

    # ------------------------------------------------------
    # AUDIT OLD STATE
    # ------------------------------------------------------

    old_snapshot = build_usage_snapshot(usage)

    # ------------------------------------------------------
    # UPDATE HEADER
    # ------------------------------------------------------

    usage.location_id = new_location_id

    if usage_data.usage_date is not None:
        usage.usage_date = (
            usage_data.usage_date
        )

    if usage_data.note is not None:
        usage.note = usage_data.note

    # ------------------------------------------------------
    # UPDATE ITEMS
    # ------------------------------------------------------

    if usage_data.items is not None:

        # ----------------------------------------------
        # REMOVE ITEMS NO LONGER PRESENT
        # ----------------------------------------------

        for item_id, existing_item in list(
            current_items.items()
        ):

            if item_id not in new_items:

                db.delete(existing_item)

        # ----------------------------------------------
        # UPDATE / ADD ITEMS
        # ----------------------------------------------

        for item_id, incoming_item in new_items.items():

            store_item = store_items_map[item_id]

            if isinstance(
                incoming_item,
                dict,
            ):

                quantity = (
                    incoming_item["quantity_used"]
                )

            else:

                quantity = (
                    incoming_item.quantity_used
                )

            inventory = inventory_map.get(
                (
                    new_location_id,
                    item_id,
                )
            )

            unit_price = None

            if inventory:

                unit_price = (
                    inventory.unit_price
                )

            if unit_price is None:

                unit_price = (
                    store_item.unit_price
                )

            total_amount = None

            if unit_price is not None:

                total_amount = (
                    quantity *
                    unit_price
                )

            existing_item = current_items.get(
                item_id
            )

            if existing_item:

                existing_item.location_id = (
                    new_location_id
                )

                existing_item.quantity_used = (
                    quantity
                )

                existing_item.unit_price = (
                    unit_price
                )

                existing_item.total_amount = (
                    total_amount
                )

            else:

                new_usage_item = CateringUsageItem(
                    business_id=business_id,
                    usage_id=usage.id,
                    location_id=new_location_id,
                    item_id=item_id,
                    quantity_used=quantity,
                    unit_price=unit_price,
                    total_amount=total_amount,
                )

                db.add(new_usage_item)

    # ------------------------------------------------------
    # FLUSH BEFORE AUDIT
    # ------------------------------------------------------

    db.flush()

    # ------------------------------------------------------
    # AUDIT NEW STATE
    # ------------------------------------------------------

    db.refresh(usage)

    new_snapshot = build_usage_snapshot(
        usage
    )

    audit = CateringUsageAudit(
        business_id=business_id,
        usage_id=usage.id,
        action="edit",
        performed_by=current_user.username,
        reason="Catering usage edited.",
        old_data=old_snapshot,
        new_data=new_snapshot,
    )

    db.add(audit)

    # ------------------------------------------------------
    # COMMIT EVERYTHING
    # ------------------------------------------------------

    try:

        db.commit()

        db.refresh(usage)

    except Exception:

        db.rollback()

        raise

    return build_catering_usage_display(
        usage
    )



# ==========================================================
# VOID CATERING USAGE
# ==========================================================

# ==========================================================
# VOID CATERING USAGE
# ==========================================================

def void_catering_usage(
    db: Session,
    usage_id: int,
    reason: str | None,
    current_user,
):
    """
    Void a catering usage entry.

    Voiding does NOT delete the usage record.

    Instead:
        1. Restore the quantities used back to location stock.
        2. Mark the usage as voided.
        3. Record who voided it.
        4. Record when it was voided.
        5. Record the reason.

    The original usage and its items remain available
    for audit purposes.
    """

    business_id = current_user.business_id

    # ------------------------------------------------------
    # BUSINESS CHECK
    # ------------------------------------------------------

    if business_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Super Admin must operate against a "
                "specific business."
            ),
        )

    # ------------------------------------------------------
    # LOCK USAGE HEADER ONLY
    #
    # IMPORTANT:
    # Do NOT use joinedload() here.
    #
    # PostgreSQL cannot apply FOR UPDATE to the nullable
    # side of the outer join generated by joinedload().
    # ------------------------------------------------------

    usage = (
        db.query(CateringUsage)
        .filter(
            CateringUsage.id == usage_id,
            CateringUsage.business_id == business_id,
        )
        .with_for_update()
        .first()
    )

    if not usage:
        raise HTTPException(
            status_code=404,
            detail="Catering usage not found.",
        )

    # ------------------------------------------------------
    # ALREADY VOIDED
    # ------------------------------------------------------

    if usage.status == "voided":
        raise HTTPException(
            status_code=400,
            detail="This catering usage has already been voided.",
        )

    # ------------------------------------------------------
    # LOAD ITEMS SEPARATELY
    # ------------------------------------------------------

    usage_items = (
        db.query(CateringUsageItem)
        .filter(
            CateringUsageItem.usage_id == usage.id,
            CateringUsageItem.business_id == business_id,
        )
        .all()
    )

    if not usage_items:
        raise HTTPException(
            status_code=400,
            detail="This usage has no items to restore.",
        )

    # ------------------------------------------------------
    # RESTORE LOCATION STOCK
    # ------------------------------------------------------

    for usage_item in usage_items:

        inventory = (
            db.query(LocationInventory)
            .filter(
                LocationInventory.location_id
                == usage_item.location_id,

                LocationInventory.item_id
                == usage_item.item_id,

                LocationInventory.business_id
                == business_id,
            )
            .with_for_update()
            .first()
        )

        if not inventory:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Location inventory was not found for "
                    f"item ID {usage_item.item_id}. "
                    "The usage cannot be safely voided."
                ),
            )

        # --------------------------------------------------
        # RESTORE QUANTITY
        # --------------------------------------------------

        inventory.quantity = (
            (inventory.quantity or 0)
            + usage_item.quantity_used
        )

    # ------------------------------------------------------
    # MARK USAGE AS VOIDED
    # ------------------------------------------------------

    usage.status = "voided"

    usage.voided_by = current_user.username

    usage.voided_at = now_wat()

    usage.void_reason = (
        reason.strip()
        if reason
        else None
    )

    # ------------------------------------------------------
    # COMMIT EVERYTHING TOGETHER
    # ------------------------------------------------------

    try:

        db.commit()

    except Exception:

        db.rollback()
        raise

    # ------------------------------------------------------
    # RELOAD USAGE
    # ------------------------------------------------------

    return (
        db.query(CateringUsage)
        .options(
            joinedload(CateringUsage.location),
            joinedload(
                CateringUsage.items
            ).joinedload(
                CateringUsageItem.item
            ),
        )
        .filter(
            CateringUsage.id == usage.id,
            CateringUsage.business_id == business_id,
        )
        .first()
    )