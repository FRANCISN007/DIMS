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

from app.core.roles import USER_MANAGEMENT_ROLES1
from app.store import schemas as store_schemas
from app.store import models as store_models


from app.locations import models as location_models
from app.locations import schemas as location_schemas
from app.store import models as store_models


from app.catering import schemas
from typing import Optional
from app.users import schemas as user_schemas


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

from app.core.tenant import (
    resolve_business_id,
    
)


from app.core.location import (
    is_camp_boss,
    resolve_location_id,
    validate_location_access,
    apply_location_access_filter,
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

@router.post(
    "/usage",
    response_model=schemas.CateringUsageDisplay,
    status_code=status.HTTP_201_CREATED,
)
def create_usage(

    usage_data: schemas.CateringUsageCreate,

    db: Session = Depends(get_db),

    current_user: UserDisplaySchema = Depends(
        role_required(
            [
                "store",
                "camp_boss",
                "manager",
                "admin",
            ]
        )
    ),
):

    # ======================================================
    # 1. RESOLVE TENANT
    # ======================================================

    business_id = resolve_business_id(
        current_user
    )

    # ======================================================
    # 2. CREATE USAGE
    # ======================================================

    usage = create_catering_usage(
        db=db,
        usage_data=usage_data,
        current_user=current_user,
        business_id=business_id,
    )

    # ======================================================
    # 3. RESPONSE
    # ======================================================

    return usage_to_response(
        usage,
        db,
    )




# ==========================================================
# LIST CATERING USAGE
# ==========================================================

@router.get(
    "/usage",
    response_model=schemas.CateringUsageListResponse,
)
def list_usage(
    location_id: Optional[int] = Query(
        default=None
    ),

    # ======================================================
    # ITEM FILTER
    # ======================================================

    item_id: Optional[int] = Query(
        default=None,
        description="Filter catering usage by item"
    ),

    start_date: Optional[date] = Query(
        default=None
    ),

    end_date: Optional[date] = Query(
        default=None
    ),

    db: Session = Depends(get_db),

    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES1)
    ),
):

    # ======================================================
    # RESOLVE BUSINESS
    # ======================================================

    business_id = resolve_business_id(
        current_user
    )

    # ======================================================
    # RESOLVE LOCATION ACCESS
    # ======================================================

    location_id = resolve_location_id(
        current_user,
        location_id,
    )

    # ======================================================
    # VALIDATE SELECTED LOCATION
    # ======================================================

    if location_id is not None:

        validate_location_access(
            db=db,
            current_user=current_user,
            location_id=location_id,
            business_id=business_id,
        )

    # ======================================================
    # VALIDATE ITEM
    # ======================================================

    selected_item = None

    if item_id is not None:

        selected_item = (
            db.query(StoreItem)
            .filter(
                StoreItem.id == item_id,

                StoreItem.business_id
                == business_id,
            )
            .first()
        )

        if not selected_item:

            raise HTTPException(
                status_code=404,
                detail="Item not found"
            )

    # ======================================================
    # GET USAGE
    # ======================================================

    usages = get_catering_usages(
        db=db,
        current_user=current_user,
        business_id=business_id,
        location_id=location_id,
        item_id=item_id,
        start_date=start_date,
        end_date=end_date,
    )

    # ======================================================
    # CONVERT USAGE TO RESPONSE
    # ======================================================

    usage_responses = [
        usage_to_response(
            usage,
            db,
        )
        for usage in usages
    ]

    # ======================================================
    # TOTAL ITEM QUANTITY
    # ======================================================

    total_response = None

    if item_id is not None:

        total_quantity = 0

        for usage in usages:

            for usage_item in usage.items:

                if usage_item.item_id == item_id:

                    total_quantity += float(
                        usage_item.quantity_used or 0
                    )

        total_response = (
            schemas.CateringUsageTotalDisplay(
                item_id=item_id,

                item_name=(
                    selected_item.name
                    if selected_item
                    else None
                ),

                unit=(
                    selected_item.unit
                    if selected_item
                    else None
                ),

                total_quantity=total_quantity,
            )
        )

    # ======================================================
    # RESPONSE
    # ======================================================

    return schemas.CateringUsageListResponse(
        usages=usage_responses,
        total=total_response,
    )



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
        role_required(USER_MANAGEMENT_ROLES1)
    ),
):

    # ======================================================
    # RESOLVE BUSINESS
    # ======================================================

    business_id = resolve_business_id(
        current_user
    )

    # ======================================================
    # GET USAGE
    # ======================================================

    usage = get_catering_usage(
        db=db,
        usage_id=usage_id,
        current_user=current_user,
        business_id=business_id,
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
        role_required(USER_MANAGEMENT_ROLES1)
    ),
):

    # ======================================================
    # RESOLVE BUSINESS
    # ======================================================

    business_id = resolve_business_id(
        current_user
    )

    # ======================================================
    # UPDATE USAGE
    # ======================================================

    usage = update_catering_usage(
        db=db,
        usage_id=usage_id,
        usage_data=usage_data,
        current_user=current_user,
        business_id=business_id,
    )

    return usage_to_response(
        usage,
        db,
    )



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
        role_required(USER_MANAGEMENT_ROLES1)
    ),
):

    # ======================================================
    # RESOLVE BUSINESS
    # ======================================================

    business_id = resolve_business_id(
        current_user
    )

    # ======================================================
    # VOID USAGE
    # ======================================================

    usage = void_catering_usage(
        db=db,
        usage_id=usage_id,
        reason=void_data.reason,
        current_user=current_user,
        business_id=business_id,
    )

    return usage_to_response(
        usage,
        db,
    )



