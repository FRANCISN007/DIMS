from fastapi import (
    APIRouter,
    Depends,
    Query,
    status,
    HTTPException, 
)

from sqlalchemy import func

from sqlalchemy.orm import Session

from app.database import get_db
from datetime import date
from fastapi import Query

from app.users.schemas import UserDisplaySchema
from app.users.permissions import role_required
from app.core.roles import USER_MANAGEMENT_ROLES

from app.store import schemas as store_schemas
from app.store import models as store_models


from app.locations import models as location_models
from app.locations import schemas as location_schemas
from app.store import models as store_models


from app.catering import schemas
from typing import Optional
from app.users import schemas as user_schemas
from app.core.business import resolve_business_id

from app.locations.models import Location
from app.store.models import StoreItem

from app.catering import models as catering_models
from app.catering import schemas as catering_schemas

from datetime import datetime, timezone


from app.core.timezone import now_wat, to_wat  # ✅ centralized WAT functions

from zoneinfo import ZoneInfo


from app.catering.crud import (
    create_catering_usage,
    get_catering_usages,
    get_catering_usage,
    update_catering_usage,
    void_catering_usage,
)

router = APIRouter()


# ==========================================================
# RESPONSE BUILDER
# ==========================================================

# ==========================================================
# RESPONSE BUILDER
# ==========================================================

def usage_to_response(
    usage,
    db: Session,
):
    """
    Build a clean CateringUsageDisplay response.

    Explicitly loads Location and StoreItem so that
    location_name, item_name and unit are never dependent
    on whether SQLAlchemy relationships were loaded.
    """

    # ------------------------------------------------------
    # LOCATION
    # ------------------------------------------------------

    location = (
        db.query(Location)
        .filter(
            Location.id == usage.location_id,
            Location.business_id == usage.business_id,
        )
        .first()
    )

    # ------------------------------------------------------
    # ITEMS
    # ------------------------------------------------------

    response_items = []

    for item in usage.items:

        store_item = (
            db.query(StoreItem)
            .filter(
                StoreItem.id == item.item_id,
                StoreItem.business_id == usage.business_id,
            )
            .first()
        )

        response_items.append(
            schemas.CateringUsageItemDisplay(
                id=item.id,

                usage_id=item.usage_id,

                location_id=item.location_id,

                item_id=item.item_id,

                item_name=(
                    store_item.name
                    if store_item
                    else None
                ),

                unit=(
                    store_item.unit
                    if store_item
                    else None
                ),

                quantity_used=item.quantity_used,

                unit_price=item.unit_price,

                total_amount=item.total_amount,

                created_at=item.created_at,
            )
        )

    # ------------------------------------------------------
    # RESPONSE
    # ------------------------------------------------------

    return schemas.CateringUsageDisplay(
        id=usage.id,

        business_id=usage.business_id,

        location_id=usage.location_id,

        location_name=(
            location.name
            if location
            else None
        ),

        usage_date=usage.usage_date,

        status=usage.status,

        note=usage.note,

        created_by=usage.created_by,

        created_at=usage.created_at,

        updated_at=usage.updated_at,

        voided_by=usage.voided_by,

        voided_at=usage.voided_at,

        void_reason=usage.void_reason,

        items=response_items,
    )


# ==========================================================
# CREATE CATERING USAGE
# ==========================================================

# ==========================================================
# CREATE CATERING USAGE
# ==========================================================

@router.post(
    "/usage",
    response_model=schemas.CateringUsageDisplay,
    status_code=status.HTTP_201_CREATED,
)
def create_usage(
    usage_data: schemas.CateringUsageCreate,

    db: Session = Depends(get_db),

    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):

    # ======================================================
    # CAMP BOSS LOCATION RESTRICTION
    # ======================================================

    if "camp_boss" in current_user.roles:

        # --------------------------------------------------
        # Camp Boss must have a location
        # --------------------------------------------------

        if current_user.location_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Camp Boss is not assigned to a location."
                ),
            )

        # --------------------------------------------------
        # IMPORTANT:
        # Do NOT trust the location_id sent by frontend.
        #
        # Force the usage to the Camp Boss's location.
        # --------------------------------------------------

        usage_data.location_id = current_user.location_id

    # ======================================================
    # CREATE USAGE
    # ======================================================

    usage = create_catering_usage(
        db=db,
        usage_data=usage_data,
        current_user=current_user,
    )

    return usage_to_response(
        usage,
        db,
    )


# ==========================================================
# LIST CATERING USAGE
# ==========================================================

