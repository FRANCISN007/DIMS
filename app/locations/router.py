from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import exists
from sqlalchemy.orm import Session

from app.database import get_db
from app.users.auth import get_current_user
from app.users.schemas import UserDisplaySchema
from app.users.permissions import role_required
from app.core.roles import USER_MANAGEMENT_ROLES
from app.core.roles import USER_MANAGEMENT_ROLES1

from app.core.roles import SUPER_ADMIN, ADMIN
from app.users.models import User
from datetime import date, datetime, timedelta
from app.store import models as store_models
from app.locations import models as location_models

from app.users import schemas as user_schemas
from typing import Optional, List

from app.core.tenant import resolve_business_id

from app.locations.models import Location


from app.core.tenant import (
    resolve_business_id,
    
)


from app.core.location import (
    is_camp_boss,
    resolve_location_id,
    validate_location_access,
    apply_location_access_filter,
)



from app.business.models import Business

from app.core.schemas import StatusUpdate

from app.locations.models import Location
from app.locations import schemas

router = APIRouter()



@router.post(
    "",
    response_model=schemas.LocationDisplay,
    status_code=status.HTTP_201_CREATED,
)
def create_location(
    location: schemas.LocationCreate,
    business_id: int | None = Query(
        default=None,
        description="Business ID (Super Admin only)",
    ),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    # ----------------------------------------
    # Determine Business
    # ----------------------------------------
    if current_user.role_code == SUPER_ADMIN:

        if business_id is None:
            raise HTTPException(
                status_code=400,
                detail="business_id is required.",
            )

        target_business_id = business_id

    else:

        target_business_id = current_user.business_id

    # ----------------------------------------
    # Duplicate Code
    # ----------------------------------------
    existing = (
        db.query(Location)
        .filter(
            Location.business_id == target_business_id,
            Location.code == location.code.strip().upper(),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Location code already exists.",
        )

    # ----------------------------------------
    # Duplicate Name
    # ----------------------------------------
    existing = (
        db.query(Location)
        .filter(
            Location.business_id == target_business_id,
            Location.name == location.name.strip(),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Location name already exists.",
        )

    # ----------------------------------------
    # Create
    # ----------------------------------------
    new_location = Location(
        business_id=target_business_id,
        name=location.name.strip(),
        code=location.code.strip().upper(),
        address=location.address,
        phone=location.phone,
        description=location.description,
        status=location.status,
    )

    db.add(new_location)
    db.commit()
    db.refresh(new_location)

    return new_location



@router.get(
    "",
    response_model=list[schemas.LocationDisplay],
)
def list_locations(
    search: str | None = Query(
        default=None,
        description="Search by location name or code",
    ),
    status_filter: str |None = Query(
        default=None,
        alias="status",
        description="Filter by status",
    ),
    business_id: int | None = Query(
        default=None,
        description="Business ID (Super Admin only)",
    ),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        #role_required(USER_MANAGEMENT_ROLES)
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    """
    List locations.

    Super Admin
        • Can view every business location
        • Optional business_id filter

    Business User
        • Only sees locations belonging to their business
    """

    query = db.query(Location)

    # ------------------------------------
    # Business Restriction
    # ------------------------------------
    if current_user.business_id is None:

        if business_id:
            query = query.filter(
                Location.business_id == business_id
            )

    else:

        query = query.filter(
            Location.business_id == current_user.business_id
        )

    # ------------------------------------
    # Search
    # ------------------------------------
    if search:

        search = search.strip()

        query = query.filter(
            (Location.name.ilike(f"%{search}%")) |
            (Location.code.ilike(f"%{search}%"))
        )

    # ------------------------------------
    # Status
    # ------------------------------------
    if status_filter:

        query = query.filter(
            Location.status == status_filter
        )

    return (
        query
        .order_by(
            Location.sort_order.asc(),
            Location.name.asc(),
        )
        .all()
    )


@router.get(
    "/simple",
    response_model=list[schemas.LocationSimple],
)
def list_simple_locations(
    business_id: int | None = Query(
        default=None,
        description="Business ID (Super Admin only)",
    ),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(get_current_user),
):
    """
    Active locations only.

    Super Admin
        • Can view all businesses
        • Optional business_id filter

    Business Users
        • Only their business
    """

    query = db.query(Location).filter(
        Location.status == "active"
    )

    if current_user.business_id is None:

        if business_id:
            query = query.filter(
                Location.business_id == business_id
            )

    else:

        query = query.filter(
            Location.business_id == current_user.business_id
        )

    return (
        query
        .order_by(Location.name.asc())
        .all()
    )



# ==========================================================
# STORE ISSUE CONTROL - LOCATION
# ==========================================================

@router.get(
    "/location-issue-control",
    response_model=List[dict]
)
def get_store_items_received_by_location(
    location_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    business_id: Optional[int] = Query(None),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES1)
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

        if effective_business_id is None:
            raise HTTPException(
                status_code=400,
                detail="Business could not be determined."
            )

        # ======================================================
        # 2. RESOLVE LOCATION ACCESS
        #
        # Camp Boss:
        #   - Automatically restricted to assigned location
        #   - Cannot override another location
        #
        # Other users:
        #   - Requested location is respected
        #   - None means all locations
        # ======================================================

        effective_location_id = resolve_location_id(
            current_user,
            location_id
        )

        # ======================================================
        # DEBUG
        # ======================================================

        print(
            "\n=============================================="
        )
        print(
            " LOCATION ISSUE CONTROL"
        )
        print(
            "=============================================="
        )

        print(
            "USERNAME:",
            getattr(
                current_user,
                "username",
                None
            )
        )

        print(
            "BUSINESS:",
            effective_business_id
        )

        print(
            "USER BUSINESS:",
            getattr(
                current_user,
                "business_id",
                None
            )
        )

        print(
            "USER LOCATION:",
            getattr(
                current_user,
                "location_id",
                None
            )
        )

        print(
            "REQUESTED LOCATION:",
            location_id
        )

        print(
            "EFFECTIVE LOCATION:",
            effective_location_id
        )

        print(
            "IS CAMP BOSS:",
            is_camp_boss(current_user)
        )

        print(
            "==============================================\n"
        )

        # ======================================================
        # 3. VALIDATE EFFECTIVE LOCATION
        # ======================================================

        if effective_location_id is not None:

            location = (
                db.query(
                    location_models.Location
                )
                .filter(
                    location_models.Location.id
                    == effective_location_id,

                    location_models.Location.business_id
                    == effective_business_id
                )
                .first()
            )

            if not location:
                raise HTTPException(
                    status_code=404,
                    detail="Location not found"
                )

        # ======================================================
        # 4. LATEST UNIT PRICE SUBQUERY
        # ======================================================

        latest_price_subquery = (
            db.query(
                store_models.StoreStockEntry.item_id,

                store_models.StoreStockEntry.unit_price
            )
            .filter(
                store_models.StoreStockEntry.business_id
                == effective_business_id
            )
            .order_by(
                store_models.StoreStockEntry.item_id,

                store_models.StoreStockEntry.purchase_date.desc(),

                store_models.StoreStockEntry.id.desc()
            )
            .distinct(
                store_models.StoreStockEntry.item_id
            )
            .subquery()
        )

        # ======================================================
        # 5. MAIN QUERY
        # ======================================================

        query = (
            db.query(

                store_models.StoreIssueItem.item_id,

                store_models.StoreItem.name,

                store_models.StoreItem.unit,

                store_models.StoreIssue.location_id.label(
                    "location_id"
                ),

                location_models.Location.name.label(
                    "location_name"
                ),

                store_models.StoreIssue.issue_date,

                store_models.StoreIssueItem.quantity,

                latest_price_subquery.c.unit_price
            )

            # --------------------------------------------------
            # Store Issue
            # --------------------------------------------------

            .join(
                store_models.StoreIssue,

                store_models.StoreIssue.id
                ==
                store_models.StoreIssueItem.issue_id
            )

            # --------------------------------------------------
            # Store Item
            # --------------------------------------------------

            .join(
                store_models.StoreItem,

                store_models.StoreItem.id
                ==
                store_models.StoreIssueItem.item_id
            )

            # --------------------------------------------------
            # Location
            # --------------------------------------------------

            .join(
                location_models.Location,

                location_models.Location.id
                ==
                store_models.StoreIssue.location_id
            )

            # --------------------------------------------------
            # Latest price
            # --------------------------------------------------

            .outerjoin(
                latest_price_subquery,

                latest_price_subquery.c.item_id
                ==
                store_models.StoreIssueItem.item_id
            )

            # ==================================================
            # TENANT FILTERS
            # ==================================================

            .filter(

                # Only issues sent to locations
                store_models.StoreIssue.issue_to
                == "location",

                # Store issue belongs to business
                store_models.StoreIssue.business_id
                == effective_business_id,

                # Store issue item belongs to business
                store_models.StoreIssueItem.business_id
                == effective_business_id,

                # Store item belongs to business
                store_models.StoreItem.business_id
                == effective_business_id,

                # Location belongs to business
                location_models.Location.business_id
                == effective_business_id
            )
        )

        # ======================================================
        # 6. APPLY EFFECTIVE LOCATION
        # ======================================================

        if effective_location_id is not None:

            query = query.filter(
                store_models.StoreIssue.location_id
                == effective_location_id
            )

        # ======================================================
        # 7. START DATE
        # ======================================================

        if start_date:

            query = query.filter(
                store_models.StoreIssue.issue_date
                >= start_date
            )

        # ======================================================
        # 8. END DATE
        # ======================================================

        if end_date:

            query = query.filter(
                store_models.StoreIssue.issue_date
                <
                end_date + timedelta(days=1)
            )

        # ======================================================
        # 9. ORDER
        # ======================================================

        results = (
            query
            .order_by(
                store_models.StoreIssue.issue_date.desc(),

                store_models.StoreIssue.id.desc(),

                store_models.StoreIssueItem.id.desc()
            )
            .all()
        )

        # ======================================================
        # 10. RESPONSE
        # ======================================================

        return [

            {
                "item_id": r.item_id,

                "item_name": r.name,

                "unit": r.unit,

                "location_id": r.location_id,

                "location_name": r.location_name,

                "issue_date": r.issue_date,

                "quantity": float(
                    r.quantity or 0
                ),

                "unit_price": (
                    float(r.unit_price)
                    if r.unit_price is not None
                    else None
                ),

                "total_amount": (
                    round(
                        float(r.quantity or 0)
                        *
                        float(r.unit_price),
                        2
                    )
                    if r.unit_price is not None
                    else None
                )
            }

            for r in results
        ]

    # ==========================================================
    # PRESERVE HTTP ERRORS
    # ==========================================================

    except HTTPException:
        raise

    # ==========================================================
    # UNEXPECTED ERROR
    # ==========================================================

    except Exception as e:

        db.rollback()

        print(
            "LOCATION ISSUE CONTROL ERROR:",
            repr(e)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to retrieve store issue "
                f"control for locations: {str(e)}"
            )
        )

    

@router.get(
    "/{location_id}",
    response_model=schemas.LocationDisplay,
)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
            role_required(USER_MANAGEMENT_ROLES1)
        ),
):
    """
    Get one location.

    Super Admin
        • Any location

    Business Users
        • Only locations in their business
    """

    query = db.query(Location).filter(
        Location.id == location_id
    )

    if current_user.business_id is not None:

        query = query.filter(
            Location.business_id == current_user.business_id
        )

    location = query.first()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found.",
        )

    return location