# ==========================================================
# CREATE LOCATION INVENTORY ADJUSTMENT
# ==========================================================

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
        description="Super Admin can specify business",
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES1)
    ),
):
    try:

        # ======================================================
        # 1. RESOLVE BUSINESS
        # ======================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id,
        )

        if not effective_business_id:
            raise HTTPException(
                status_code=400,
                detail="Business could not be determined.",
            )

        # ======================================================
        # 2. RESOLVE LOCATION
        # ======================================================

        location_id = resolve_location_id(
            current_user,
            adjustment_data.location_id,
        )

        if location_id is None:
            raise HTTPException(
                status_code=400,
                detail="Location is required.",
            )

        # ======================================================
        # 3. ITEM
        # ======================================================

        item_id = adjustment_data.item_id

        # ======================================================
        # 4. QUANTITY
        # ======================================================

        qty = float(
            adjustment_data.quantity_adjusted
        )

        if qty == 0:
            raise HTTPException(
                status_code=400,
                detail="Adjustment cannot be zero.",
            )

        # ======================================================
        # 5. VALIDATE LOCATION
        # ======================================================

        location = (
            db.query(location_models.Location)
            .filter(
                location_models.Location.id == location_id,
                location_models.Location.business_id
                == effective_business_id,
                location_models.Location.status == "active",
            )
            .first()
        )

        if not location:
            raise HTTPException(
                status_code=404,
                detail="Location not found or inactive.",
            )

        # ======================================================
        # 6. VALIDATE ITEM
        # ======================================================

        item = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.id == item_id,
                store_models.StoreItem.business_id
                == effective_business_id,
            )
            .first()
        )

        if not item:
            raise HTTPException(
                status_code=404,
                detail="Item not found.",
            )

        # ======================================================
        # 7. GET / LOCK INVENTORY
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
                == effective_business_id,
            )
            .with_for_update()
            .first()
        )

        current_quantity = float(
            inventory.quantity
            if inventory
            else 0
        )

        # ======================================================
        # 8. NEGATIVE ADJUSTMENT
        # ======================================================

        if qty < 0:

            quantity_to_remove = abs(qty)

            if not inventory:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No inventory exists for this "
                        "item at the selected location."
                    ),
                )

            if quantity_to_remove > current_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot remove "
                        f"{quantity_to_remove} units "
                        f"from {item.name}. "
                        f"Current location stock is "
                        f"{current_quantity}."
                    ),
                )

            inventory.quantity = (
                current_quantity
                - quantity_to_remove
            )

            remaining_quantity = 0

        # ======================================================
        # 9. POSITIVE ADJUSTMENT
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
                        ),
                    )
                )

                db.add(inventory)

                remaining_quantity = qty

        # ======================================================
        # 10. CREATE ADJUSTMENT
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
                adjusted_at=now_wat(),
            )
        )

        db.add(adjustment)

        # ======================================================
        # 11. COMMIT
        # ======================================================

        db.commit()
        db.refresh(adjustment)

        # ======================================================
        # 12. RESPONSE
        # ======================================================

        return (
            location_schemas
            .LocationInventoryAdjustmentDisplay(
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
            ),
        )

    

# ==========================================================
# LIST LOCATION INVENTORY ADJUSTMENTS
# ==========================================================