@router.get(
    "/usage",
    response_model=list[
        schemas.CateringUsageDisplay
    ],
)
def list_usage(
    location_id: int | None = Query(
        default=None
    ),

    start_date: date | None = Query(
        default=None
    ),

    end_date: date | None = Query(
        default=None
    ),

    db: Session = Depends(get_db),

    current_user: UserDisplaySchema = Depends(
        #role_required(USER_MANAGEMENT_ROLES)
        role_required(["camp_boss", "SUPER_ADMIN", "ADMIN"])
    ),
):

    usages = get_catering_usages(
        db=db,
        current_user=current_user,
        location_id=location_id,
        start_date=start_date,
        end_date=end_date,
    )

    return [
        usage_to_response(
            usage,
            db,
        )
        for usage in usages
    ]


# ==========================================================
# GET ONE USAGE
# ==========================================================

@router.get(
    "/usage/{usage_id}",
    response_model=schemas.CateringUsageDisplay,
)
def get_usage(
    usage_id: int,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):

    usage = get_catering_usage(
        db=db,
        usage_id=usage_id,
        current_user=current_user,
    )


    
    return usage_to_response(
        usage,
        db,
    )


# ==========================================================
# EDIT CATERING USAGE
# ==========================================================

@router.put(
    "/usage/{usage_id}",
    response_model=schemas.CateringUsageDisplay,
)
def update_usage(
    usage_id: int,
    usage_data: schemas.CateringUsageUpdate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):

    usage = update_catering_usage(
        db=db,
        usage_id=usage_id,
        usage_data=usage_data,
        current_user=current_user,
    )

    return usage_to_response(
        usage,
        db,
    )


# ==========================================================
# VOID CATERING USAGE
# ==========================================================

# ==========================================================
# VOID CATERING USAGE
# ==========================================================

@router.post(
    "/usage/{usage_id}/void",
    response_model=schemas.CateringUsageDisplay,
)
def void_usage(
    usage_id: int,
    void_data: schemas.CateringUsageVoid,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):

    usage = void_catering_usage(
        db=db,
        usage_id=usage_id,
        reason=void_data.reason,
        current_user=current_user,
    )

    return usage_to_response(
        usage,
        db,
    )



# ==========================================================
# CREATE LOCATION INVENTORY ADJUSTMENT
# ==========================================================

@router.post(
    "/location/adjust",
    response_model=location_schemas.LocationInventoryAdjustmentDisplay,
    status_code=status.HTTP_201_CREATED,
)
def adjust_location_inventory(
    adjustment_data:
        location_schemas.LocationInventoryAdjustmentCreate,

    business_id: Optional[int] = Query(
        None,
        description="Super admin can specify business"
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required([
            "admin",
            "super_admin"
        ])
    )
):
    try:

        # ======================================================
        # 1. RESOLVE BUSINESS
        # ======================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        if not effective_business_id:

            raise HTTPException(
                status_code=400,
                detail="Business could not be determined."
            )

        # ======================================================
        # 2. GET DATA
        # ======================================================

        location_id = adjustment_data.location_id
        item_id = adjustment_data.item_id

        qty = float(
            adjustment_data.quantity_adjusted
        )

        # ======================================================
        # 3. VALIDATE QUANTITY
        # ======================================================

        if qty == 0:

            raise HTTPException(
                status_code=400,
                detail="Adjustment cannot be zero."
            )

        # ======================================================
        # 4. VALIDATE LOCATION
        # ======================================================

        location = (
            db.query(
                location_models.Location
            )
            .filter(
                location_models.Location.id
                == location_id,

                location_models.Location.business_id
                == effective_business_id,

                location_models.Location.status
                == "active"
            )
            .first()
        )

        if not location:

            raise HTTPException(
                status_code=404,
                detail="Location not found or inactive."
            )

        # ======================================================
        # 5. VALIDATE ITEM
        # ======================================================

        item = (
            db.query(
                store_models.StoreItem
            )
            .filter(
                store_models.StoreItem.id
                == item_id,

                store_models.StoreItem.business_id
                == effective_business_id
            )
            .first()
        )

        if not item:

            raise HTTPException(
                status_code=404,
                detail="Item not found."
            )

        # ======================================================
        # 6. GET LOCATION INVENTORY
        # ======================================================

        inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.location_id
                == location_id,

                location_models.LocationInventory.item_id
                == item_id,

                location_models.LocationInventory.business_id
                == effective_business_id
            )
            .first()
        )

        # ======================================================
        # 7. CURRENT QUANTITY
        # ======================================================

        current_quantity = float(
            inventory.quantity
            if inventory
            else 0
        )

        # ======================================================
        # 8. NEGATIVE ADJUSTMENT
        #
        # -10 means remove 10.
        # ======================================================

        if qty < 0:

            quantity_to_remove = abs(qty)

            if quantity_to_remove > current_quantity:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot remove "
                        f"{quantity_to_remove} units "
                        f"from {item.name}. "
                        f"Current location stock is "
                        f"{current_quantity}."
                    )
                )

            if not inventory:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No inventory exists for this "
                        "item at the selected location."
                    )
                )

            inventory.quantity = (
                current_quantity
                - quantity_to_remove
            )

            remaining_quantity = 0

        # ======================================================
        # 9. POSITIVE ADJUSTMENT
        #
        # +10 means add 10.
        # ======================================================

        else:

            if inventory:

                inventory.quantity = (
                    current_quantity
                    + qty
                )

                remaining_quantity = qty

            else:

                inventory = (
                    location_models.LocationInventory(

                        business_id=effective_business_id,

                        location_id=location_id,

                        item_id=item_id,

                        opening_quantity=0,

                        quantity=qty,

                        unit_price=(
                            item.unit_price
                            if item.unit_price is not None
                            else 0
                        ),

                        received_at=now_wat(),

                        note=(
                            "Created through "
                            "location inventory adjustment"
                        )
                    )
                )

                db.add(inventory)

                remaining_quantity = qty

        # ======================================================
        # 10. CREATE ADJUSTMENT RECORD
        # ======================================================

        adjustment = (
            catering_models.LocationInventoryAdjustment(

                business_id=effective_business_id,

                location_id=location_id,

                item_id=item_id,

                quantity_adjusted=qty,

                remaining_quantity=remaining_quantity,

                reason=adjustment_data.reason,

                adjusted_by=current_user.username,

                adjusted_at=now_wat()
            )
        )

        db.add(adjustment)

        # ======================================================
        # 11. COMMIT
        # ======================================================

        db.commit()

        db.refresh(adjustment)

        # ======================================================
        # 12. RETURN
        # ======================================================

        return (
            catering_schemas.LocationInventoryAdjustmentDisplay(

                id=adjustment.id,

                location_id=location.id,

                location_name=location.name,

                item_id=item.id,

                item_name=item.name,

                unit=item.unit,

                category_name=(
                    item.category.name
                    if item.category
                    else "Uncategorized"
                ),

                item_type=item.item_type,

                quantity_adjusted=(
                    adjustment.quantity_adjusted
                ),

                remaining_quantity=(
                    adjustment.remaining_quantity
                ),

                reason=adjustment.reason,

                adjusted_by=adjustment.adjusted_by,

                adjusted_at=adjustment.adjusted_at,
            )
        )

    except HTTPException:

        db.rollback()

        raise

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Location inventory adjustment failed: "
                f"{str(e)}"
            )
        )


