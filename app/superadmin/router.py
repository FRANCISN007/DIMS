
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.hash import argon2
import os

from app.database import get_db
from app.users import models
from app.users.schemas import (
    SuperAdminCreate,
    SuperAdminUpdate,
)
from app.users.auth import get_password_hash


router = APIRouter()


# ==========================================================
# VERIFY ADMIN LICENSE PASSWORD
# ==========================================================

def verify_admin_license_password(
    plain_password: str,
) -> bool:

    stored_hash = os.getenv(
        "ADMIN_LICENSE_PASSWORD_HASH"
    )

    if not stored_hash:
        return False

    try:
        return argon2.verify(
            plain_password,
            stored_hash,
        )

    except Exception:
        return False


# ==========================================================
# BOOTSTRAP SUPER ADMIN
# ==========================================================

@router.post("/bootstrap-super-admin")
def bootstrap_super_admin(
    data: SuperAdminCreate,
    db: Session = Depends(get_db),
):
    """
    Create the FIRST Super Admin.

    Super Admin:
        - Has no business
        - Has no location
        - Does not require a database role
        - Is identified by business_id = NULL
        - Can access the entire system
    """

    # ======================================================
    # 1. CHECK WHETHER SUPER ADMIN ALREADY EXISTS
    # ======================================================

    existing_super_admin = (
        db.query(models.User)
        .filter(
            models.User.business_id.is_(None)
        )
        .first()
    )

    if existing_super_admin:
        raise HTTPException(
            status_code=403,
            detail="Super Admin already exists.",
        )

    # ======================================================
    # 2. VERIFY ADMIN LICENSE PASSWORD
    # ======================================================

    if not verify_admin_license_password(
        data.admin_license_password
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid Admin License password.",
        )

    # ======================================================
    # 3. NORMALIZE USERNAME
    # ======================================================

    username = (
        data.username
        .strip()
        .lower()
    )

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Username is required.",
        )

    # ======================================================
    # 4. CHECK USERNAME
    # ======================================================

    existing_username = (
        db.query(models.User)
        .filter(
            models.User.username == username
        )
        .first()
    )

    if existing_username:
        raise HTTPException(
            status_code=409,
            detail="Username already exists.",
        )

    # ======================================================
    # 5. CREATE SUPER ADMIN
    # ======================================================

    user = models.User(
        username=username,

        full_name=(
            data.full_name.strip()
            if data.full_name
            else "System Administrator"
        ),

        phone=None,

        hashed_password=get_password_hash(
            data.password
        ),

        # --------------------------------------------------
        # SUPER ADMIN HAS NO BUSINESS
        # --------------------------------------------------

        business_id=None,

        # --------------------------------------------------
        # SUPER ADMIN HAS NO LOCATION
        # --------------------------------------------------

        location_id=None,

        status="active",
    )

    # ======================================================
    # 6. NO ROLE ASSIGNMENT
    # ======================================================
    #
    # Super Admin does NOT need:
    #
    #     role_id
    #
    # or:
    #
    #     user_roles
    #
    # Super Admin is identified by:
    #
    #     business_id = NULL
    #
    # Your authentication layer should translate this into:
    #
    #     SUPER_ADMIN
    #
    # ======================================================

    db.add(user)

    db.commit()

    db.refresh(user)

    return {
        "message": "Super Admin created successfully.",
        "username": user.username,
    }


# ==========================================================
# UPDATE SUPER ADMIN PASSWORD
# ==========================================================

@router.put("/update-super-admin-password")
def update_super_admin_password(
    data: SuperAdminUpdate,
    db: Session = Depends(get_db),
):
    """
    Update Super Admin password.

    The Admin License password is required before
    the password can be changed.
    """

    # ======================================================
    # 1. VERIFY ADMIN LICENSE PASSWORD
    # ======================================================

    if not verify_admin_license_password(
        data.admin_license_password
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid Admin License password.",
        )

    # ======================================================
    # 2. NORMALIZE USERNAME
    # ======================================================

    username = (
        data.username
        .strip()
        .lower()
    )

    # ======================================================
    # 3. FIND SUPER ADMIN
    # ======================================================

    super_admin = (
        db.query(models.User)
        .filter(
            models.User.username == username,
            models.User.business_id.is_(None),
        )
        .first()
    )

    if not super_admin:
        raise HTTPException(
            status_code=404,
            detail="Super Admin not found.",
        )

    # ======================================================
    # 4. UPDATE PASSWORD
    # ======================================================

    super_admin.hashed_password = (
        get_password_hash(
            data.new_password
        )
    )

    db.commit()

    return {
        "message": "Password updated successfully."
    }

