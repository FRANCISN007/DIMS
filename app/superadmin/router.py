from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.hash import argon2
import os

from app.users.schemas import SuperAdminUpdate 
from app.database import get_db
from app.users import models
from app.users.schemas import SuperAdminCreate
from app.users.auth import get_password_hash

router = APIRouter()


def verify_admin_license_password(plain_password: str) -> bool:
    stored_hash = os.getenv("ADMIN_LICENSE_PASSWORD_HASH")
    if not stored_hash:
        return False
    try:
        return argon2.verify(plain_password, stored_hash)
    except Exception:
        return False


@router.post("/bootstrap-super-admin")
def bootstrap_super_admin(
    data: SuperAdminCreate,
    db: Session = Depends(get_db),
):
    """
    Create the FIRST Super Admin.
    """

    # Only one Super Admin is allowed
    existing_super_admin = (
        db.query(models.User)
        .filter(models.User.business_id.is_(None))
        .first()
    )

    if existing_super_admin:
        raise HTTPException(
            status_code=403,
            detail="Super Admin already exists.",
        )

    if not verify_admin_license_password(
        data.admin_license_password
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid Admin License password.",
        )

    user = models.User(
        username=data.username.strip().lower(),
        full_name="System Administrator",
        phone=None,
        hashed_password=get_password_hash(data.password),
        business_id=None,
        role_id=None,
        location_id=None,
        status="active",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Super Admin created successfully."
    }




def verify_admin_license_password(plain_password: str) -> bool:
    stored_hash = os.getenv("ADMIN_LICENSE_PASSWORD_HASH")
    if not stored_hash:
        return False
    try:
        return argon2.verify(plain_password, stored_hash)
    except Exception:
        return False


@router.put("/update-super-admin-password")
def update_super_admin_password(
    data: SuperAdminUpdate,
    db: Session = Depends(get_db),
):
    """
    Update Super Admin password.
    """

    if not verify_admin_license_password(
        data.admin_license_password
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid Admin License password.",
        )

    super_admin = (
        db.query(models.User)
        .filter(
            models.User.username == data.username.strip().lower(),
            models.User.business_id.is_(None),
        )
        .first()
    )

    if not super_admin:
        raise HTTPException(
            status_code=404,
            detail="Super Admin not found.",
        )

    super_admin.hashed_password = get_password_hash(
        data.new_password
    )

    db.commit()

    return {
        "message": "Password updated successfully."
    }