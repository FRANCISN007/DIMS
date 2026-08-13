# app/vendors/router.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from app.database import get_db
from app.vendor import models, schemas
from app.users.schemas import UserDisplaySchema
from app.users.permissions import role_required
from app.core.business import resolve_business_id


router = APIRouter()


# ============================================================
# HELPER: GET VENDOR WITHIN CURRENT BUSINESS
# ============================================================

def get_business_vendor(
    db: Session,
    vendor_id: int,
    business_id: int,
):
    vendor = (
        db.query(models.Vendor)
        .filter(
            models.Vendor.id == vendor_id,
            models.Vendor.business_id == business_id,
        )
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found for this business.",
        )

    return vendor


# ============================================================
# HELPER: VALIDATE / CLEAN VENDOR DATA
# ============================================================

def normalize_vendor_data(vendor):
    """
    Clean input but preserve the vendor name exactly as entered.

    Example:
        " ABC Supplies " -> "ABC Supplies"

    The name is NOT converted to lowercase.
    Lowercase is only used internally for duplicate checking.
    """

    name = (vendor.business_name or "").strip()
    address = (vendor.address or "").strip()
    phone = (vendor.phone_number or "").strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Vendor name is required.",
        )

    normalized_name = name.lower()

    return name, address, phone, normalized_name


# ============================================================
# CREATE VENDOR
# ============================================================

@router.post(
    "/",
    response_model=schemas.VendorOut,
)
def create_vendor(
    vendor: schemas.VendorCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(["store"])
    ),
):
    """
    Create a vendor.

    Access:
        - Super Admin
        - Admin
        - Store

    Business:
        - Super Admin can provide/select business_id.
        - Admin/Store use their own business_id.
    """

    # ========================================================
    # RESOLVE BUSINESS
    # ========================================================

    business_id = resolve_business_id(
        current_user,
        business_id,
    )

    # ========================================================
    # VALIDATE INPUT
    # ========================================================

    name, address, phone, normalized_name = normalize_vendor_data(
        vendor
    )

    # ========================================================
    # CHECK DUPLICATE
    # ========================================================

    existing = (
        db.query(models.Vendor)
        .filter(
            models.Vendor.business_id == business_id,
            func.lower(models.Vendor.business_name)
            == normalized_name,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Vendor name already exists for this business.",
        )

    # ========================================================
    # CREATE VENDOR
    # ========================================================

    new_vendor = models.Vendor(
        business_name=name,
        address=address,
        phone_number=phone,
        business_id=business_id,
    )

    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)

    return new_vendor


# ============================================================
# SIMPLE VENDOR LIST
# Used mainly for dropdowns
# ============================================================

@router.get(
    "/simple",
)
def list_vendors_simple(
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(["store"])
    ),
):
    """
    Return simple vendor information for dropdowns.

    Access:
        - Super Admin
        - Admin
        - Store
    """

    # ========================================================
    # RESOLVE BUSINESS
    # ========================================================

    business_id = resolve_business_id(
        current_user,
        business_id,
    )

    # ========================================================
    # FETCH VENDORS
    # ========================================================

    vendors = (
        db.query(
            models.Vendor.id,
            models.Vendor.business_name,
        )
        .filter(
            models.Vendor.business_id == business_id,
        )
        .order_by(
            models.Vendor.business_name.asc(),
        )
        .all()
    )

    return [
        {
            "id": vendor.id,
            "name": vendor.business_name,
        }
        for vendor in vendors
    ]


# ============================================================
# LIST ALL VENDORS
# ============================================================

@router.get(
    "/",
    response_model=List[schemas.VendorOut],
)
def list_vendors(
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(["store", "procurement"])
    ),
):
    """
    List vendors belonging only to the current business.

    Access:
        - Super Admin
        - Admin
        - Store
    """

    # ========================================================
    # RESOLVE BUSINESS
    # ========================================================

    business_id = resolve_business_id(
        current_user,
        business_id,
    )

    # ========================================================
    # FETCH TENANT VENDORS
    # ========================================================

    vendors = (
        db.query(models.Vendor)
        .filter(
            models.Vendor.business_id == business_id,
        )
        .order_by(
            models.Vendor.business_name.asc(),
        )
        .all()
    )

    return vendors


# ============================================================
# GET SINGLE VENDOR
# ============================================================

@router.get(
    "/{vendor_id}",
    response_model=schemas.VendorOut,
)
def get_vendor(
    vendor_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(["store"])
    ),
):
    """
    Get one vendor belonging to the current business.

    Access:
        - Super Admin
        - Admin
        - Store
    """

    # ========================================================
    # RESOLVE BUSINESS
    # ========================================================

    business_id = resolve_business_id(
        current_user,
        business_id,
    )

    # ========================================================
    # GET BUSINESS VENDOR
    # ========================================================

    return get_business_vendor(
        db,
        vendor_id,
        business_id,
    )


# ============================================================
# UPDATE VENDOR
# ============================================================

@router.put(
    "/{vendor_id}",
    response_model=schemas.VendorOut,
)
def update_vendor(
    vendor_id: int,
    updated_data: schemas.VendorCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(["store"])
    ),
):
    """
    Update a vendor.

    Access:
        - Super Admin
        - Admin
        - Store
    """

    # ========================================================
    # RESOLVE BUSINESS
    # ========================================================

    business_id = resolve_business_id(
        current_user,
        business_id,
    )

    # ========================================================
    # FIND VENDOR
    # ========================================================

    vendor = get_business_vendor(
        db,
        vendor_id,
        business_id,
    )

    # ========================================================
    # VALIDATE INPUT
    # ========================================================

    name, address, phone, normalized_name = normalize_vendor_data(
        updated_data
    )

    # ========================================================
    # CHECK DUPLICATE
    # ========================================================

    duplicate = (
        db.query(models.Vendor)
        .filter(
            models.Vendor.business_id == business_id,
            func.lower(models.Vendor.business_name)
            == normalized_name,
            models.Vendor.id != vendor_id,
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=400,
            detail="Vendor name already exists for this business.",
        )

    # ========================================================
    # UPDATE
    # ========================================================

    vendor.business_name = name
    vendor.address = address
    vendor.phone_number = phone

    db.commit()
    db.refresh(vendor)

    return vendor


# ============================================================
# DELETE VENDOR
# ============================================================

@router.delete(
    "/{vendor_id}",
)
def delete_vendor(
    vendor_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(["store"])
    ),
):
    """
    Delete a vendor.

    Access:
        - Super Admin
        - Admin
        - Store

    A vendor cannot be deleted if it has purchases.
    """

    # ========================================================
    # RESOLVE BUSINESS
    # ========================================================

    business_id = resolve_business_id(
        current_user,
        business_id,
    )

    # ========================================================
    # FIND VENDOR
    # ========================================================

    vendor = get_business_vendor(
        db,
        vendor_id,
        business_id,
    )

    # ========================================================
    # CHECK PURCHASE RELATIONSHIP
    # ========================================================

    if vendor.purchases:
        raise HTTPException(
            status_code=400,
            detail=(
                "Vendor cannot be deleted because "
                "it is linked to purchases."
            ),
        )

    # ========================================================
    # DELETE
    # ========================================================

    db.delete(vendor)
    db.commit()

    return {
        "detail": "Vendor deleted successfully."
    }