# app/license/router.py
from fastapi import APIRouter, Depends, HTTPException, Form, status
from sqlalchemy.orm import Session
from loguru import logger

from datetime import datetime, date, time
from typing import Optional, Dict, Any
from sqlalchemy import func
from datetime import datetime, timedelta
import os
from app.core.roles import SUPER_ADMIN

from datetime import timedelta
from app.core.timezone import now_wat, to_wat  # ✅ import your helper


from math import ceil
from app.core.timezone import now_wat, to_wat




from app.database import get_db
from app.license import schemas, services, models as license_models
from app.business.models import Business
from app.superadmin.passwords import verify_password
from app.users.auth import get_current_user
from app.users.schemas import UserDisplaySchema

from dotenv import load_dotenv
load_dotenv()  # loads .env file

router = APIRouter()

logger.add("app.log", rotation="500 MB", level="DEBUG")

# Env config
ADMIN_LICENSE_PASSWORD_HASH = os.getenv("ADMIN_LICENSE_PASSWORD_HASH")
LICENSE_FILE = "license_status.json"


@router.post(
    "/generate",
    response_model=schemas.LicenseResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_license_key(
    license_password: str = Form(...),
    key: str = Form(...),
    duration_days: int = Form(
        ...,
        gt=0,
        description="Duration in days",
    ),
    business_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(get_current_user),
):
    """
    Generate a new license key.

    - Super Admin only.
    - License is assigned to the selected business.
    """

    # --------------------------------------------------
    # SUPER ADMIN CHECK
    # --------------------------------------------------
    if current_user.role_code != SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can generate license keys.",
        )

    # --------------------------------------------------
    # LICENSE PASSWORD CONFIGURATION
    # --------------------------------------------------
    if not ADMIN_LICENSE_PASSWORD_HASH:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin license password is not configured.",
        )

    # --------------------------------------------------
    # VERIFY LICENSE PASSWORD
    # --------------------------------------------------
    if not verify_password(
        license_password,
        ADMIN_LICENSE_PASSWORD_HASH,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid license password.",
        )

    # --------------------------------------------------
    # VALIDATE BUSINESS
    # --------------------------------------------------
    business = (
        db.query(Business)
        .filter(Business.id == business_id)
        .first()
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found.",
        )

    # --------------------------------------------------
    # GENERATE EXPIRATION DATE
    # --------------------------------------------------
    expiration_date = now_wat() + timedelta(
        days=duration_days
    )

    # --------------------------------------------------
    # CREATE LICENSE
    # --------------------------------------------------
    new_license = services.create_license_key(
        db,
        schemas.LicenseCreate(
            key=key.strip(),
            expiration_date=expiration_date,
            business_id=business_id,
        ),
    )

    # --------------------------------------------------
    # SAVE OFFLINE FALLBACK
    # --------------------------------------------------
    services.save_license_file(
        {
            "valid": True,
            "expires_on": new_license.expiration_date,
        }
    )

    return new_license


@router.get("/verify/{key}/{business_id}", response_model=schemas.LicenseStatusResponse)
def verify_license(
    key: str,
    business_id: int,
    db: Session = Depends(get_db),
):
    """
    Verify license key for a specific business (public endpoint).
    """
    result = services.verify_license_key(db, key, business_id)

    # Save fallback
    services.save_license_file({
        "valid": result["valid"],
        "expires_on": result.get("expires_on"),
    })

    if not result["valid"]:
        raise HTTPException(400, result["message"])

    return result



from math import ceil
from app.core.timezone import now_wat, to_wat

from math import ceil
from app.core.timezone import now_wat, to_wat