# ==========================================================
# LIST LOCATION INVENTORY ADJUSTMENTS
# ==========================================================

@router.get(
    "/location/adjustments",
    response_model=list[
        catering_schemas.LocationInventoryAdjustmentDisplay
    ]
)
def list_location_inventory_adjustments(

    location_id: Optional[int] = Query(
        None
    ),

    item_id: Optional[int] = Query(
        None
    ),

    start_date: Optional[datetime] = Query(
        None
    ),

    end_date: Optional[datetime] = Query(
        None
    ),

    business_id: Optional[int] = Query(
        None
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required([
            "store",
            "location",
            "admin",
            "super_admin"
        ])
    )
):

    try:

        # ======================================================
        # 1. RESOLVE BUSINESS
        # ======================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        if not effective_business_id:

            raise HTTPException(
                status_code=400,
                detail="Business could not be determined."
            )

        # ======================================================
        # 2. BASE QUERY
        # ======================================================

        query = (
            db.query(
                catering_models.LocationInventoryAdjustment
            )
            .filter(
                catering_models
                .LocationInventoryAdjustment
                .business_id
                == effective_business_id
            )
        )

        # ======================================================
        # 3. LOCATION FILTER
        # ======================================================

        if location_id is not None:

            query = query.filter(
                catering_models
                .LocationInventoryAdjustment
                .location_id
                == location_id
            )

        # ======================================================
        # 4. ITEM FILTER
        # ======================================================

        if item_id is not None:

            query = query.filter(
                catering_models
                .LocationInventoryAdjustment
                .item_id
                == item_id
            )

        # ======================================================
        # 5. START DATE
        # ======================================================

        if start_date:

            query = query.filter(
                catering_models
                .LocationInventoryAdjustment
                .adjusted_at
                >= start_date
            )

        # ======================================================
        # 6. END DATE
        # ======================================================

        if end_date:

            query = query.filter(
                catering_models
                .LocationInventoryAdjustment
                .adjusted_at
                <= end_date
            )

        # ======================================================
        # 7. GET RECORDS
        # ======================================================

        adjustments = (
            query
            .order_by(
                catering_models
                .LocationInventoryAdjustment
                .adjusted_at
                .desc(),

                catering_models
                .LocationInventoryAdjustment
                .id
                .desc()
            )
            .all()
        )

        # ======================================================
        # 8. BUILD RESPONSE
        # ======================================================

        results = []

        for adjustment in adjustments:

            location = (
                db.query(
                    location_models.Location
                )
                .filter(
                    location_models.Location.id
                    == adjustment.location_id,

                    location_models.Location.business_id
                    == effective_business_id
                )
                .first()
            )

            item = (
                db.query(
                    store_models.StoreItem
                )
                .filter(
                    store_models.StoreItem.id
                    == adjustment.item_id,

                    store_models.StoreItem.business_id
                    == effective_business_id
                )
                .first()
            )

            if not location or not item:

                continue

            results.append(
                catering_schemas
                .LocationInventoryAdjustmentDisplay(

                    id=adjustment.id,

                    location_id=(
                        adjustment.location_id
                    ),

                    location_name=(
                        location.name
                    ),

                    item_id=(
                        adjustment.item_id
                    ),

                    item_name=(
                        item.name
                    ),

                    unit=(
                        item.unit
                    ),

                    category_name=(
                        item.category.name
                        if item.category
                        else "Uncategorized"
                    ),

                    item_type=(
                        item.item_type
                    ),

                    quantity_adjusted=(
                        adjustment.quantity_adjusted
                    ),

                    remaining_quantity=(
                        adjustment.remaining_quantity
                    ),

                    reason=(
                        adjustment.reason
                    ),

                    adjusted_by=(
                        adjustment.adjusted_by
                    ),

                    adjusted_at=(
                        adjustment.adjusted_at
                    ),
                )
            )

        return results

    except HTTPException:

        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to retrieve location "
                "inventory adjustments: "
                f"{str(e)}"
            )
        )



