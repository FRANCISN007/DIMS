# app/business/router.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from sqlalchemy import func
from app.users.auth import get_current_user
from app.users.schemas import UserDisplaySchema
from app.license import models as license_models
from datetime import datetime


from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.business import models, schemas
from app.license import models as license_models
from app.users.permissions import role_required
from app.core.roles import ADMIN, SUPER_ADMIN
from app.core.timezone import now_wat




router = APIRouter()


# -------------------------------
# CREATE BUSINESS - ONLY SUPER ADMIN
# -------------------------------

@router.post("/", response_model=schemas.BusinessOut, status_code=201)
def create_business(
    business_in: schemas.BusinessCreate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(role_required(["super_admin"], bypass_admin=False))
):
    """
    Super admin creates a new business.
    The owner_username is explicitly provided (the admin/owner of this business).
    """
    # Prevent duplicate business name
    existing = db.query(models.Business).filter(
        models.Business.name == business_in.name.strip()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Business name already exists")

    
    # Create business with the specified owner_username
    business = models.Business(
        name=business_in.name.strip(),
        address=business_in.address,
        phone=business_in.phone,
        email=business_in.email,
        owner_username=business_in.owner_username.strip()  # ← from input, NOT current_user
    )

    db.add(business)
    db.commit()
    db.refresh(business)

    # Safe response with computed license_active
    biz_out = schemas.BusinessOut.from_orm(business)
    biz_out.license_active = business.is_license_active(db)
    # owner_username is already in biz_out from the column

    return biz_out



from datetime import datetime

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.business import models, schemas
from app.license import models as license_models
from app.users.permissions import role_required
from app.users.schemas import UserDisplaySchema
from app.core.roles import SUPER_ADMIN
from app.core.timezone import now_wat


@router.get(
    "/",
    response_model=schemas.BusinessListResponse,
)
def list_businesses(
    active: bool | None = Query(
        default=None,
        description="Filter by license status",
    ),
    name: str | None = Query(
        default=None,
        description="Search business name",
    ),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required([SUPER_ADMIN])
    ),
):
    """
    List businesses.

    Super Admin
        • View all businesses
        • Filter by name
        • Filter by active/inactive license

    Business Admin
        • View only own business
    """

    now = now_wat()

    query = db.query(models.Business)

    # -------------------------------------------------
    # Business restriction
    # -------------------------------------------------
    if current_user.role_code != SUPER_ADMIN:

        if not current_user.business_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Business not assigned.",
            )

        query = query.filter(
            models.Business.id == current_user.business_id
        )

    # -------------------------------------------------
    # Name filter
    # -------------------------------------------------
    if name:
        query = query.filter(
            func.lower(models.Business.name).contains(
                name.strip().lower()
            )
        )

    businesses = (
        query
        .order_by(models.Business.id.asc())
        .all()
    )

    results = []

    for business in businesses:

        # -------------------------------------------------
        # Get latest license
        # -------------------------------------------------
        latest_license = (
            db.query(license_models.LicenseKey)
            .filter(
                license_models.LicenseKey.business_id
                == business.id
            )
            .order_by(
                license_models.LicenseKey.expiration_date.desc()
            )
            .first()
        )

        license_active = False
        expiration_date = None

        if latest_license:

            expiration_date = (
                latest_license.expiration_date
            )

            # ---------------------------------------------
            # Check license expiration safely
            # ---------------------------------------------
            if (
                latest_license.is_active
                and expiration_date is not None
            ):

                # Database may return a naive datetime.
                # Convert it to the same timezone basis as now.
                if expiration_date.tzinfo is None:
                    expiration_date = expiration_date.replace(
                        tzinfo=now.tzinfo
                    )

                license_active = (
                    expiration_date >= now
                )

        # -------------------------------------------------
        # Active / inactive filter
        # -------------------------------------------------
        if active is not None:
            if license_active != active:
                continue

        # -------------------------------------------------
        # Add result
        # -------------------------------------------------
        results.append(
            schemas.BusinessOut(
                id=business.id,
                name=business.name,
                address=business.address,
                phone=business.phone,
                email=business.email,
                owner_username=business.owner_username,
                created_at=business.created_at,
                license_active=license_active,
                expiration_date=expiration_date,
            )
        )

    return schemas.BusinessListResponse(
        total=len(results),
        businesses=results,
    )



from typing import List, Optional
from fastapi import Query
from sqlalchemy import func

# ==========================================================
# SIMPLE BUSINESS LIST
# ==========================================================
@router.get(
    "/simple",
    response_model=list[schemas.BusinessSimple],
)
def list_businesses_simple(
    search: str | None = Query(
        default=None,
        description="Search business name",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(
            [SUPER_ADMIN, ADMIN]
        )
    ),
):
    """
    Business dropdown endpoint.

    Super Admin:
        • Can search all businesses

    Business Admin:
        • Can only see own business
    """

    query = db.query(
        models.Business.id,
        models.Business.name,
    )

    if current_user.role_code != SUPER_ADMIN:

        query = query.filter(
            models.Business.id ==
            current_user.business_id
        )

    elif search:

        query = query.filter(
            func.lower(
                models.Business.name
            ).contains(
                search.strip().lower()
            )
        )

    return (
        query
        .order_by(models.Business.name.asc())
        .limit(limit)
        .all()
    )