@router.get(
    "/check",
    response_model=schemas.LicenseStatusResponse,
)
def check_license_status(
    current_user: UserDisplaySchema = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check the current user's business license.

    - Super Admin → no license required.
    - Business users → license checked against their business.
    """

    # --------------------------------------------------
    # SUPER ADMIN
    # --------------------------------------------------
    if current_user.role_code == SUPER_ADMIN:
        return {
            "valid": True,
            "expires_on": None,
            "message": "Super admin - no license required",
            "warning": False,
            "days_left": None,
        }

    # --------------------------------------------------
    # BUSINESS VALIDATION
    # --------------------------------------------------
    if current_user.business_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to any business.",
        )

    # --------------------------------------------------
    # GET ACTIVE LICENSE
    # --------------------------------------------------
    license_record = (
        db.query(license_models.LicenseKey)
        .filter(
            license_models.LicenseKey.business_id
            == current_user.business_id,
            license_models.LicenseKey.is_active == True,
        )
        .order_by(
            license_models.LicenseKey.expiration_date.desc()
        )
        .first()
    )

    # --------------------------------------------------
    # NO LICENSE
    # --------------------------------------------------
    if not license_record:
        return {
            "valid": False,
            "expires_on": None,
            "message": "No active license found",
            "warning": True,
            "days_left": None,
        }

    # --------------------------------------------------
    # TIMEZONE
    # --------------------------------------------------
    now = now_wat()
    expires_on = to_wat(
        license_record.expiration_date
    )

    # --------------------------------------------------
    # EXPIRED
    # --------------------------------------------------
    if expires_on <= now:
        return {
            "valid": False,
            "expires_on": expires_on,
            "message": "License expired",
            "warning": True,
            "days_left": 0,
        }

    # --------------------------------------------------
    # DAYS LEFT
    # --------------------------------------------------
    delta_seconds = (
        expires_on - now
    ).total_seconds()

    days_left = ceil(
        delta_seconds / 86400
    )

    # --------------------------------------------------
    # WARNING
    # --------------------------------------------------
    warning = days_left <= 7

    if warning:
        message = (
            f"⚠️ License expires in "
            f"{days_left} day(s). Please renew."
        )
    else:
        message = "License valid"

    # --------------------------------------------------
    # RESPONSE
    # --------------------------------------------------
    data = {
        "valid": True,
        "expires_on": expires_on,
        "message": message,
        "warning": warning,
        "days_left": days_left,
    }

    # --------------------------------------------------
    # OFFLINE FALLBACK
    # --------------------------------------------------
    services.save_license_file(data)

    return data



@router.get(
    "/management",
    response_model=list[schemas.LicenseManagementResponse],
)
def get_license_management(
    current_user: UserDisplaySchema = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Super Admin license management.

    Returns the latest license for every business.
    """

    # --------------------------------------------------
    # SUPER ADMIN CHECK
    # --------------------------------------------------
    if current_user.role_code != SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can view license management.",
        )

    # --------------------------------------------------
    # GET BUSINESSES
    # --------------------------------------------------
    businesses = (
        db.query(Business)
        .order_by(Business.name.asc())
        .all()
    )

    results = []

    now = now_wat()

    for business in businesses:

        # ----------------------------------------------
        # GET LATEST LICENSE FOR BUSINESS
        # ----------------------------------------------
        license_record = (
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

        # ----------------------------------------------
        # NO LICENSE
        # ----------------------------------------------
        if not license_record:
            results.append(
                {
                    "business_id": business.id,
                    "business_name": business.name,
                    "is_active": False,
                    "start_date": now,
                    "expiration_date": now,
                    "days_left": 0,
                }
            )

            continue

        # ----------------------------------------------
        # TIMEZONE
        # ----------------------------------------------
        start_date = to_wat(
            license_record.created_at
        )

        expiration_date = to_wat(
            license_record.expiration_date
        )

        # ----------------------------------------------
        # CALCULATE STATUS
        # ----------------------------------------------
        if (
            license_record.is_active
            and expiration_date > now
        ):
            delta_seconds = (
                expiration_date - now
            ).total_seconds()

            days_left = ceil(
                delta_seconds / 86400
            )

            is_active = True

        else:
            days_left = 0
            is_active = False

        # ----------------------------------------------
        # ADD RESULT
        # ----------------------------------------------
        results.append(
            {
                "business_id": business.id,
                "business_name": business.name,
                "is_active": is_active,
                "start_date": start_date,
                "expiration_date": expiration_date,
                "days_left": days_left,
            }
        )

    return results