# ==========================================================
# UPDATE LOCATION INVENTORY ADJUSTMENT
# ==========================================================

@router.put(
    "/location/adjustments/{adjustment_id}",
    response_model=location_schemas.LocationInventoryAdjustmentDisplay
)
def update_location_inventory_adjustment(

    adjustment_id: int,

    data:
        location_schemas.LocationInventoryAdjustmentCreate,

    business_id: Optional[int] = Query(
        None,
        description="Super admin can specify business"
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required([
            "admin",
            "super_admin"
        ])
    )
):

    try:

        # ======================================================
        # 1. RESOLVE BUSINESS
        # ======================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        if not effective_business_id:

            raise HTTPException(
                status_code=400,
                detail="Business could not be determined."
            )

        # ======================================================
        # 2. GET ADJUSTMENT
        # ======================================================

        adjustment = (
            db.query(
                catering_models
                .LocationInventoryAdjustment
            )
            .filter(
                catering_models
                .LocationInventoryAdjustment
                .id
                == adjustment_id,

                catering_models
                .LocationInventoryAdjustment
                .business_id
                == effective_business_id
            )
            .first()
        )

        if not adjustment:

            raise HTTPException(
                status_code=404,
                detail="Adjustment not found."
            )

        # ======================================================
        # 3. VALIDATE NEW LOCATION
        # ======================================================

        new_location = (
            db.query(
                location_models.Location
            )
            .filter(
                location_models.Location.id
                == data.location_id,

                location_models.Location.business_id
                == effective_business_id,

                location_models.Location.status
                == "active"
            )
            .first()
        )

        if not new_location:

            raise HTTPException(
                status_code=404,
                detail="Location not found or inactive."
            )

        # ======================================================
        # 4. VALIDATE NEW ITEM
        # ======================================================

        new_item = (
            db.query(
                store_models.StoreItem
            )
            .filter(
                store_models.StoreItem.id
                == data.item_id,

                store_models.StoreItem.business_id
                == effective_business_id
            )
            .first()
        )

        if not new_item:

            raise HTTPException(
                status_code=404,
                detail="Item not found."
            )

        # ======================================================
        # 5. VALIDATE NEW QUANTITY
        # ======================================================

        new_qty = float(
            data.quantity_adjusted
        )

        if new_qty == 0:

            raise HTTPException(
                status_code=400,
                detail="Adjustment cannot be zero."
            )

        # ======================================================
        # 6. GET OLD INVENTORY
        # ======================================================

        old_inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.location_id
                == adjustment.location_id,

                location_models.LocationInventory.item_id
                == adjustment.item_id,

                location_models.LocationInventory.business_id
                == effective_business_id
            )
            .first()
        )

        if not old_inventory:

            raise HTTPException(
                status_code=400,
                detail=(
                    "The inventory record associated with "
                    "this adjustment no longer exists."
                )
            )

        old_qty = float(
            adjustment.quantity_adjusted
        )

        # ======================================================
        # 7. REVERSE OLD ADJUSTMENT
        # ======================================================

        if old_qty > 0:

            old_remaining = float(
                adjustment.remaining_quantity or 0
            )

            # --------------------------------------------------
            # If the added quantity has already been consumed,
            # don't allow changing the adjustment.
            # --------------------------------------------------

            if old_remaining < old_qty:

                used_quantity = (
                    old_qty
                    - old_remaining
                )

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot edit this adjustment because "
                        f"{used_quantity} unit(s) from the "
                        "original adjustment have already "
                        "been used."
                    )
                )

            old_inventory.quantity = (
                float(old_inventory.quantity or 0)
                - old_qty
            )

        else:

            # --------------------------------------------------
            # Old negative adjustment removed stock.
            #
            # Restore that stock.
            # --------------------------------------------------

            old_inventory.quantity = (
                float(old_inventory.quantity or 0)
                + abs(old_qty)
            )

        # ======================================================
        # 8. VALIDATE NEW TARGET INVENTORY
        # ======================================================

        new_inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.location_id
                == data.location_id,

                location_models.LocationInventory.item_id
                == data.item_id,

                location_models.LocationInventory.business_id
                == effective_business_id
            )
            .first()
        )

        # ======================================================
        # 9. APPLY NEW ADJUSTMENT
        # ======================================================

        if new_qty < 0:

            quantity_to_remove = abs(
                new_qty
            )

            available_quantity = float(
                new_inventory.quantity
                if new_inventory
                else 0
            )

            if (
                quantity_to_remove
                > available_quantity
            ):

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot remove "
                        f"{quantity_to_remove} units "
                        f"from {new_item.name}. "
                        f"Available at location: "
                        f"{available_quantity}"
                    )
                )

            if not new_inventory:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No inventory exists for this item "
                        "at the selected location."
                    )
                )

            new_inventory.quantity = (
                available_quantity
                - quantity_to_remove
            )

            new_remaining_quantity = 0

        else:

            if new_inventory:

                new_inventory.quantity = (
                    float(
                        new_inventory.quantity
                        or 0
                    )
                    + new_qty
                )

            else:

                new_inventory = (
                    location_models.LocationInventory(

                        business_id=(
                            effective_business_id
                        ),

                        location_id=(
                            data.location_id
                        ),

                        item_id=(
                            data.item_id
                        ),

                        opening_quantity=0,

                        quantity=new_qty,

                        unit_price=(
                            new_item.unit_price
                            if new_item.unit_price
                            is not None
                            else 0
                        ),

                        received_at=now_wat(),

                        note=(
                            "Created through "
                            "location inventory adjustment"
                        )
                    )
                )

                db.add(new_inventory)

            new_remaining_quantity = new_qty

        # ======================================================
        # 10. UPDATE ADJUSTMENT RECORD
        # ======================================================

        adjustment.location_id = (
            data.location_id
        )

        adjustment.item_id = (
            data.item_id
        )

        adjustment.quantity_adjusted = (
            new_qty
        )

        adjustment.remaining_quantity = (
            new_remaining_quantity
        )

        adjustment.reason = (
            data.reason
        )

        adjustment.adjusted_by = (
            current_user.username
        )

        adjustment.adjusted_at = (
            now_wat()
        )

        adjustment.business_id = (
            effective_business_id
        )

        db.add(adjustment)

        # ======================================================
        # 11. COMMIT
        # ======================================================

        db.commit()

        db.refresh(adjustment)

        # ======================================================
        # 12. RETURN
        # ======================================================

        return (
            location_schemas
            .LocationInventoryAdjustmentDisplay(

                id=adjustment.id,

                location_id=(
                    new_location.id
                ),

                location_name=(
                    new_location.name
                ),

                item_id=(
                    new_item.id
                ),

                item_name=(
                    new_item.name
                ),

                unit=(
                    new_item.unit
                ),

                category_name=(
                    new_item.category.name
                    if new_item.category
                    else "Uncategorized"
                ),

                item_type=(
                    new_item.item_type
                ),

                quantity_adjusted=(
                    adjustment.quantity_adjusted
                ),

                remaining_quantity=(
                    adjustment.remaining_quantity
                ),

                reason=(
                    adjustment.reason
                ),

                adjusted_by=(
                    adjustment.adjusted_by
                ),

                adjusted_at=(
                    adjustment.adjusted_at
                ),
            )
        )

    except HTTPException:

        db.rollback()

        raise

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to update location "
                f"adjustment: {str(e)}"
            )
        )