# ==========================================================
# GET BUSINESS
# ==========================================================
@router.get(
    "/{business_id}",
    response_model=schemas.BusinessOut,
)
def get_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(
            [SUPER_ADMIN, ADMIN]
        )
    ),
):

    business = (
        db.query(models.Business)
        .filter(
            models.Business.id == business_id
        )
        .first()
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found.",
        )

    if (
        current_user.role_code != SUPER_ADMIN
        and current_user.business_id != business.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions.",
        )

    latest_license = (
        db.query(license_models.LicenseKey)
        .filter(
            license_models.LicenseKey.business_id
            == business.id
        )
        .order_by(
            license_models.LicenseKey.expiration_date.desc()
        )
        .first()
    )

    license_active = False
    expiration_date = None

    if latest_license:

        expiration_date = (
            latest_license.expiration_date
        )

        license_active = (
            latest_license.is_active
            and latest_license.expiration_date >= now_wat()
        )

    return schemas.BusinessOut(
        id=business.id,
        name=business.name,
        address=business.address,
        phone=business.phone,
        email=business.email,
        owner_username=business.owner_username,
        created_at=business.created_at,
        license_active=license_active,
        expiration_date=expiration_date,
    )



from datetime import timezone
from zoneinfo import ZoneInfo

WAT = ZoneInfo("Africa/Lagos")


def ensure_wat_aware(dt):
    if dt is None:
        return None

    # Database returned a naive datetime.
    # Treat it as Africa/Lagos time.
    if dt.tzinfo is None:
        return dt.replace(tzinfo=WAT)

    # Already timezone-aware
    return dt.astimezone(WAT)

# ==========================================================

# UPDATE BUSINESS

# ==========================================================

@router.put(
    "/{business_id}",
response_model=schemas.BusinessOut,
)
def update_business(
    business_id: int,
    updated: schemas.BusinessUpdate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
    role_required(
    [SUPER_ADMIN, ADMIN]
    )
    ),
    ):


    business = (
        db.query(models.Business)
        .filter(
            models.Business.id == business_id
        )
        .first()
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found.",
        )

    # ----------------------------------------------------------
    # PERMISSION CHECK
    # ----------------------------------------------------------

    if (
        current_user.role_code != SUPER_ADMIN
        and current_user.business_id != business.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions.",
        )

    # ----------------------------------------------------------
    # GET ONLY FIELDS SENT BY CLIENT
    # ----------------------------------------------------------

    update_data = updated.model_dump(
        exclude_unset=True
    )

    # ----------------------------------------------------------
    # PROTECTED FIELDS
    # ----------------------------------------------------------
    # owner_username is intentionally NOT protected.
    # It can be edited.
    #
    # Business name remains unique because the database column
    # has unique=True.
    # ----------------------------------------------------------

    protected_fields = {
        "id",
        "created_at",
    }

    for field in protected_fields:
        update_data.pop(field, None)

    # ----------------------------------------------------------
    # UPDATE BUSINESS
    # ----------------------------------------------------------

    for field, value in update_data.items():

        # Clean owner username if supplied
        if field == "owner_username" and value is not None:
            value = value.strip()

        # Clean business name if supplied
        if field == "name" and value is not None:
            value = value.strip()

        setattr(
            business,
            field,
            value,
        )

    # ----------------------------------------------------------
    # SAVE
    # ----------------------------------------------------------

    db.commit()
    db.refresh(business)

    # ----------------------------------------------------------
    # GET LATEST LICENSE
    # ----------------------------------------------------------

    latest_license = (
        db.query(license_models.LicenseKey)
        .filter(
            license_models.LicenseKey.business_id
            == business.id
        )
        .order_by(
            license_models.LicenseKey.expiration_date.desc()
        )
        .first()
    )

    license_active = False
    expiration_date = None

    if latest_license:

        expiration_date = (
            latest_license.expiration_date
        )

        expiration_date = ensure_wat_aware(
            latest_license.expiration_date
        )

        license_active = (
            latest_license.is_active
            and expiration_date >= now_wat()
        )

    # ----------------------------------------------------------
    # RESPONSE
    # ----------------------------------------------------------

    return schemas.BusinessOut(
        id=business.id,
        name=business.name,
        address=business.address,
        phone=business.phone,
        email=business.email,
        owner_username=business.owner_username,
        created_at=business.created_at,
        license_active=license_active,
        expiration_date=expiration_date,
    )


# ==========================================================
# DELETE BUSINESS
# ==========================================================
@router.delete(
    "/{business_id}",
)
def delete_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(
            [SUPER_ADMIN]
        )
    ),
):

    business = (
        db.query(models.Business)
        .filter(
            models.Business.id == business_id
        )
        .first()
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found.",
        )

    try:

        db.delete(business)
        db.commit()

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cannot delete business "
                "because related records exist."
            ),
        )

    return {
        "message":
            f"Business '{business.name}' deleted successfully."
    }