@router.get(
    "/location/adjustments",
    response_model=list[
        catering_schemas.LocationInventoryAdjustmentDisplay
    ],
)
def list_location_inventory_adjustments(
    location_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    business_id: Optional[int] = Query(
        None,
        description="Super Admin can specify business",
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES1)
    ),
):
    """
    List location inventory adjustment history.

    Business rules:

    Super Admin:
        - Must specify/select a business when required.
        - Can view adjustments for that business.
        - Can filter by location and item.

    Business users:
        - Can only view adjustments belonging to their business.

    Camp Boss:
        - Can only view adjustments for their assigned location.
        - Any location_id supplied by the frontend is ignored.

    Date filtering:
        start_date:
            Records from this datetime onward.

        end_date:
            Records up to this datetime.
    """

    try:

        # ======================================================
        # 1. RESOLVE BUSINESS
        # ======================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id,
        )

        if effective_business_id is None:
            raise HTTPException(
                status_code=400,
                detail="Business could not be determined.",
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
        # 3. CAMP BOSS LOCATION RESTRICTION
        # ======================================================

        if is_camp_boss(current_user):

            user_location_id = current_user.location_id

            if user_location_id is None:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Camp Boss is not assigned "
                        "to a location."
                    ),
                )

            # --------------------------------------------------
            # Ignore location_id supplied by frontend.
            # --------------------------------------------------

            query = query.filter(
                catering_models
                .LocationInventoryAdjustment
                .location_id
                == user_location_id
            )

        # ======================================================
        # 4. LOCATION FILTER
        # ======================================================

        elif location_id is not None:

            query = query.filter(
                catering_models
                .LocationInventoryAdjustment
                .location_id
                == location_id
            )

        # ======================================================
        # 5. ITEM FILTER
        # ======================================================

        if item_id is not None:

            query = query.filter(
                catering_models
                .LocationInventoryAdjustment
                .item_id
                == item_id
            )

        # ======================================================
        # 6. START DATE FILTER
        # ======================================================

        if start_date is not None:

            query = query.filter(
                catering_models
                .LocationInventoryAdjustment
                .adjusted_at
                >= start_date
            )

        # ======================================================
        # 7. END DATE FILTER
        # ======================================================

        if end_date is not None:

            query = query.filter(
                catering_models
                .LocationInventoryAdjustment
                .adjusted_at
                <= end_date
            )

        # ======================================================
        # 8. ORDER
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
                .desc(),
            )
            .all()
        )

        # ======================================================
        # 9. BUILD RESPONSE
        # ======================================================

        results = []

        for adjustment in adjustments:

            # --------------------------------------------------
            # LOCATION
            # --------------------------------------------------

            location = (
                db.query(
                    location_models.Location
                )
                .filter(
                    location_models.Location.id
                    == adjustment.location_id,

                    location_models.Location.business_id
                    == effective_business_id,
                )
                .first()
            )

            if not location:
                continue

            # --------------------------------------------------
            # STORE ITEM
            # --------------------------------------------------

            item = (
                db.query(
                    store_models.StoreItem
                )
                .filter(
                    store_models.StoreItem.id
                    == adjustment.item_id,

                    store_models.StoreItem.business_id
                    == effective_business_id,
                )
                .first()
            )

            if not item:
                continue

            # --------------------------------------------------
            # RESPONSE
            # --------------------------------------------------

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

        # ======================================================
        # 10. RETURN
        # ======================================================

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
            ),
        )




# ==========================================================
# UPDATE LOCATION INVENTORY ADJUSTMENT
# ==========================================================

