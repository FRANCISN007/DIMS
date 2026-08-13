from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import exists
from sqlalchemy.orm import Session

from app.database import get_db
from app.users.auth import get_current_user
from app.users.schemas import UserDisplaySchema
from app.users.permissions import role_required
from app.core.roles import USER_MANAGEMENT_ROLES
from app.core.roles import SUPER_ADMIN, ADMIN
from app.users.models import User



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


@router.get(
    "/{location_id}",
    response_model=schemas.LocationDisplay,
)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(get_current_user),
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




