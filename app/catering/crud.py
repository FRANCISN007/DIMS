from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from datetime import date
from fastapi import Query

from app.catering.models import (
    CateringUsage,
    CateringUsageItem,
    CateringUsageAudit,
)

from sqlalchemy.orm import (
    joinedload,
    contains_eager,
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

from app.core.location import (
    is_camp_boss,
    resolve_location_id,
    validate_location_access,
    apply_location_access_filter,
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

    Location security:

    - Camp Boss can ONLY create usage for their assigned location.
    - Frontend location_id is ignored for Camp Boss.
    - Other authorized users can use the requested location.
    - Location must belong to the effective business.
    - All stock changes and usage records are committed together.

    Flow:

    1. Validate business.
    2. Resolve authorized location.
    3. Validate location.
    4. Validate usage items.
    5. Validate store items.
    6. Check location stock.
    7. Deduct location stock.
    8. Create usage header.
    9. Create usage items.
    10. Commit everything together.
    11. Reload relationships.
    """

    # ======================================================
    # 1. BUSINESS
    # ======================================================

    if business_id is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Super Admin must operate against a "
                "specific business."
            ),
        )

    # ------------------------------------------------------
    # BUSINESS USER SECURITY
    # ------------------------------------------------------
    # A normal business user must only operate inside
    # their own business.
    #
    # Super Admin can operate against the business supplied
    # by the caller/service layer.
    # ------------------------------------------------------

    if current_user.business_id is not None:

        if current_user.business_id != business_id:

            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have access to this business."
                ),
            )

    # ======================================================
    # 2. RESOLVE LOCATION ACCESS
    # ======================================================
    #
    # Camp Boss:
    #     requested location is ignored.
    #     assigned location is always used.
    #
    # Other roles:
    #     requested location is respected.
    # ======================================================


    # ======================================================
        # DEBUG CAMP BOSS LOCATION
        # ======================================================
    
        print(
            "\n========== CREATE USAGE LOCATION DEBUG =========="
        )
    
        print(
            "USERNAME:",
            getattr(
                current_user,
                "username",
                None,
            )
        )
    
        print(
            "BUSINESS ID:",
            getattr(
                current_user,
                "business_id",
                None,
            )
        )
    
        print(
            "USER LOCATION ID:",
            getattr(
                current_user,
                "location_id",
                None,
            )
        )
    
        print(
            "REQUESTED LOCATION ID:",
            getattr(
                usage_data,
                "location_id",
                None,
            )
        )
    
        print(
            "USER ROLES:",
            getattr(
                current_user,
                "roles",
                None,
            )
        )
    
        print(
            "ROLE NAME:",
            getattr(
                current_user,
                "role_name",
                None,
            )
        )
    
        print(
            "ROLE CODE:",
            getattr(
                current_user,
                "role_code",
                None,
            )
        )
    
        print(
            "IS CAMP BOSS:",
            is_camp_boss(
                current_user
            )
        )
    
        print(
            "=================================================\n"
        )
    

    location_id = resolve_location_id(
        current_user,
        usage_data.location_id,
    )


    print(
    "========== RESOLVED LOCATION =========="
    )

    print(
        "FINAL LOCATION ID:",
        location_id
    )

    print(
        "========================================"
    )

    
    # ======================================================
    # 3. VALIDATE LOCATION
    # ======================================================

    location = validate_location_access(
        db=db,
        current_user=current_user,
        location_id=location_id,
        business_id=business_id,
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

    # ======================================================
    # 4. ITEMS REQUIRED
    # ======================================================

    if not usage_data.items:

        raise HTTPException(
            status_code=400,
            detail="At least one item is required.",
        )

    # ======================================================
    # 5. PREVENT DUPLICATE ITEMS
    # ======================================================

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

    # ======================================================
    # 6. CREATE USAGE HEADER
    # ======================================================

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

    # Get usage ID before creating usage items.
    db.flush()

    # ======================================================
    # 7. PROCESS ITEMS
    # ======================================================

    for usage_item in usage_data.items:

        # --------------------------------------------------
        # STORE ITEM
        # --------------------------------------------------

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

        # --------------------------------------------------
        # LOCATION INVENTORY
        # --------------------------------------------------

        inventory = (
            db.query(LocationInventory)
            .filter(
                LocationInventory.location_id
                == location.id,

                LocationInventory.item_id
                == store_item.id,

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
                    f"{store_item.name} "
                    f"is not available in this location."
                ),
            )

        # --------------------------------------------------
        # AVAILABLE QUANTITY
        # --------------------------------------------------

        available_quantity = (
            inventory.quantity or 0
        )

        # --------------------------------------------------
        # REQUESTED QUANTITY
        # --------------------------------------------------

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

        # --------------------------------------------------
        # STOCK VALIDATION
        # --------------------------------------------------

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

        # --------------------------------------------------
        # UNIT PRICE
        # --------------------------------------------------

        unit_price = inventory.unit_price

        if unit_price is None:

            unit_price = store_item.unit_price

        # --------------------------------------------------
        # TOTAL AMOUNT
        # --------------------------------------------------

        total_amount = None

        if unit_price is not None:

            total_amount = (
                requested_quantity
                * unit_price
            )

        # --------------------------------------------------
        # DEDUCT LOCATION STOCK
        # --------------------------------------------------

        inventory.quantity = (
            available_quantity
            - requested_quantity
        )

        # --------------------------------------------------
        # CREATE USAGE ITEM
        # --------------------------------------------------

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

    # ======================================================
    # 8. COMMIT
    # ======================================================

    try:

        db.commit()

    except Exception:

        db.rollback()

        raise

    # ======================================================
    # 9. RELOAD WITH RELATIONSHIPS
    # ======================================================

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

            CateringUsage.business_id
            == business_id,
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
    item_id=None,
    start_date=None,
    end_date=None,
):
    """
    Return catering usage history for the current business.

    Supports:

    - Location filtering
    - Item filtering
    - Start date filtering
    - End date filtering
    - Camp Boss location restriction
    - Business isolation

    When item_id is supplied, only the selected item is
    loaded into the usage.items collection.
    """

    # ======================================================
    # 1. VALIDATE BUSINESS
    # ======================================================

    if business_id is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Super Admin must operate against "
                "a specific business."
            ),
        )

    # ------------------------------------------------------
    # Business users cannot access another business.
    # ------------------------------------------------------

    if current_user.business_id is not None:

        if current_user.business_id != business_id:

            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have access "
                    "to this business."
                ),
            )

    # ======================================================
    # 2. BASE QUERY
    # ======================================================

    query = (
        db.query(CateringUsage)
        .filter(
            CateringUsage.business_id
            == business_id
        )
    )

    # ======================================================
    # 3. LOAD USAGE ITEMS
    # ======================================================
    #
    # IMPORTANT:
    #
    # If item_id is supplied, we JOIN the matching item and
    # use contains_eager() so SQLAlchemy puts ONLY the
    # filtered item into usage.items.
    #
    # Without this, joinedload() loads every item belonging
    # to the usage, even though the parent usage was filtered.
    # ======================================================

    if item_id is not None:

        query = (
            query
            .join(
                CateringUsageItem,
                CateringUsageItem.usage_id
                == CateringUsage.id,
            )
            .join(
                StoreItem,
                StoreItem.id
                == CateringUsageItem.item_id,
            )
            .filter(
                CateringUsageItem.item_id
                == item_id,
                StoreItem.business_id
                == business_id,
            )
            .options(
                contains_eager(
                    CateringUsage.items
                ).joinedload(
                    CateringUsageItem.item
                ),
                joinedload(
                    CateringUsage.location
                ),
            )
            .distinct()
        )

    else:

        query = (
            query
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
        )

    # ======================================================
    # 4. LOCATION ACCESS
    # ======================================================

    if is_camp_boss(current_user):

        user_location_id = (
            current_user.location_id
        )

        if user_location_id is None:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Camp Boss is not assigned "
                    "to a location."
                ),
            )

        query = query.filter(
            CateringUsage.location_id
            == user_location_id
        )

    elif location_id is not None:

        query = query.filter(
            CateringUsage.location_id
            == location_id
        )

    # ======================================================
    # 5. START DATE FILTER
    # ======================================================

    if start_date is not None:

        start_datetime = datetime.combine(
            start_date,
            datetime.min.time(),
        )

        query = query.filter(
            CateringUsage.usage_date
            >= start_datetime
        )

    # ======================================================
    # 6. END DATE FILTER
    # ======================================================

    if end_date is not None:

        end_datetime = datetime.combine(
            end_date + timedelta(days=1),
            datetime.min.time(),
        )

        query = query.filter(
            CateringUsage.usage_date
            < end_datetime
        )

    # ======================================================
    # 7. ORDER
    # ======================================================

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
    """
    Return one catering usage record.

    Security:

    Business users:
        - Can only access usage belonging to their business.

    Super Admin:
        - Must provide a specific business_id.

    Camp Boss:
        - Can ONLY access usage belonging to their assigned
          location.
        - The usage_id alone is not enough to bypass the
          location restriction.
    """

    # ======================================================
    # 1. VALIDATE BUSINESS
    # ======================================================

    if business_id is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Super Admin must operate against "
                "a specific business."
            ),
        )

    # ======================================================
    # 2. BUSINESS ACCESS
    # ======================================================
    #
    # Business users must stay inside their own business.
    #
    # Super Admin has business_id == None and can access
    # the business supplied to this function.
    # ======================================================

    if current_user.business_id is not None:

        if current_user.business_id != business_id:

            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have access "
                    "to this business."
                ),
            )

    # ======================================================
    # 3. BASE QUERY
    # ======================================================

    query = (
        db.query(
            catering_models.CateringUsage
        )
        .filter(
            catering_models.CateringUsage.id
            == usage_id,

            catering_models.CateringUsage.business_id
            == business_id,
        )
    )

    # ======================================================
    # 4. CAMP BOSS LOCATION RESTRICTION
    # ======================================================
    #
    # A Camp Boss cannot retrieve a usage record belonging
    # to another location, even if they know the usage_id.
    # ======================================================

    if is_camp_boss(current_user):

        user_location_id = (
            current_user.location_id
        )

        if user_location_id is None:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Camp Boss is not assigned "
                    "to a location."
                ),
            )

        query = query.filter(
            catering_models.CateringUsage.location_id
            == user_location_id
        )

    # ======================================================
    # 5. GET USAGE
    # ======================================================

    usage = query.first()

    if not usage:

        raise HTTPException(
            status_code=404,
            detail="Catering usage not found.",
        )

    # ======================================================
    # 6. RETURN
    # ======================================================

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

    Location rules:

        Camp Boss:
            - Can ONLY edit usage belonging to their
              assigned location.
            - Cannot move usage to another location.
            - Frontend location_id is ignored.

        Other authorized users:
            - Can edit usage within their business.
            - Can change the location when permitted.

    If the location changes, stock is returned to the old
    location and deducted from the new location.
    """

    # ======================================================
    # 1. VALIDATE BUSINESS
    # ======================================================

    if business_id is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Super Admin must operate against a "
                "specific business."
            ),
        )

    # ======================================================
    # 2. BUSINESS ACCESS
    # ======================================================

    if current_user.business_id is not None:

        if current_user.business_id != business_id:

            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have access "
                    "to this business."
                ),
            )

    # ======================================================
    # 3. LOCK USAGE
    # ======================================================
    #
    # IMPORTANT:
    #
    # Camp Boss location restriction is applied directly
    # to this query.
    #
    # Therefore a Camp Boss cannot edit another location's
    # usage even if they know the usage_id.
    # ======================================================

    query = (
        db.query(CateringUsage)
        .filter(
            CateringUsage.id == usage_id,
            CateringUsage.business_id == business_id,
        )
    )

    # ======================================================
    # 4. CAMP BOSS LOCATION RESTRICTION
    # ======================================================

    if is_camp_boss(current_user):

        user_location_id = (
            current_user.location_id
        )

        if user_location_id is None:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Camp Boss is not assigned "
                    "to a location."
                ),
            )

        query = query.filter(
            CateringUsage.location_id
            == user_location_id
        )

    # ------------------------------------------------------
    # LOCK THE RECORD
    # ------------------------------------------------------

    usage = (
        query
        .with_for_update()
        .first()
    )

    if not usage:

        raise HTTPException(
            status_code=404,
            detail="Catering usage not found.",
        )

    # ======================================================
    # 5. VOIDED USAGE CANNOT BE EDITED
    # ======================================================

    if usage.status == "voided":

        raise HTTPException(
            status_code=400,
            detail=(
                "A voided catering usage "
                "cannot be edited."
            ),
        )

    # ======================================================
    # 6. LOAD CURRENT ITEMS
    # ======================================================

    db.refresh(usage)

    current_items = {
        item.item_id: item
        for item in usage.items
    }

    # ======================================================
    # 7. DETERMINE NEW LOCATION
    # ======================================================
    #
    # Camp Boss:
    #     resolve_location_id() ignores the frontend
    #     location_id and returns the assigned location.
    #
    # Other roles:
    #     supplied location_id is respected.
    #
    # If location_id is not supplied, keep the existing
    # location.
    # ======================================================

    requested_location_id = (
        usage_data.location_id
        if usage_data.location_id is not None
        else usage.location_id
    )

    new_location_id = resolve_location_id(
        current_user,
        requested_location_id,
    )

    # ======================================================
    # 8. VALIDATE NEW LOCATION
    # ======================================================

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

    # ======================================================
    # 9. OLD LOCATION
    # ======================================================

    old_location_id = usage.location_id

    # ======================================================
    # 10. VALIDATE NEW ITEMS
    # ======================================================

    if usage_data.items is not None:

        if not usage_data.items:

            raise HTTPException(
                status_code=400,
                detail=(
                    "At least one item is required."
                ),
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

    # ======================================================
    # 11. LOAD STORE ITEMS
    # ======================================================

    store_item_ids = set(
        new_items.keys()
    )

    if store_item_ids:

        store_items = (
            db.query(StoreItem)
            .filter(
                StoreItem.business_id
                == business_id,

                StoreItem.id.in_(
                    store_item_ids
                ),
            )
            .all()
        )

        store_items_map = {
            item.id: item
            for item in store_items
        }

        missing_items = (
            store_item_ids
            -
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

    # ======================================================
    # 12. DETERMINE WHETHER LOCATION CHANGED
    # ======================================================

    location_changed = (
        old_location_id
        != new_location_id
    )

    # ======================================================
    # 13. LOCK ALL AFFECTED INVENTORY
    # ======================================================

    affected_item_ids = (
        set(current_items.keys())
        |
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
                LocationInventory.business_id
                == business_id,

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

    # ======================================================
    # 14. PROCESS INVENTORY
    # ======================================================

    for item_id in affected_item_ids:

        old_item = current_items.get(
            item_id
        )

        new_item = new_items.get(
            item_id
        )

        old_quantity = (
            old_item.quantity_used
            if old_item
            else 0
        )

        # --------------------------------------------------
        # NEW QUANTITY
        # --------------------------------------------------

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
        # VALIDATE NEW QUANTITY
        # ==================================================

        if new_item and new_quantity <= 0:

            item_name = (
                store_items_map[item_id].name
                if item_id in store_items_map
                else str(item_id)
            )

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Quantity for {item_name} "
                    f"must be greater than zero."
                ),
            )

        # ==================================================
        # LOCATION DID NOT CHANGE
        # ==================================================

        if not location_changed:

            difference = (
                new_quantity
                - old_quantity
            )

            # ------------------------------------------------
            # MORE STOCK USED
            # ------------------------------------------------

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
                            "is not available in this "
                            "location."
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
                    available
                    - difference
                )

            # ------------------------------------------------
            # LESS STOCK USED
            # ------------------------------------------------

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
                            f"Inventory record not found "
                            f"for "
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

                    item_name = (
                        store_items_map[item_id].name
                        if item_id in store_items_map
                        else str(item_id)
                    )

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Inventory record not found "
                            f"for {item_name} in the "
                            "original location."
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
                            "is not available in the "
                            "new location."
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
                            "in the new location. "
                            f"Available: {available}, "
                            f"Requested: {new_quantity}."
                        ),
                    )

                new_inventory.quantity = (
                    available
                    - new_quantity
                )

    # ======================================================
    # 15. AUDIT OLD STATE
    # ======================================================

    old_snapshot = build_usage_snapshot(
        usage
    )

    # ======================================================
    # 16. UPDATE HEADER
    # ======================================================

    usage.location_id = (
        new_location_id
    )

    if usage_data.usage_date is not None:

        usage.usage_date = (
            usage_data.usage_date
        )

    if usage_data.note is not None:

        usage.note = (
            usage_data.note.strip()
            if usage_data.note
            else None
        )

    # ======================================================
    # 17. UPDATE ITEMS
    # ======================================================

    if usage_data.items is not None:

        # --------------------------------------------------
        # REMOVE ITEMS NO LONGER PRESENT
        # --------------------------------------------------

        for item_id, existing_item in list(
            current_items.items()
        ):

            if item_id not in new_items:

                db.delete(
                    existing_item
                )

        # --------------------------------------------------
        # UPDATE / ADD ITEMS
        # --------------------------------------------------

        for item_id, incoming_item in (
            new_items.items()
        ):

            store_item = (
                store_items_map[item_id]
            )

            if isinstance(
                incoming_item,
                dict,
            ):

                quantity = (
                    incoming_item[
                        "quantity_used"
                    ]
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

            # ------------------------------------------------
            # UNIT PRICE
            # ------------------------------------------------

            unit_price = None

            if inventory:

                unit_price = (
                    inventory.unit_price
                )

            if unit_price is None:

                unit_price = (
                    store_item.unit_price
                )

            # ------------------------------------------------
            # TOTAL AMOUNT
            # ------------------------------------------------

            total_amount = None

            if unit_price is not None:

                total_amount = (
                    quantity
                    * unit_price
                )

            # ------------------------------------------------
            # EXISTING ITEM
            # ------------------------------------------------

            existing_item = (
                current_items.get(
                    item_id
                )
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

            # ------------------------------------------------
            # NEW ITEM
            # ------------------------------------------------

            else:

                new_usage_item = (
                    CateringUsageItem(

                        business_id=business_id,

                        usage_id=usage.id,

                        location_id=(
                            new_location_id
                        ),

                        item_id=item_id,

                        quantity_used=quantity,

                        unit_price=unit_price,

                        total_amount=total_amount,
                    )
                )

                db.add(
                    new_usage_item
                )

    # ======================================================
    # 18. FLUSH BEFORE AUDIT
    # ======================================================

    db.flush()

    # ======================================================
    # 19. AUDIT NEW STATE
    # ======================================================

    db.refresh(
        usage
    )

    new_snapshot = (
        build_usage_snapshot(
            usage
        )
    )

    audit = CateringUsageAudit(

        business_id=business_id,

        usage_id=usage.id,

        action="edit",

        performed_by=(
            current_user.username
        ),

        reason=(
            "Catering usage edited."
        ),

        old_data=old_snapshot,

        new_data=new_snapshot,
    )

    db.add(
        audit
    )

    # ======================================================
    # 20. COMMIT EVERYTHING
    # ======================================================

    try:

        db.commit()

        db.refresh(
            usage
        )

    except Exception:

        db.rollback()

        raise

    # ======================================================
    # 21. RETURN
    # ======================================================

    return build_catering_usage_display(
        usage
    )



# ==========================================================
# VOID CATERING USAGE
# ==========================================================

def void_catering_usage(
    db: Session,
    usage_id: int,
    reason: str | None,
    current_user,
    business_id: int,
):
    """
    Void a catering usage entry.

    Rules:

    Super Admin / Admin / Manager / Store:
        Can void usages within their business.

    Camp Boss:
        Can ONLY void usage belonging to their assigned
        location.

        The location restriction is enforced on the
        backend and does not depend on the frontend.

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

    
    # ======================================================
    # 2. CHECK CAMP BOSS LOCATION
    # ======================================================

    camp_boss_location_id = None

    if is_camp_boss(current_user):

        if current_user.location_id is None:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Camp Boss is not assigned "
                    "to a location."
                ),
            )

        camp_boss_location_id = (
            current_user.location_id
        )

    # ======================================================
    # 3. LOCK USAGE HEADER
    #
    # IMPORTANT:
    # Do not use joinedload() with FOR UPDATE here.
    # ======================================================

    usage_query = (
        db.query(CateringUsage)
        .filter(
            CateringUsage.id == usage_id,
            CateringUsage.business_id == business_id,
        )
    )

    # ======================================================
    # 4. CAMP BOSS LOCATION RESTRICTION
    #
    # This is the important security check.
    #
    # Even if somebody manually changes the usage_id,
    # a Camp Boss can only access usage belonging to
    # their own location.
    # ======================================================

    if camp_boss_location_id is not None:

        usage_query = usage_query.filter(
            CateringUsage.location_id
            == camp_boss_location_id
        )

    # ======================================================
    # 5. LOCK USAGE
    # ======================================================

    usage = (
        usage_query
        .with_for_update()
        .first()
    )

    if not usage:

        if camp_boss_location_id is not None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Catering usage not found "
                    "for your assigned location."
                ),
            )

        raise HTTPException(
            status_code=404,
            detail="Catering usage not found.",
        )

    # ======================================================
    # 6. ALREADY VOIDED
    # ======================================================

    if usage.status == "voided":

        raise HTTPException(
            status_code=400,
            detail=(
                "This catering usage has already "
                "been voided."
            ),
        )

    # ======================================================
    # 7. LOAD USAGE ITEMS
    #
    # Load separately because the usage header is locked.
    # ======================================================

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
            detail=(
                "This usage has no items to restore."
            ),
        )

    # ======================================================
    # 8. RESTORE LOCATION STOCK
    # ======================================================

    for usage_item in usage_items:

        # --------------------------------------------------
        # CAMP BOSS SAFETY CHECK
        #
        # Normally already guaranteed by the usage query,
        # but keep this check as an additional protection.
        # --------------------------------------------------

        if (
            camp_boss_location_id is not None
            and usage_item.location_id
            != camp_boss_location_id
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "You are not allowed to void usage "
                    "from another location."
                ),
            )

        # --------------------------------------------------
        # LOCK LOCATION INVENTORY
        # --------------------------------------------------

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
                    "Location inventory was not found "
                    f"for item ID {usage_item.item_id}. "
                    "The usage cannot be safely voided."
                ),
            )

        # --------------------------------------------------
        # RESTORE QUANTITY
        # --------------------------------------------------

        inventory.quantity = (
            float(inventory.quantity or 0)
            + float(usage_item.quantity_used or 0)
        )

    # ======================================================
    # 9. MARK USAGE AS VOIDED
    # ======================================================

    usage.status = "voided"

    usage.voided_by = current_user.username

    usage.voided_at = now_wat()

    usage.void_reason = (
        reason.strip()
        if reason and reason.strip()
        else None
    )

    # ======================================================
    # 10. COMMIT EVERYTHING TOGETHER
    # ======================================================

    try:

        db.commit()

    except Exception:

        db.rollback()
        raise

    # ======================================================
    # 11. RELOAD USAGE
    # ======================================================

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