@router.put(
    "/location/adjustments/{adjustment_id}",
    response_model=location_schemas.LocationInventoryAdjustmentDisplay,
)
def update_location_inventory_adjustment(
    adjustment_id: int,

    data:
        location_schemas.LocationInventoryAdjustmentCreate,

    business_id: Optional[int] = Query(
        None,
        description="Super Admin can specify business",
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES1)
    ),
):
    """
    Update an existing location inventory adjustment.

    Rules:

    Super Admin:
        - Can update an adjustment for the selected business.

    Business users:
        - Can only update adjustments belonging to their business.

    Camp Boss:
        - Can only update adjustments belonging to their
          assigned location.
        - Cannot move an adjustment to another location.
        - Any location_id supplied by the frontend must match
          their assigned location.

    Inventory behavior:

        Positive adjustment:
            Adds stock.

        Negative adjustment:
            Removes stock.

    When editing:
        1. Reverse the original adjustment.
        2. Validate the new location/item.
        3. Apply the new adjustment.
        4. Update the adjustment record.
        5. Commit everything together.
    """

    try:

        # ======================================================
        # 1. RESOLVE BUSINESS
        # ======================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id,
        )

        if effective_business_id is None:
            raise HTTPException(
                status_code=400,
                detail="Business could not be determined.",
            )

        # ======================================================
        # 2. LOCK ADJUSTMENT
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
                == effective_business_id,
            )
            .with_for_update()
            .first()
        )

        if not adjustment:
            raise HTTPException(
                status_code=404,
                detail="Adjustment not found.",
            )

        # ======================================================
        # 3. CAMP BOSS LOCATION RESTRICTION
        # ======================================================

        if is_camp_boss(current_user):

            user_location_id = current_user.location_id

            if user_location_id is None:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Camp Boss is not assigned "
                        "to a location."
                    ),
                )

            # --------------------------------------------------
            # Existing adjustment must belong to Camp Boss
            # location.
            # --------------------------------------------------

            if adjustment.location_id != user_location_id:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "You can only update adjustments "
                        "belonging to your assigned location."
                    ),
                )

            # --------------------------------------------------
            # Ignore/match frontend location.
            # Camp Boss cannot move adjustment elsewhere.
            # --------------------------------------------------

            if data.location_id != user_location_id:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Camp Boss cannot move an adjustment "
                        "to another location."
                    ),
                )

        # ======================================================
        # 4. GET OLD VALUES
        # ======================================================

        old_location_id = adjustment.location_id
        old_item_id = adjustment.item_id
        old_qty = float(
            adjustment.quantity_adjusted or 0
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
                detail="Adjustment cannot be zero.",
            )

        # ======================================================
        # 6. DETERMINE NEW LOCATION
        # ======================================================

        new_location_id = data.location_id

        # ------------------------------------------------------
        # Camp Boss is forced to assigned location.
        # ------------------------------------------------------

        if is_camp_boss(current_user):

            new_location_id = (
                current_user.location_id
            )

        # ======================================================
        # 7. VALIDATE NEW LOCATION
        # ======================================================

        new_location = (
            db.query(
                location_models.Location
            )
            .filter(
                location_models.Location.id
                == new_location_id,

                location_models.Location.business_id
                == effective_business_id,

                location_models.Location.status
                == "active",
            )
            .first()
        )

        if not new_location:
            raise HTTPException(
                status_code=404,
                detail="Location not found or inactive.",
            )

        # ======================================================
        # 8. VALIDATE NEW ITEM
        # ======================================================

        new_item = (
            db.query(
                store_models.StoreItem
            )
            .filter(
                store_models.StoreItem.id
                == data.item_id,

                store_models.StoreItem.business_id
                == effective_business_id,
            )
            .first()
        )

        if not new_item:
            raise HTTPException(
                status_code=404,
                detail="Item not found.",
            )

        # ======================================================
        # 9. LOCK OLD INVENTORY
        # ======================================================

        old_inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.location_id
                == old_location_id,

                location_models.LocationInventory.item_id
                == old_item_id,

                location_models.LocationInventory.business_id
                == effective_business_id,
            )
            .with_for_update()
            .first()
        )

        if not old_inventory:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The inventory record associated with "
                    "this adjustment no longer exists."
                ),
            )

        # ======================================================
        # 10. REVERSE OLD ADJUSTMENT
        # ======================================================

        if old_qty > 0:

            old_remaining = float(
                adjustment.remaining_quantity or 0
            )

            # --------------------------------------------------
            # The positive adjustment may have already been
            # partially consumed.
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
                    ),
                )

            current_old_quantity = float(
                old_inventory.quantity or 0
            )

            if old_qty > current_old_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot reverse the original "
                        "adjustment because the current "
                        "inventory is lower than the "
                        "original adjustment quantity."
                    ),
                )

            # --------------------------------------------------
            # Remove the original positive adjustment.
            # --------------------------------------------------

            old_inventory.quantity = (
                current_old_quantity
                - old_qty
            )

        else:

            # --------------------------------------------------
            # Original adjustment was negative.
            #
            # It removed stock, so reversing it means
            # returning that stock.
            # --------------------------------------------------

            old_inventory.quantity = (
                float(old_inventory.quantity or 0)
                + abs(old_qty)
            )

        # ======================================================
        # 11. GET NEW INVENTORY
        # ======================================================

        # ------------------------------------------------------
        # If old and new point to the same inventory row,
        # old_inventory is already locked and can be reused.
        # ------------------------------------------------------

        if (
            old_location_id == new_location_id
            and old_item_id == data.item_id
        ):

            new_inventory = old_inventory

        else:

            new_inventory = (
                db.query(
                    location_models.LocationInventory
                )
                .filter(
                    location_models.LocationInventory.location_id
                    == new_location_id,

                    location_models.LocationInventory.item_id
                    == data.item_id,

                    location_models.LocationInventory.business_id
                    == effective_business_id,
                )
                .with_for_update()
                .first()
            )

        # ======================================================
        # 12. APPLY NEW ADJUSTMENT
        # ======================================================

        if new_qty < 0:

            # --------------------------------------------------
            # NEGATIVE ADJUSTMENT
            # --------------------------------------------------

            quantity_to_remove = abs(new_qty)

            available_quantity = float(
                new_inventory.quantity
                if new_inventory
                else 0
            )

            if not new_inventory:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No inventory exists for this item "
                        "at the selected location."
                    ),
                )

            if quantity_to_remove > available_quantity:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot remove "
                        f"{quantity_to_remove} units "
                        f"from {new_item.name}. "
                        f"Available at location: "
                        f"{available_quantity}."
                    ),
                )

            new_inventory.quantity = (
                available_quantity
                - quantity_to_remove
            )

            new_remaining_quantity = 0

        else:

            # --------------------------------------------------
            # POSITIVE ADJUSTMENT
            # --------------------------------------------------

            if new_inventory:

                new_inventory.quantity = (
                    float(
                        new_inventory.quantity or 0
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
                            new_location_id
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
                        ),
                    )
                )

                db.add(new_inventory)

            new_remaining_quantity = new_qty

        # ======================================================
        # 13. UPDATE ADJUSTMENT RECORD
        # ======================================================

        adjustment.location_id = (
            new_location_id
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

        # ======================================================
        # 14. FLUSH
        # ======================================================

        db.flush()

        # ======================================================
        # 15. COMMIT EVERYTHING
        # ======================================================

        db.commit()

        db.refresh(adjustment)

        # ======================================================
        # 16. RETURN UPDATED ADJUSTMENT
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
            ),
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
        None,
        description="Super admin can specify business"
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES1)
    ),
):
    try:

        # ======================================================
        # 1. RESOLVE BUSINESS
        # ======================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id,
        )

        if not effective_business_id:
            raise HTTPException(
                status_code=400,
                detail="Business could not be determined.",
            )

        # ======================================================
        # 2. GET AND LOCK ADJUSTMENT
        # ======================================================

        adjustment = (
            db.query(
                catering_models.LocationInventoryAdjustment
            )
            .filter(
                catering_models
                .LocationInventoryAdjustment
                .id
                == adjustment_id,

                catering_models
                .LocationInventoryAdjustment
                .business_id
                == effective_business_id,
            )
            .with_for_update()
            .first()
        )

        if not adjustment:
            raise HTTPException(
                status_code=404,
                detail="Adjustment not found.",
            )

        # ======================================================
        # 3. GET AND LOCK INVENTORY
        # ======================================================

        inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models
                .LocationInventory.location_id
                == adjustment.location_id,

                location_models
                .LocationInventory.item_id
                == adjustment.item_id,

                location_models
                .LocationInventory.business_id
                == effective_business_id,
            )
            .with_for_update()
            .first()
        )

        if not inventory:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Location inventory record "
                    "no longer exists. "
                    "The adjustment cannot be safely deleted."
                ),
            )

        # ======================================================
        # 4. GET CURRENT QUANTITY
        # ======================================================

        current_quantity = float(
            inventory.quantity or 0
        )

        adjustment_quantity = float(
            adjustment.quantity_adjusted
        )

        # ======================================================
        # 5. VALIDATE ADJUSTMENT
        # ======================================================

        if adjustment_quantity == 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid adjustment. "
                    "Adjustment quantity cannot be zero."
                ),
            )

        # ======================================================
        # 6. POSITIVE ADJUSTMENT
        #
        # Example:
        #
        # Adjustment: +10
        #
        # Original stock:
        # 50
        #
        # After adjustment:
        # 60
        #
        # To delete the adjustment:
        # 60 - 10 = 50
        #
        # BUT:
        # If some of those 10 units have already been used,
        # the adjustment must not be deleted.
        # ======================================================

        if adjustment_quantity > 0:

            remaining_quantity = float(
                adjustment.remaining_quantity or 0
            )

            # --------------------------------------------------
            # CHECK WHETHER ADJUSTED STOCK WAS USED
            # --------------------------------------------------

            if remaining_quantity < adjustment_quantity:

                used_quantity = (
                    adjustment_quantity
                    - remaining_quantity
                )

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot delete this adjustment "
                        "because "
                        f"{used_quantity} unit(s) from the "
                        "adjustment have already been used."
                    ),
                )

            # --------------------------------------------------
            # CHECK CURRENT STOCK
            # --------------------------------------------------

            if current_quantity < adjustment_quantity:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot delete this adjustment "
                        "because the current location stock "
                        "is insufficient to reverse it."
                    ),
                )

            # --------------------------------------------------
            # REMOVE THE ADDED STOCK
            # --------------------------------------------------

            inventory.quantity = (
                current_quantity
                - adjustment_quantity
            )

        # ======================================================
        # 7. NEGATIVE ADJUSTMENT
        #
        # Example:
        #
        # Adjustment: -10
        #
        # Original stock:
        # 50
        #
        # After adjustment:
        # 40
        #
        # Deleting adjustment:
        # 40 + 10 = 50
        # ======================================================

        else:

            quantity_to_restore = abs(
                adjustment_quantity
            )

            inventory.quantity = (
                current_quantity
                + quantity_to_restore
            )

        # ======================================================
        # 8. SAVE RESPONSE DATA BEFORE DELETE
        # ======================================================

        deleted_adjustment_id = adjustment.id

        deleted_location_id = (
            adjustment.location_id
        )

        deleted_item_id = (
            adjustment.item_id
        )

        deleted_quantity = (
            adjustment.quantity_adjusted
        )

        # ======================================================
        # 9. DELETE ADJUSTMENT
        # ======================================================

        db.delete(adjustment)

        # ======================================================
        # 10. COMMIT EVERYTHING
        # ======================================================

        db.commit()

        # ======================================================
        # 11. RESPONSE
        # ======================================================

        return {
            "message": (
                "Location inventory adjustment "
                "deleted successfully."
            ),

            "adjustment_id": (
                deleted_adjustment_id
            ),

            "location_id": (
                deleted_location_id
            ),

            "item_id": (
                deleted_item_id
            ),

            "quantity_adjusted": (
                deleted_quantity
            ),

            "business_id": (
                effective_business_id
            ),
        }

    # ==========================================================
    # HTTP ERROR
    # ==========================================================

    except HTTPException:

        db.rollback()

        raise

    # ==========================================================
    # UNEXPECTED ERROR
    # ==========================================================

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to delete location "
                f"inventory adjustment: {str(e)}"
            ),
        )

    