# ==========================================================
# DELETE LOCATION INVENTORY ADJUSTMENT
# ==========================================================

@router.delete(
    "/location/adjustments/{adjustment_id}"
)
def delete_location_inventory_adjustment(

    adjustment_id: int,

    business_id: Optional[int] = Query(
        None
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required([
            "admin",
            "super_admin"
        ])
    )
):

    try:

        # ======================================================
        # 1. RESOLVE BUSINESS
        # ======================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        if not effective_business_id:

            raise HTTPException(
                status_code=400,
                detail="Business could not be determined."
            )

        # ======================================================
        # 2. FIND ADJUSTMENT
        # ======================================================

        adjustment = (
            db.query(
                catering_models
                .LocationInventoryAdjustment
            )
            .filter(
                catering_models
                .LocationInventoryAdjustment
                .id
                == adjustment_id,

                catering_models
                .LocationInventoryAdjustment
                .business_id
                == effective_business_id
            )
            .first()
        )

        if not adjustment:

            raise HTTPException(
                status_code=404,
                detail="Adjustment not found."
            )

        # ======================================================
        # 3. GET INVENTORY
        # ======================================================

        inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.location_id
                == adjustment.location_id,

                location_models.LocationInventory.item_id
                == adjustment.item_id,

                location_models.LocationInventory.business_id
                == effective_business_id
            )
            .first()
        )

        if not inventory:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Location inventory record "
                    "no longer exists."
                )
            )

        current_quantity = float(
            inventory.quantity or 0
        )

        adjustment_qty = float(
            adjustment.quantity_adjusted
        )

        # ======================================================
        # 4. POSITIVE ADJUSTMENT
        #
        # +10 added 10.
        #
        # We can only delete it if the entire 10 units
        # are still available.
        # ======================================================

        if adjustment_qty > 0:

            remaining_quantity = float(
                adjustment.remaining_quantity or 0
            )

            if remaining_quantity < adjustment_qty:

                used_quantity = (
                    adjustment_qty
                    - remaining_quantity
                )

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot delete this adjustment "
                        "because "
                        f"{used_quantity} unit(s) have "
                        "already been used."
                    )
                )

            if current_quantity < adjustment_qty:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot delete this adjustment "
                        "because the current location "
                        "stock is insufficient to "
                        "reverse it."
                    )
                )

            inventory.quantity = (
                current_quantity
                - adjustment_qty
            )

        # ======================================================
        # 5. NEGATIVE ADJUSTMENT
        #
        # -10 removed 10.
        #
        # Delete means restore the 10.
        # ======================================================

        else:

            quantity_to_restore = abs(
                adjustment_qty
            )

            inventory.quantity = (
                current_quantity
                + quantity_to_restore
            )

        # ======================================================
        # 6. SAVE INFORMATION
        # ======================================================

        item_id = adjustment.item_id

        location_id = adjustment.location_id

        quantity_adjusted = (
            adjustment.quantity_adjusted
        )

        # ======================================================
        # 7. DELETE ADJUSTMENT
        # ======================================================

        db.delete(adjustment)

        # ======================================================
        # 8. COMMIT
        # ======================================================

        db.commit()

        # ======================================================
        # 9. RESPONSE
        # ======================================================

        return {
            "message": (
                "Location adjustment deleted successfully."
            ),

            "adjustment_id": adjustment_id,

            "location_id": location_id,

            "item_id": item_id,

            "quantity_adjusted": quantity_adjusted,

            "business_id": effective_business_id,
        }

    except HTTPException:

        db.rollback()

        raise

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to delete location "
                f"adjustment: {str(e)}"
            )
        )