@router.put(
    "/{location_id}",
    response_model=schemas.LocationDisplay,
)
def update_location(
    location_id: int,
    location_data: schemas.LocationUpdate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    """
    Update a location.

    Super Admin
        • Any location

    Business Users
        • Only locations in their business
    """

    query = db.query(Location).filter(
        Location.id == location_id
    )

    if current_user.business_id is not None:

        query = query.filter(
            Location.business_id == current_user.business_id
        )

    location = query.first()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found.",
        )

    update_data = location_data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()

        existing = (
            db.query(Location)
            .filter(
                Location.name == update_data["name"],
                Location.id != location.id,
            )
        )

        if current_user.business_id is None:
            existing = existing.filter(
                Location.business_id == location.business_id
            )
        else:
            existing = existing.filter(
                Location.business_id == current_user.business_id
            )

        if existing.first():
            raise HTTPException(
                status_code=400,
                detail="Location name already exists.",
            )

    if "code" in update_data and update_data["code"]:
        update_data["code"] = update_data["code"].strip().upper()

        existing = (
            db.query(Location)
            .filter(
                Location.code == update_data["code"],
                Location.id != location.id,
            )
        )

        if current_user.business_id is None:

            existing = (
                existing.filter(Location.business_id == location.business_id)
            )

        else:

            existing = existing.filter(
                Location.business_id == current_user.business_id
            )

        if existing.first():
            raise HTTPException(
                status_code=400,
                detail="Location code already exists.",
            )

    for key, value in update_data.items():
        setattr(location, key, value)

    db.commit()
    db.refresh(location)

    return location


@router.patch(
    "/{location_id}/status",
    response_model=schemas.LocationDisplay,
)
def change_location_status(
    location_id: int,
    status_data: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    """
    Change location status.
    """

    query = db.query(Location).filter(
        Location.id == location_id
    )

    if current_user.business_id is not None:

        query = query.filter(
            Location.business_id == current_user.business_id
        )

    location = query.first()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found.",
        )

    location.status = status_data.status

    db.commit()
    db.refresh(location)

    return location


@router.delete(
    "/{location_id}",
    status_code=status.HTTP_200_OK,
)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    """
    Delete location.

    Super Admin
        • Any location

    Business Users
        • Only locations in their business
    """

    query = db.query(Location).filter(
        Location.id == location_id
    )

    if current_user.business_id is not None:

        query = query.filter(
            Location.business_id == current_user.business_id
        )

    location = query.first()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found.",
        )

    role_in_use = db.query(
        exists().where(
            User.location_id == location.id
        )
    ).scalar()

    if role_in_use:
        raise HTTPException(
            status_code=400,
            detail="This location has been assigned to one or more users and cannot be deleted.",
        )

    db.delete(location)
    db.commit()

    return {
        "detail": "Location deleted successfully."
    }