# ==========================================================
# LOCATION STOCK BALANCE
# ==========================================================

@router.get(
    "/location-balance-stock",
    response_model=list[
        location_schemas.LocationStockBalance
    ],
)
def get_location_stock_balance(
    location_id: Optional[int] = Query(
        None,
        description="Filter by location",
    ),

    item_id: Optional[int] = Query(
        None,
        description="Filter by item",
    ),

    category_id: Optional[int] = Query(
        None,
        description="Filter by category ID",
    ),

    item_type: Optional[str] = Query(
        None,
        description="Filter by item type",
    ),

    search: Optional[str] = Query(
        None,
        description="Search by item, category or location",
    ),

    business_id: Optional[int] = Query(
        None,
        description="Business ID (Super Admin only)",
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES1)
    ),
):

    try:

        # ======================================================
        # 1. RESOLVE BUSINESS
        # ======================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id,
        )

        if effective_business_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business could not be determined.",
            )

        # ======================================================
        # 2. DETERMINE CAMP BOSS
        # ======================================================

        camp_boss = is_camp_boss(
            current_user
        )

        # ======================================================
        # 3. DETERMINE EFFECTIVE LOCATION
        # ======================================================

        if camp_boss:

            if current_user.location_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        "Camp Boss is not assigned "
                        "to a location."
                    ),
                )

            # Camp Boss can NEVER override location
            # from the frontend.
            effective_location_id = int(
                current_user.location_id
            )

        else:

            effective_location_id = (
                int(location_id)
                if location_id is not None
                else None
            )

        # ======================================================
        # DEBUG
        # ======================================================

        print(
            "\n=============================================="
        )
        print(
            " LOCATION STOCK BALANCE"
        )
        print(
            "=============================================="
        )

        print(
            "USERNAME:",
            getattr(
                current_user,
                "username",
                None,
            ),
        )

        print(
            "BUSINESS:",
            effective_business_id,
        )

        print(
            "USER BUSINESS:",
            getattr(
                current_user,
                "business_id",
                None,
            ),
        )

        print(
            "CAMP BOSS:",
            camp_boss,
        )

        print(
            "REQUEST LOCATION:",
            location_id,
        )

        print(
            "EFFECTIVE LOCATION:",
            effective_location_id,
        )

        print(
            "ITEM ID:",
            item_id,
        )

        print(
            "CATEGORY ID:",
            category_id,
        )

        print(
            "ITEM TYPE:",
            item_type,
        )

        print(
            "SEARCH:",
            search,
        )

        print(
            "==============================================\n"
        )

        # ======================================================
        # 4. VALIDATE LOCATION
        # ======================================================

        if effective_location_id is not None:

            location_exists = (
                db.query(
                    location_models.Location
                )
                .filter(
                    location_models.Location.id
                    == effective_location_id,

                    location_models.Location.business_id
                    == effective_business_id,
                )
                .first()
            )

            if not location_exists:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Location not found.",
                )

        # ======================================================
        # 5. VALIDATE CATEGORY
        #
        # This makes sure the category belongs to the current
        # business before using it as a filter.
        # ======================================================

        if category_id is not None:

            category_exists = (
                db.query(
                    store_models.StoreCategory
                )
                .filter(
                    store_models.StoreCategory.id
                    == category_id,

                    store_models.StoreCategory.business_id
                    == effective_business_id,
                )
                .first()
            )

            if not category_exists:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Category not found.",
                )

        # ======================================================
        # 6. GET LOCATIONS
        # ======================================================

        locations_query = (
            db.query(
                location_models.Location
            )
            .filter(
                location_models.Location.business_id
                == effective_business_id
            )
        )

        if effective_location_id is not None:

            locations_query = (
                locations_query.filter(
                    location_models.Location.id
                    == effective_location_id
                )
            )

        locations = (
            locations_query
            .order_by(
                location_models.Location.name.asc()
            )
            .all()
        )

        # ======================================================
        # 7. GET STORE ITEMS
        # ======================================================

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

                store_models.StoreItem.category_id.label(
                    "category_id"
                ),

                store_models.StoreCategory.name.label(
                    "category_name"
                ),

            )
            .outerjoin(
                store_models.StoreCategory,

                store_models.StoreItem.category_id
                ==
                store_models.StoreCategory.id,
            )
            .filter(
                store_models.StoreItem.business_id
                == effective_business_id
            )
        )

        # ======================================================
        # 8. ITEM FILTER
        # ======================================================

        if item_id is not None:

            items_query = items_query.filter(
                store_models.StoreItem.id
                == item_id
            )

        # ======================================================
        # 9. CATEGORY FILTER
        #
        # IMPORTANT:
        # category_id is an INTEGER.
        #
        # The frontend sends:
        #
        # category_id=5
        #
        # NOT:
        #
        # category_id=Beverages
        # ======================================================

        if category_id is not None:

            items_query = items_query.filter(
                store_models.StoreItem.category_id
                == category_id
            )

        # ======================================================
        # 10. ITEM TYPE FILTER
        # ======================================================

        if item_type and item_type.strip():

            items_query = items_query.filter(
                func.lower(
                    store_models.StoreItem.item_type
                )
                ==
                item_type.strip().lower()
            )

        # ======================================================
        # 11. SEARCH FILTER
        # ======================================================

        if search and search.strip():

            search_value = (
                f"%{search.strip()}%"
            )

            items_query = items_query.filter(
                (
                    store_models.StoreItem.name
                    .ilike(search_value)
                )
                |
                (
                    store_models.StoreCategory.name
                    .ilike(search_value)
                )
            )

        # ======================================================
        # 12. GET ITEMS
        # ======================================================

        items = (
            items_query
            .order_by(
                store_models.StoreItem.name.asc()
            )
            .all()
        )

        # ======================================================
        # 13. OPENING STOCK
        # ======================================================

        opening_query = (
            db.query(

                location_models.LocationInventory.location_id,

                location_models.LocationInventory.item_id,

                func.coalesce(
                    location_models.LocationInventory.opening_quantity,
                    0,
                ).label(
                    "opening_stock"
                ),

            )
            .filter(
                location_models.LocationInventory.business_id
                == effective_business_id
            )
        )

        if effective_location_id is not None:

            opening_query = (
                opening_query.filter(
                    location_models.LocationInventory.location_id
                    == effective_location_id
                )
            )

        if item_id is not None:

            opening_query = (
                opening_query.filter(
                    location_models.LocationInventory.item_id
                    == item_id
                )
            )

        opening_rows = (
            opening_query.all()
        )

        opening_map = {
            (
                row.location_id,
                row.item_id,
            ):
            float(
                row.opening_stock or 0
            )
            for row in opening_rows
        }

        # ======================================================
        # 14. RECEIVED STOCK
        # ======================================================

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
                    0,
                ).label(
                    "total_received"
                ),

            )
            .join(
                store_models.StoreIssue,

                store_models.StoreIssue.id
                ==
                store_models.StoreIssueItem.issue_id,
            )
            .filter(
                store_models.StoreIssue.business_id
                == effective_business_id
            )
        )

        if effective_location_id is not None:

            received_query = (
                received_query.filter(
                    store_models.StoreIssue.location_id
                    == effective_location_id
                )
            )

        if item_id is not None:

            received_query = (
                received_query.filter(
                    store_models.StoreIssueItem.item_id
                    == item_id
                )
            )

        received_rows = (
            received_query
            .group_by(
                store_models.StoreIssue.location_id,

                store_models.StoreIssueItem.item_id,
            )
            .all()
        )

        received_map = {
            (
                row.location_id,
                row.item_id,
            ):
            float(
                row.total_received or 0
            )
            for row in received_rows
        }

        # ======================================================
        # 15. ADJUSTMENTS
        # ======================================================

        adjustment_query = (
            db.query(

                catering_models
                .LocationInventoryAdjustment
                .location_id
                .label(
                    "location_id"
                ),

                catering_models
                .LocationInventoryAdjustment
                .item_id
                .label(
                    "item_id"
                ),

                func.coalesce(
                    func.sum(
                        catering_models
                        .LocationInventoryAdjustment
                        .quantity_adjusted
                    ),
                    0,
                ).label(
                    "total_adjusted"
                ),

            )
            .filter(
                catering_models
                .LocationInventoryAdjustment
                .business_id
                ==
                effective_business_id
            )
        )

        if effective_location_id is not None:

            adjustment_query = (
                adjustment_query.filter(
                    catering_models
                    .LocationInventoryAdjustment
                    .location_id
                    ==
                    effective_location_id
                )
            )

        if item_id is not None:

            adjustment_query = (
                adjustment_query.filter(
                    catering_models
                    .LocationInventoryAdjustment
                    .item_id
                    ==
                    item_id
                )
            )

        adjustment_rows = (
            adjustment_query
            .group_by(
                catering_models
                .LocationInventoryAdjustment
                .location_id,

                catering_models
                .LocationInventoryAdjustment
                .item_id,
            )
            .all()
        )

        adjustment_map = {
            (
                row.location_id,
                row.item_id,
            ):
            float(
                row.total_adjusted or 0
            )
            for row in adjustment_rows
        }

        # ======================================================
        # 16. USED STOCK
        # ======================================================

        usage_query = (
            db.query(

                catering_models
                .CateringUsageItem
                .location_id
                .label(
                    "location_id"
                ),

                catering_models
                .CateringUsageItem
                .item_id
                .label(
                    "item_id"
                ),

                func.coalesce(
                    func.sum(
                        catering_models
                        .CateringUsageItem
                        .quantity_used
                    ),
                    0,
                ).label(
                    "total_used"
                ),

            )
            .join(
                catering_models.CateringUsage,

                catering_models.CateringUsage.id
                ==
                catering_models.CateringUsageItem.usage_id,
            )
            .filter(

                catering_models.CateringUsage.business_id
                ==
                effective_business_id,

                catering_models.CateringUsage.status
                !=
                "voided",
            )
        )

        if effective_location_id is not None:

            usage_query = (
                usage_query.filter(
                    catering_models
                    .CateringUsageItem
                    .location_id
                    ==
                    effective_location_id
                )
            )

        if item_id is not None:

            usage_query = (
                usage_query.filter(
                    catering_models
                    .CateringUsageItem
                    .item_id
                    ==
                    item_id
                )
            )

        usage_rows = (
            usage_query
            .group_by(
                catering_models
                .CateringUsageItem
                .location_id,

                catering_models
                .CateringUsageItem
                .item_id,
            )
            .all()
        )

        used_map = {
            (
                row.location_id,
                row.item_id,
            ):
            float(
                row.total_used or 0
            )
            for row in usage_rows
        }

        # ======================================================
        # 17. LOCATION INVENTORY
        # ======================================================

        inventory_query = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.business_id
                == effective_business_id
            )
        )

        if effective_location_id is not None:

            inventory_query = (
                inventory_query.filter(
                    location_models.LocationInventory.location_id
                    == effective_location_id
                )
            )

        if item_id is not None:

            inventory_query = (
                inventory_query.filter(
                    location_models.LocationInventory.item_id
                    == item_id
                )
            )

        inventories = (
            inventory_query.all()
        )

        inventory_map = {
            (
                inventory.location_id,
                inventory.item_id,
            ):
            inventory
            for inventory in inventories
        }

        # ======================================================
        # 18. BUILD RESPONSE
        # ======================================================

        response = []

        for location in locations:

            for item in items:

                key = (
                    location.id,
                    item.item_id,
                )

                inventory = (
                    inventory_map.get(key)
                )

                opening_stock = (
                    opening_map.get(key, 0)
                )

                total_received = (
                    received_map.get(key, 0)
                )

                total_adjusted = (
                    adjustment_map.get(key, 0)
                )

                total_used = (
                    used_map.get(key, 0)
                )

                # ------------------------------------------------
                # Only show records with activity
                # ------------------------------------------------

                has_activity = (
                    inventory is not None
                    or opening_stock != 0
                    or total_received != 0
                    or total_adjusted != 0
                    or total_used != 0
                )

                if not has_activity:
                    continue

                # ==================================================
                # CURRENT UNIT PRICE
                # ==================================================

                if (
                    inventory is not None
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
                # BALANCE
                # ==================================================

                balance = (
                    opening_stock
                    + total_received
                    + total_adjusted
                    - total_used
                )

                if abs(balance) < 0.000001:
                    balance = 0

                if balance < 0:
                    balance = 0

                # ==================================================
                # TOTAL VALUE
                # ==================================================

                balance_total_amount = round(
                    balance
                    *
                    current_unit_price,
                    2,
                )

                # ==================================================
                # RESPONSE
                # ==================================================

                response.append(
                    location_schemas.LocationStockBalance(

                        location_id=location.id,

                        location_name=location.name,

                        item_id=item.item_id,

                        item_name=item.item_name,

                        category_id=item.category_id,

                        category_name=(
                            item.category_name
                            or "Uncategorized"
                        ),

                        item_type=item.item_type,

                        unit=item.unit,

                        opening_stock=round(
                            opening_stock,
                            4,
                        ),

                        total_received=round(
                            total_received,
                            4,
                        ),

                        total_adjusted=round(
                            total_adjusted,
                            4,
                        ),

                        total_used=round(
                            total_used,
                            4,
                        ),

                        balance=round(
                            balance,
                            4,
                        ),

                        current_unit_price=(
                            current_unit_price
                        ),

                        balance_total_amount=(
                            balance_total_amount
                        ),
                    )
                )

        # ======================================================
        # 19. SORT
        # ======================================================

        response.sort(
            key=lambda row: (
                str(
                    row.location_name or ""
                ).lower(),

                str(
                    row.item_name or ""
                ).lower(),
            )
        )

        # ======================================================
        # DEBUG
        # ======================================================

        print(
            "LOCATION BALANCE RESULT COUNT:",
            len(response),
        )

        if camp_boss:

            print(
                "CAMP BOSS LOCATION:",
                effective_location_id,
            )

            print(
                "RESULT LOCATIONS:",
                sorted(
                    {
                        row.location_id
                        for row in response
                    }
                ),
            )

        # ======================================================
        # RETURN
        # ======================================================

        return response

    # ==========================================================
    # HTTP ERROR
    # ==========================================================

    except HTTPException:
        raise

    # ==========================================================
    # UNEXPECTED ERROR
    # ==========================================================

    except Exception as e:

        print(
            "LOCATION STOCK BALANCE ERROR:",
            repr(e),
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to retrieve location "
                f"stock balance: {str(e)}"
            ),
        )