# ==========================================================
# LOCATION STOCK BALANCE
# ==========================================================

@router.get(
    "/location-balance-stock",
    response_model=list[
        location_schemas.LocationStockBalance
    ]
)
def get_location_stock_balance(
    location_id: Optional[int] = Query(
        None,
        description="Filter by location"
    ),

    item_id: Optional[int] = Query(
        None,
        description="Filter by item"
    ),

    category_id: Optional[int] = Query(
        None,
        description="Filter by category"
    ),

    item_type: Optional[str] = Query(
        None,
        description="Filter by item type"
    ),

    search: Optional[str] = Query(
        None,
        description="Search by item, category or location"
    ),

    business_id: Optional[int] = Query(
        None,
        description="Business ID (Super Admin only)"
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required([
            "store",
            "location",
            "admin",
            "super_admin"
        ])
    )
):

    try:

        # ==========================================================
        # 1. RESOLVE BUSINESS
        #
        # Do NOT use resolve_business_id() here because your
        # current user.roles contains RoleSimple objects.
        #
        # Business users are automatically restricted to their
        # own business.
        #
        # Super Admin has business_id == None and must provide
        # business_id when viewing a specific business.
        # ==========================================================

        if current_user.business_id is not None:

            effective_business_id = current_user.business_id

        else:

            if business_id is None:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "business_id is required for "
                        "Super Admin."
                    )
                )

            effective_business_id = business_id

        # ==========================================================
        # 2. OPENING STOCK
        #
        # Opening stock is now stored directly on
        # LocationInventory.opening_quantity.
        #
        # We keep it per:
        #
        #     location + item
        # ==========================================================

        opening_query = (
            db.query(
                location_models.LocationInventory.location_id,

                location_models.LocationInventory.item_id,

                func.coalesce(
                    location_models.LocationInventory.opening_quantity,
                    0
                ).label(
                    "opening_stock"
                )
            )
            .filter(
                location_models.LocationInventory.business_id
                == effective_business_id
            )
            .all()
        )

        opening_map = {

            (
                row.location_id,
                row.item_id
            ): float(
                row.opening_stock or 0
            )

            for row in opening_query
        }

        # ==========================================================
        # 3. TOTAL RECEIVED
        #
        # Stock received by the location from the central store.
        #
        # StoreIssue
        #     -> StoreIssueItem
        #
        # Every quantity issued to a location is received by that
        # location.
        # ==========================================================

        received_query = (
            db.query(

                store_models.StoreIssue.location_id.label(
                    "location_id"
                ),

                store_models.StoreIssueItem.item_id.label(
                    "item_id"
                ),

                func.coalesce(
                    func.sum(
                        store_models.StoreIssueItem.quantity
                    ),
                    0
                ).label(
                    "total_received"
                )
            )

            .join(
                store_models.StoreIssue,

                store_models.StoreIssue.id
                ==
                store_models.StoreIssueItem.issue_id
            )

            .filter(
                store_models.StoreIssue.business_id
                == effective_business_id
            )

            .group_by(
                store_models.StoreIssue.location_id,

                store_models.StoreIssueItem.item_id
            )

            .all()
        )

        received_map = {

            (
                row.location_id,
                row.item_id
            ): float(
                row.total_received or 0
            )

            for row in received_query
        }

        # ==========================================================
        # 4. TOTAL ADJUSTED
        #
        # Adjustment convention:
        #
        #   +10 = ADD 10 STOCK
        #   -10 = REMOVE 10 STOCK
        #
        # Therefore SUM(quantity_adjusted) gives the NET
        # adjustment effect.
        # ==========================================================

        adjustment_query = (
            db.query(

                catering_models
                .LocationInventoryAdjustment
                .location_id
                .label("location_id"),

                catering_models
                .LocationInventoryAdjustment
                .item_id
                .label("item_id"),

                func.coalesce(
                    func.sum(
                        catering_models
                        .LocationInventoryAdjustment
                        .quantity_adjusted
                    ),
                    0
                ).label(
                    "total_adjusted"
                )
            )

            .filter(
                catering_models
                .LocationInventoryAdjustment
                .business_id
                == effective_business_id
            )

            .group_by(
                catering_models
                .LocationInventoryAdjustment
                .location_id,

                catering_models
                .LocationInventoryAdjustment
                .item_id
            )

            .all()
        )

        adjustment_map = {

            (
                row.location_id,
                row.item_id
            ): float(
                row.total_adjusted or 0
            )

            for row in adjustment_query
        }

        # ==========================================================
        # 5. TOTAL USED / CONSUMED
        #
        # Catering usage represents stock consumed at a location.
        #
        # Only non-voided usage is counted.
        # ==========================================================

        usage_query = (
            db.query(

                catering_models
                .CateringUsageItem
                .location_id
                .label("location_id"),

                catering_models
                .CateringUsageItem
                .item_id
                .label("item_id"),

                func.coalesce(
                    func.sum(
                        catering_models
                        .CateringUsageItem
                        .quantity_used
                    ),
                    0
                ).label(
                    "total_used"
                )
            )

            .join(
                catering_models.CateringUsage,

                catering_models.CateringUsage.id
                ==
                catering_models.CateringUsageItem.usage_id
            )

            .filter(
                catering_models
                .CateringUsage
                .business_id
                ==
                effective_business_id,

                catering_models
                .CateringUsage
                .status
                !=
                "voided"
            )

            .group_by(
                catering_models
                .CateringUsageItem
                .location_id,

                catering_models
                .CateringUsageItem
                .item_id
            )

            .all()
        )

        used_map = {

            (
                row.location_id,
                row.item_id
            ): float(
                row.total_used or 0
            )

            for row in usage_query
        }

        # ==========================================================
        # 6. GET LOCATION INVENTORY
        #
        # This gives:
        #
        # - current quantity
        # - location unit price
        # - opening quantity
        #
        # We primarily use opening_quantity for the balance
        # calculation and current quantity as a reference.
        # ==========================================================

        inventory_query = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.business_id
                == effective_business_id
            )
        )

        if location_id is not None:

            inventory_query = inventory_query.filter(
                location_models
                .LocationInventory
                .location_id
                ==
                location_id
            )

        if item_id is not None:

            inventory_query = inventory_query.filter(
                location_models
                .LocationInventory
                .item_id
                ==
                item_id
            )

        inventories = inventory_query.all()

        inventory_map = {

            (
                inventory.location_id,
                inventory.item_id
            ): inventory

            for inventory in inventories
        }

        # ==========================================================
        # 7. GET LOCATIONS
        # ==========================================================

        locations_query = (
            db.query(
                location_models.Location
            )
            .filter(
                location_models.Location.business_id
                ==
                effective_business_id
            )
        )

        if location_id is not None:

            locations_query = locations_query.filter(
                location_models.Location.id
                ==
                location_id
            )

        locations = (
            locations_query
            .order_by(
                location_models.Location.name.asc()
            )
            .all()
        )

        # ==========================================================
        # 8. GET STORE ITEMS
        # ==========================================================

        items_query = (
            db.query(

                store_models.StoreItem.id.label(
                    "item_id"
                ),

                store_models.StoreItem.name.label(
                    "item_name"
                ),

                store_models.StoreItem.unit.label(
                    "unit"
                ),

                store_models.StoreItem.item_type.label(
                    "item_type"
                ),

                store_models.StoreItem.unit_price.label(
                    "default_unit_price"
                ),

                store_models.StoreCategory.name.label(
                    "category_name"
                )
            )

            .outerjoin(
                store_models.StoreCategory,

                store_models.StoreItem.category_id
                ==
                store_models.StoreCategory.id
            )

            .filter(
                store_models.StoreItem.business_id
                ==
                effective_business_id
            )
        )

        # ==========================================================
        # 9. ITEM FILTERS
        # ==========================================================

        if category_id is not None:

            items_query = items_query.filter(
                store_models.StoreItem.category_id
                ==
                category_id
            )

        if item_type:

            items_query = items_query.filter(
                func.lower(
                    store_models.StoreItem.item_type
                )
                ==
                item_type.lower()
            )

        if item_id is not None:

            items_query = items_query.filter(
                store_models.StoreItem.id
                ==
                item_id
            )

        if search:

            search_value = f"%{search}%"

            items_query = items_query.filter(

                store_models.StoreItem.name.ilike(
                    search_value
                )

                |

                store_models.StoreCategory.name.ilike(
                    search_value
                )
            )

        items = (
            items_query
            .order_by(
                store_models.StoreItem.name.asc()
            )
            .all()
        )

        # ==========================================================
        # 10. BUILD RESPONSE
        # ==========================================================

        response = []

        for location in locations:

            for item in items:

                key = (
                    location.id,
                    item.item_id
                )

                inventory = inventory_map.get(key)

                # ==================================================
                # 10.1 MOVEMENT TOTALS
                # ==================================================

                opening_stock = opening_map.get(
                    key,
                    0
                )

                total_received = received_map.get(
                    key,
                    0
                )

                total_used = used_map.get(
                    key,
                    0
                )

                total_adjusted = adjustment_map.get(
                    key,
                    0
                )

                # ==================================================
                # 10.2 ONLY SHOW ITEMS WITH ACTIVITY
                #
                # This prevents every StoreItem from appearing
                # under every location.
                # ==================================================

                has_activity = (

                    inventory is not None

                    or opening_stock != 0

                    or total_received != 0

                    or total_used != 0

                    or total_adjusted != 0
                )

                if not has_activity:

                    continue

                # ==================================================
                # 10.3 CURRENT UNIT PRICE
                #
                # First use the location inventory price.
                # Otherwise use the StoreItem default price.
                # ==================================================

                if (
                    inventory
                    and inventory.unit_price is not None
                ):

                    current_unit_price = float(
                        inventory.unit_price
                    )

                else:

                    current_unit_price = float(
                        item.default_unit_price or 0
                    )

                # ==================================================
                # 10.4 TRUE CURRENT BALANCE
                #
                # Opening
                # + Received
                # + Adjustments
                # - Used
                # = Balance
                # ==================================================

                balance = (
                    opening_stock
                    + total_received
                    + total_adjusted
                    - total_used
                )

                # ==================================================
                # 10.5 PREVENT NEGATIVE DISPLAY
                # ==================================================

                if abs(balance) < 0.000001:

                    balance = 0

                if balance < 0:

                    balance = 0

                # ==================================================
                # 10.6 TOTAL BALANCE VALUE
                # ==================================================

                balance_total_amount = round(
                    balance
                    *
                    current_unit_price,
                    2
                )

                # ==================================================
                # 10.7 RESPONSE
                # ==================================================

                response.append(

                    location_schemas.LocationStockBalance(

                        location_id=location.id,

                        location_name=location.name,

                        item_id=item.item_id,

                        item_name=item.item_name,

                        category_name=(
                            item.category_name
                            or "Uncategorized"
                        ),

                        item_type=item.item_type,

                        unit=item.unit,

                        opening_stock=round(
                            opening_stock,
                            4
                        ),

                        total_received=round(
                            total_received,
                            4
                        ),

                        total_used=round(
                            total_used,
                            4
                        ),

                        total_adjusted=round(
                            total_adjusted,
                            4
                        ),

                        balance=round(
                            balance,
                            4
                        ),

                        current_unit_price=(
                            current_unit_price
                        ),

                        balance_total_amount=(
                            balance_total_amount
                        ),
                    )
                )

        # ==========================================================
        # 11. RETURN
        # ==========================================================

        return response

    except HTTPException:

        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to retrieve location stock "
                f"balance: {str(e)}"
            )
        )
