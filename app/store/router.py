from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from datetime import datetime, timedelta
from typing import List
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from app.database import get_db
from app.users.auth import get_current_user
from app.users.permissions import role_required  # 👈 permission helper
from app.users.models import User
from app.users import schemas as user_schemas
from app.store import models as store_models
from app.restaurant import models as restaurant_models
from app.restaurant.models import MealOrder
from app.store import schemas as store_schemas

from datetime import date, datetime, timedelta


from app.locations import models as location_models
from app.locations import schemas as location_schemas

from app.store.inventory_service import (
    rebuild_everything,
    calculate_available_stock,
    deduct_fifo_stock,
    restore_fifo_stock,
)

from app.store.schemas import IssueCreate, IssueDisplay
from app.kitchen.models import Kitchen, KitchenInventory
from app.kitchen import models as kitchen_models
from app.kitchen import schemas as kitchen_schemas
from app.kitchen.schemas import IssueToKitchenItemDisplay, KitchenDisplaySimple, IssueToKitchenDisplay, IssueToKitchenCreate, KitchenItemMinimalDisplay
from app.store.models import StoreIssue, StoreIssueItem, StoreStockEntry, StoreCategory, StoreItem
from app.vendor import models as vendor_models
from app.store.models import StoreInventoryAdjustment
from app.store.schemas import  StoreInventoryAdjustmentCreate, StoreItemDisplay



from app.business import models as business_models  # make sure business model is imported

from app.store.schemas import  StoreInventoryAdjustmentCreate, StoreItemDisplay, KitchenItemSimple


from sqlalchemy.orm import aliased
from fastapi import Form
from sqlalchemy import desc, func

from fastapi import Query
from datetime import date

from sqlalchemy.orm import joinedload
from fastapi import File, UploadFile, Form
import os

from fastapi.responses import JSONResponse
import shutil

from app.core.db import db_dependency
#from app.users.auth import role_required
from app.core.business import resolve_business_id

from sqlalchemy.orm import selectinload
from datetime import datetime, timezone


from app.core.timezone import now_wat, to_wat  # ✅ centralized WAT functions

from zoneinfo import ZoneInfo




router = APIRouter()

WAT = ZoneInfo("Africa/Lagos")

# ----------------------------
# CATEGORY ROUTES
# ----------------------------




# ----------------------------
# Create Category
# ----------------------------

@router.post(
    "/categories",
    response_model=store_schemas.StoreCategoryDisplay,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    category: store_schemas.StoreCategoryCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store"])
    ),
):
    # ==================================================
    # RESOLVE BUSINESS
    # ==================================================

    business_id = resolve_business_id(
        current_user,
        business_id,
    )

    # ==================================================
    # NORMALIZE CATEGORY NAME
    # ==================================================

    category_name = category.name.strip()

    # ==================================================
    # CHECK DUPLICATE
    # ==================================================

    existing = (
        db.query(store_models.StoreCategory)
        .filter(
            store_models.StoreCategory.business_id == business_id,
            store_models.StoreCategory.name.ilike(category_name),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category already exists for this business.",
        )

    # ==================================================
    # CREATE CATEGORY
    # ==================================================

    new_category = store_models.StoreCategory(
        name=category_name,
        business_id=business_id,
    )

    db.add(new_category)
    db.commit()
    db.refresh(new_category)

    return new_category


# ----------------------------
# List Categories
# ----------------------------
@router.get("/categories", response_model=list[store_schemas.StoreCategoryDisplay])
def list_categories(
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store" , "procurement"]))
):
    # ✅ Resolve + validate tenancy
    business_id = resolve_business_id(current_user, business_id)

    # ✅ Fetch only tenant data
    categories = (
        db.query(store_models.StoreCategory)
        .filter(store_models.StoreCategory.business_id == business_id)
        .order_by(store_models.StoreCategory.name.asc())
        .all()
    )

    return categories



# ----------------------------
# Update Category
# ----------------------------
@router.put("/categories/{category_id}", response_model=store_schemas.StoreCategoryDisplay)
def update_category(
    category_id: int,
    update_data: store_schemas.StoreCategoryCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):

    business_id = resolve_business_id(current_user, business_id)

    category = (
        db.query(store_models.StoreCategory)
        .filter(
            store_models.StoreCategory.id == category_id,
            store_models.StoreCategory.business_id == business_id
        )
        .first()
    )

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    existing = (
        db.query(store_models.StoreCategory)
        .filter(
            store_models.StoreCategory.name == update_data.name,
            store_models.StoreCategory.business_id == business_id,
            store_models.StoreCategory.id != category_id
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    category.name = update_data.name

    db.commit()
    db.refresh(category)

    return category


# ----------------------------
# Delete Category
# ----------------------------
@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):

    business_id = resolve_business_id(current_user, business_id)

    category = (
        db.query(store_models.StoreCategory)
        .filter(
            store_models.StoreCategory.id == category_id,
            store_models.StoreCategory.business_id == business_id
        )
        .first()
    )

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()

    return {"detail": "Category deleted successfully"}

# --------------------------------------------------
# Create Store Item
# --------------------------------------------------
@router.post("/items", response_model=store_schemas.StoreItemDisplay)
def create_item(
    item: store_schemas.StoreItemCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    try:
        business_id = resolve_business_id(current_user, business_id)

        existing = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.name == item.name,
                store_models.StoreItem.business_id == business_id
            )
            .first()
        )

        if existing:
            raise HTTPException(status_code=400, detail="Item already exists")

        new_item = store_models.StoreItem(
            **item.dict(),
            business_id=business_id
        )

        db.add(new_item)
        db.commit()
        db.refresh(new_item)

        return new_item

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


# --------------------------------------------------
# List Store Items
# --------------------------------------------------
@router.get("/items", response_model=list[store_schemas.StoreItemDisplay])
def list_items(
    category: Optional[str] = None,
    search: Optional[str] = None,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "procurement"]))
):
    try:
        business_id = resolve_business_id(current_user, business_id)

        latest_entry_subquery = (
            db.query(
                store_models.StoreStockEntry.item_id,
                func.max(store_models.StoreStockEntry.id).label("latest_entry_id")
            )
            .group_by(store_models.StoreStockEntry.item_id)
            .subquery()
        )

        latest_entry = aliased(store_models.StoreStockEntry)

        query = (
            db.query(
                store_models.StoreItem,
                latest_entry.unit_price.label("latest_cost_price")
            )
            .outerjoin(
                latest_entry_subquery,
                store_models.StoreItem.id == latest_entry_subquery.c.item_id
            )
            .outerjoin(
                latest_entry,
                latest_entry.id == latest_entry_subquery.c.latest_entry_id
            )
            .filter(store_models.StoreItem.business_id == business_id)
        )

        if category:
            query = (
                query.join(store_models.StoreItem.category)
                .filter(store_models.StoreCategory.name == category)
            )

        if search:
            query = query.filter(
                store_models.StoreItem.name.ilike(f"%{search}%")
            )

        results = query.order_by(store_models.StoreItem.name.asc()).all()

        return [
            store_schemas.StoreItemDisplay(
                id=item.id,
                name=item.name,
                unit=item.unit,
                category=item.category,
                unit_price=latest_cost_price or 0.0,
                selling_price=item.selling_price or 0.0,
                created_at=item.created_at,
                item_type=item.item_type
            )
            for item, latest_cost_price in results
        ]

    except Exception as e:
        print("💥 Error:", e)
        raise HTTPException(status_code=500, detail=str(e))



# --------------------------------------------------
# List Store Items
# --------------------------------------------------
@router.get("/store-items")
def list_store_items(
    category: Optional[str] = None,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "procurement"]))
):

    business_id = resolve_business_id(current_user, business_id)

    query = db.query(store_models.StoreItem).filter(
        store_models.StoreItem.business_id == business_id
    )

    if category:
        query = query.join(store_models.StoreItem.category).filter(
            store_models.StoreCategory.name == category
        )

    return query.order_by(store_models.StoreItem.name.asc()).all()


# --------------------------------------------------
# Simple Item List
# --------------------------------------------------
@router.get("/items/simple", response_model=List[store_schemas.StoreItemOut])
def list_items_simple(
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "procurement"]))
):
    try:
        business_id = resolve_business_id(current_user, business_id)

        latest_entry_subquery = (
            db.query(
                store_models.StoreStockEntry.item_id,
                func.max(store_models.StoreStockEntry.id).label("latest_entry_id")
            )
            .group_by(store_models.StoreStockEntry.item_id)
            .subquery()
        )

        latest_entry = aliased(store_models.StoreStockEntry)

        query = (
            db.query(
                store_models.StoreItem,
                latest_entry.unit_price
            )
            .outerjoin(
                latest_entry_subquery,
                store_models.StoreItem.id == latest_entry_subquery.c.item_id
            )
            .outerjoin(
                latest_entry,
                latest_entry.id == latest_entry_subquery.c.latest_entry_id
            )
            .filter(store_models.StoreItem.business_id == business_id)
            .order_by(store_models.StoreItem.id.asc())
        )

        results = query.all()

        items = []
        for item, unit_price in results:
            items.append(
                store_schemas.StoreItemOut(
                    id=item.id,
                    name=item.name,
                    unit=item.unit,
                    unit_price=unit_price or 0.0,
                    selling_price=item.selling_price or 0.0,
                    category_id=item.category_id,
                    item_type=item.item_type
                )
            )

        return items

    except Exception as e:
        print("❌ Error in /items/simple:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch items.")
    


@router.get("/items/simple-search", response_model=List[store_schemas.StoreItemOut])
def list_items_simple_search(
    search: Optional[str] = Query(None),
    limit: int = Query(20, le=50),  # 🔥 keep small for speed
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "procurement"])
    )
):
    try:
        # ------------------------------
        # 1️⃣ Resolve tenant
        # ------------------------------
        business_id = resolve_business_id(current_user, business_id)

        # ------------------------------
        # 2️⃣ Base query (LIGHTWEIGHT)
        # ------------------------------
        query = (
            db.query(
                store_models.StoreItem.id,
                store_models.StoreItem.name,
                store_models.StoreItem.unit,
                store_models.StoreItem.unit_price,
                store_models.StoreItem.selling_price,
                store_models.StoreItem.category_id,
                store_models.StoreItem.item_type,
            )
            .filter(store_models.StoreItem.business_id == business_id)
        )

        # ------------------------------
        # 3️⃣ FAST SEARCH (INDEX FRIENDLY 🔥)
        # ------------------------------
        if search:
            search = search.strip().lower()

            query = query.filter(
                store_models.StoreItem.name.ilike(f"%{search}%")  # 🔥 prefix search
            )

        # ------------------------------
        # 4️⃣ ORDER + LIMIT (VERY IMPORTANT)
        # ------------------------------
        items = (
            query
            .order_by(store_models.StoreItem.name.asc())
            .limit(limit)
            .all()
        )

        # ------------------------------
        # 5️⃣ FORMAT RESPONSE
        # ------------------------------
        return [
            store_schemas.StoreItemOut(
                id=item.id,
                name=item.name,
                unit=item.unit,
                unit_price=item.unit_price or 0.0,
                selling_price=item.selling_price or 0.0,
                category_id=item.category_id,
                item_type=item.item_type
            )
            for item in items
        ]

    except Exception as e:
        print("❌ Error in /items/simple-search:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch items.")






# --------------------------------------------------
# Update Store Item
# --------------------------------------------------
@router.put("/items/{item_id}", response_model=store_schemas.StoreItemDisplay)
def update_item(
    item_id: int,
    update_data: store_schemas.StoreItemCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    business_id = resolve_business_id(current_user, business_id)

    item = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.id == item_id,
            store_models.StoreItem.business_id == business_id
        )
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Check for duplicate name within the same business
    existing = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.name == update_data.name,
            store_models.StoreItem.id != item_id,
            store_models.StoreItem.business_id == business_id
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Item name already exists")

    for field, value in update_data.dict().items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


# --------------------------------------------------
# Delete Store Item
# --------------------------------------------------
@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    business_id = resolve_business_id(current_user, business_id)

    item = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.id == item_id,
            store_models.StoreItem.business_id == business_id
        )
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    purchase_exists = (
        db.query(store_models.StoreStockEntry)
        .filter(
            store_models.StoreStockEntry.item_id == item_id,
            store_models.StoreStockEntry.business_id == business_id,
        )
        .first()
    )

    if purchase_exists:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete item because it has purchase history."
        )
    
    issue_exists = (
        db.query(store_models.StoreIssueItem)
        .filter(
            store_models.StoreIssueItem.item_id == item_id,
            store_models.StoreIssueItem.business_id == business_id,
        )
        .first()
    )

    if issue_exists:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete item because it has issue history."
        )



    store_inventory = (
        db.query(store_models.StoreInventory)
        .filter(
            store_models.StoreInventory.item_id == item_id,
            store_models.StoreInventory.business_id == business_id,
        )
        .first()
    )

    if store_inventory:

        if store_inventory.quantity > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete item because store inventory is greater than zero."
            )

        db.delete(store_inventory)


    kitchen_inventory = (
        db.query(kitchen_models.KitchenInventory)
        .filter(
            kitchen_models.KitchenInventory.item_id == item_id,
            kitchen_models.KitchenInventory.business_id == business_id,
        )
        .all()
    )

    



    

    


    db.delete(item)
    db.commit()

    return {"detail": "Item deleted successfully"}

# ----------------------------
# PURCHASE / STOCK ENTRY
# ----------------------------

@router.post(
    "/purchases",
    response_model=store_schemas.PurchaseCreateList
)
async def receive_inventory(
    entry: store_schemas.StoreStockEntryCreate = Depends(
        store_schemas.StoreStockEntryCreate.as_form
    ),
    attachment: UploadFile = File(None),
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store"])
    ),
):
    """
    Receive inventory / Create purchase (stock entry).

    Access:
    - Store
    - Admin
    - Super Admin

    Business/location:
    - Business is resolved automatically from the logged-in user.
    - Location is NOT required for store purchases.
    """

    # ==================================================
    # RESOLVE BUSINESS
    # ==================================================

    business_id = resolve_business_id(
        current_user,
        business_id,
    )

    # ==================================================
    # VALIDATE ITEM
    # ==================================================

    item = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.id == entry.item_id,
            store_models.StoreItem.business_id == business_id,
        )
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found for this business",
        )

    # ==================================================
    # COMPUTE TOTAL AMOUNT
    # ==================================================

    total_amount = (
        entry.quantity * entry.unit_price
        if entry.unit_price is not None
        else None
    )

    # ==================================================
    # SAVE ATTACHMENT
    # ==================================================

    attachment_path = None

    if attachment:
        upload_dir = "uploads/store_invoices"

        os.makedirs(
            upload_dir,
            exist_ok=True,
        )

        # Use WAT time for filename
        timestamp = now_wat().strftime(
            "%Y%m%d%H%M%S"
        )

        filename = (
            f"{timestamp}_{attachment.filename}"
        )

        file_location = os.path.join(
            upload_dir,
            filename,
        )

        with open(file_location, "wb") as f:
            f.write(await attachment.read())

        attachment_path = file_location

    # ==================================================
    # PURCHASE DATE
    # ==================================================

    purchase_date = None

    if entry.purchase_date:
        purchase_date = (
            to_wat(entry.purchase_date)
            .replace(tzinfo=None)
        )

    # ==================================================
    # CREATED DATE
    # ==================================================

    created_at = (
        now_wat()
        .replace(tzinfo=None)
    )

    # ==================================================
    # CREATE STOCK ENTRY
    # ==================================================

    stock_entry = store_models.StoreStockEntry(
        item_id=entry.item_id,
        item_name=entry.item_name,
        invoice_number=entry.invoice_number,
        quantity=entry.quantity,
        original_quantity=entry.quantity,
        unit_price=entry.unit_price,
        total_amount=total_amount,
        vendor_id=entry.vendor_id,

        # Tenant / Business
        business_id=business_id,

        purchase_date=purchase_date,
        created_by=current_user.username,
        created_at=created_at,
        attachment=attachment_path,
    )

    db.add(stock_entry)

    db.commit()

    db.refresh(stock_entry)

    # ==================================================
    # LOAD RELATED DATA
    # ==================================================

    stock_entry = (
        db.query(store_models.StoreStockEntry)
        .options(
            selectinload(
                store_models.StoreStockEntry.vendor
            ),
            selectinload(
                store_models.StoreStockEntry.item
            ),
        )
        .filter(
            store_models.StoreStockEntry.id
            == stock_entry.id
        )
        .first()
    )

    return stock_entry


@router.get("/purchases", response_model=dict)
def list_purchases(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    invoice_number: Optional[str] = Query(None),
    vendor_name: Optional[str] = Query(None),
    vendor_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
    business_id: Optional[int] = Query(None, description="Super admin must provide business_id"),
    request: Request = None,
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "procurement", "admin", "super_admin"]))
):
    # =========================
    # ✅ Resolve tenant context (STRICT)
    # =========================
    effective_business_id = resolve_business_id(current_user, business_id)

    # =========================
    # ✅ Base query (TENANT SAFE)
    # =========================
    query = (
        db.query(store_models.StoreStockEntry)
        .options(
            selectinload(store_models.StoreStockEntry.vendor),
            selectinload(store_models.StoreStockEntry.item),
        )
        .filter(store_models.StoreStockEntry.business_id == effective_business_id)
    )

    # =========================
    # ✅ Date filters
    # =========================
    

    if start_date:
        query = query.filter(
            store_models.StoreStockEntry.purchase_date >= datetime.combine(start_date, datetime.min.time())
        )

    if end_date:
        query = query.filter(
            store_models.StoreStockEntry.purchase_date < datetime.combine(end_date + timedelta(days=1), datetime.min.time())
        )

    # =========================
    # ✅ Invoice filter
    # =========================
    if invoice_number:
        query = query.filter(
            store_models.StoreStockEntry.invoice_number.ilike(f"%{invoice_number}%")
        )

    # =========================
    # ✅ Vendor filters
    # =========================
    if vendor_id:
        query = query.filter(store_models.StoreStockEntry.vendor_id == vendor_id)

    if vendor_name:
        query = query.join(store_models.StoreStockEntry.vendor).filter(
            vendor_models.Vendor.business_name.ilike(f"%{vendor_name}%")
        )

    # =========================
    # ✅ Item filter
    # =========================
    if item_id:
        query = query.filter(store_models.StoreStockEntry.item_id == item_id)

    # =========================
    # ✅ Execute query
    # =========================
    purchases = (
        query.order_by(store_models.StoreStockEntry.created_at.desc())
        .all()
    )

    # =========================
    # ✅ Build response
    # =========================
    results = []
    total_amount = 0

    for p in purchases:
        attachment_url = None

        if p.attachment and request:
            rel_path = os.path.relpath(p.attachment, "uploads").replace("\\", "/")
            base_url = str(request.base_url).rstrip("/")
            attachment_url = f"{base_url}/files/{rel_path}"

        total_amount += p.total_amount or 0

        results.append({
            "id": p.id,
            "item_id": p.item_id,
            "item_name": p.item.name if p.item else "",
            "invoice_number": p.invoice_number,
            "quantity": p.original_quantity,
            "unit_price": p.unit_price,
            "total_amount": p.total_amount,
            "vendor_id": p.vendor_id,
            "vendor_name": p.vendor.business_name if p.vendor else "",
            "purchase_date": p.purchase_date,
            "created_by": p.created_by,
            "created_at": p.created_at,
            "attachment_url": attachment_url,
        })

    return {
        "total_entries": len(results),
        "total_amount": total_amount,
        "purchases": results,
    }



from fastapi import HTTPException, UploadFile, File, Form
from datetime import datetime
import os

# ----------------------------
# UPDATE PURCHASE
# ----------------------------
@router.put("/purchases/{entry_id}", response_model=store_schemas.UpdatePurchase)
async def update_purchase(
    entry_id: int,
    item_id: int = Form(...),
    item_name: str = Form(...),
    invoice_number: str = Form(...),
    quantity: float = Form(...),          # new original quantity
    unit_price: float = Form(...),
    vendor_id: Optional[int] = Form(None),
    purchase_date: datetime = Form(...),
    attachment: UploadFile = File(None),
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    """
    Update an existing purchase/stock entry with proper WAT timezone handling
    """
    # Resolve business
    business_id = resolve_business_id(current_user, business_id)

    # Load existing entry
    entry = (
        db.query(store_models.StoreStockEntry)
        .filter(
            store_models.StoreStockEntry.id == entry_id,
            store_models.StoreStockEntry.business_id == business_id
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase entry not found for this business")

    # Validate item belongs to the business
    item = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.id == item_id,
            store_models.StoreItem.business_id == business_id
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found for this business")

    # Calculate already issued quantity
    old_original = float(entry.original_quantity or 0)
    old_remaining = float(entry.quantity or 0)
    already_issued = max(old_original - old_remaining, 0)

    # Business logic checks
    if item_id != entry.item_id and already_issued > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot change item when quantity has already been issued."
        )

    if quantity < already_issued:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reduce quantity below already issued amount ({int(already_issued)})."
        )

    new_remaining = quantity - already_issued

    # Handle new attachment
    if attachment:
        upload_dir = "uploads/store_invoices"
        os.makedirs(upload_dir, exist_ok=True)

        timestamp = now_wat().strftime("%Y%m%d%H%M%S")
        filename = f"{timestamp}_{attachment.filename}"
        file_location = os.path.join(upload_dir, filename)

        with open(file_location, "wb") as f:
            f.write(await attachment.read())

        entry.attachment = file_location

    # === Proper WAT timezone normalization (same pattern as create) ===
    if purchase_date:
        purchase_date = to_wat(purchase_date).replace(tzinfo=None)

    # Update fields
    entry.item_id = item_id
    entry.item_name = item_name
    entry.invoice_number = invoice_number
    entry.original_quantity = quantity
    entry.quantity = new_remaining
    entry.unit_price = unit_price
    entry.vendor_id = vendor_id
    entry.purchase_date = purchase_date
    entry.total_amount = quantity * unit_price if unit_price is not None else None

    # Audit fields
    if hasattr(entry, "updated_by"):
        entry.updated_by = current_user.username
    if hasattr(entry, "updated_at"):
        entry.updated_at = now_wat().replace(tzinfo=None)   # Use same as create

    db.commit()
    db.refresh(entry)

    # Reload with relationships
    entry = (
        db.query(store_models.StoreStockEntry)
        .options(
            selectinload(store_models.StoreStockEntry.vendor),
            selectinload(store_models.StoreStockEntry.item),
        )
        .get(entry.id)
    )

    # Safe attachment URL
    attachment_url = None
    if entry.attachment:
        try:
            rel_path = os.path.relpath(entry.attachment, "uploads").replace(os.sep, "/")
            attachment_url = f"/files/{rel_path}"
        except Exception:
            attachment_url = None

    # === Return using manual construction (like your working list_items) ===
    # This ensures datetimes are passed cleanly without Pydantic timezone misinterpretation
    return {
        "id": entry.id,
        "item_id": entry.item_id,
        "item_name": getattr(entry.item, "name", entry.item_name or ""),
        "invoice_number": entry.invoice_number,
        "quantity": entry.original_quantity,
        "unit_price": entry.unit_price,
        "total_amount": entry.total_amount,
        "vendor_id": entry.vendor_id,
        "vendor_name": getattr(entry.vendor, "business_name", ""),
        "purchase_date": entry.purchase_date,
        "created_by": entry.created_by,
        "created_at": entry.created_at,          # This will now be consistent
        "updated_by": getattr(entry, "updated_by", None),
        "updated_at": getattr(entry, "updated_at", None),
        "attachment": entry.attachment,
        "attachment_url": attachment_url,
    }

# ----------------------------
# DELETE PURCHASE
# ----------------------------
@router.delete("/purchases/{entry_id}")
def delete_purchase(
    entry_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store"]))
):
    # Resolve business
    business_id = resolve_business_id(current_user, business_id)

    # Fetch purchase entry
    entry = (
        db.query(store_models.StoreStockEntry)
        .filter(
            store_models.StoreStockEntry.id == entry_id,
            store_models.StoreStockEntry.business_id == business_id
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase entry not found for this business")

    # Prevent deletion if any units issued
    if entry.quantity < entry.original_quantity:
        issued_amount = entry.original_quantity - entry.quantity
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete this purchase. {issued_amount} unit(s) have already been issued. Delete the issues first."
        )

    db.delete(entry)
    db.commit()

    return {"detail": "Purchase entry deleted successfully"}




# ----------------------------
# Helpers
# ----------------------------
def now_wat() -> datetime:
    """Return current time in Africa/Lagos as timezone-aware datetime"""
    return datetime.now(WAT)


def now_utc() -> datetime:
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)


# ----------------------------
# Issue to Kitchen Endpoint
# ----------------------------
@router.post("/kitchen", response_model=IssueToKitchenDisplay)
def issue_kitchen(
    issue_data: IssueToKitchenCreate,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin"])
    ),
):
    # ----------------------------
    # Resolve Business
    # ----------------------------
    business_id = resolve_business_id(current_user, business_id)

    if not issue_data.issue_items:
        raise HTTPException(
            status_code=400,
            detail="No items provided for issue."
        )

    # ----------------------------
    # Issue Date
    # ----------------------------
    issue_date = issue_data.issue_date or now_utc()

    if issue_date.tzinfo is None:
        issue_date = issue_date.replace(tzinfo=timezone.utc)
    else:
        issue_date = issue_date.astimezone(timezone.utc)

    issue_date_wat = issue_date.astimezone(WAT)

    if (
        issue_date_wat.date() != now_wat().date()
        and "admin" not in current_user.roles
    ):
        raise HTTPException(
            status_code=400,
            detail="Only admins can post issues for a past date."
        )

    # ----------------------------
    # Validate Kitchen
    # ----------------------------
    kitchen = (
        db.query(kitchen_models.Kitchen)
        .filter(
            kitchen_models.Kitchen.id == issue_data.kitchen_id,
            kitchen_models.Kitchen.business_id == business_id,
        )
        .first()
    )

    if not kitchen:
        raise HTTPException(
            status_code=404,
            detail="Kitchen not found"
        )

    # ----------------------------
    # Create Store Issue
    # ----------------------------
    issue = store_models.StoreIssue(
        business_id=business_id,
        issue_to="kitchen",
        issued_by_id=current_user.id,
        kitchen_id=issue_data.kitchen_id,
        issue_date=issue_date,
    )

    db.add(issue)
    db.flush()

    issue_items_display: List[IssueToKitchenItemDisplay] = []

    # ----------------------------
    # Process Items
    # ----------------------------
    for item_data in issue_data.issue_items:

        item_obj = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.id == item_data.item_id,
                store_models.StoreItem.business_id == business_id,
            )
            .first()
        )

        if not item_obj:
            raise HTTPException(
                status_code=404,
                detail=f"Item {item_data.item_id} not found"
            )

        
        available_stock = calculate_available_stock(
            db=db,
            business_id=business_id,
            item_id=item_data.item_id,
        )

        if available_stock < item_data.quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough inventory for "
                    f"{item_obj.name}. "
                    f"Available: {available_stock}"
                )
            )

        # ----------------------------
        # Create Issue Item
        # ----------------------------
        issue_item = store_models.StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
            business_id=business_id
        )

        db.add(issue_item)
        db.flush()

        deduct_fifo_stock(
            db=db,
            business_id=business_id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
        )

        # ----------------------------
        # Update Kitchen Inventory
        # ----------------------------
        kitchen_inventory = (
            db.query(kitchen_models.KitchenInventory)
            .filter(
                kitchen_models.KitchenInventory.kitchen_id == issue.kitchen_id,
                kitchen_models.KitchenInventory.item_id == item_data.item_id,
                kitchen_models.KitchenInventory.business_id == business_id,
            )
            .first()
        )

        if kitchen_inventory:
            kitchen_inventory.quantity += item_data.quantity
        else:
            kitchen_inventory = kitchen_models.KitchenInventory(
                business_id=business_id,
                kitchen_id=issue.kitchen_id,
                item_id=item_data.item_id,
                quantity=item_data.quantity,
            )
            db.add(kitchen_inventory)

        issue_items_display.append(
            IssueToKitchenItemDisplay(
                item=KitchenItemMinimalDisplay(
                    id=item_obj.id,
                    name=item_obj.name,
                ),
                quantity=item_data.quantity,
            )
        )

    # ----------------------------
    # Commit
    # ----------------------------
    db.commit()
    db.refresh(issue)

    issue_date_wat = (
        issue.issue_date.replace(tzinfo=timezone.utc).astimezone(WAT)
        if issue.issue_date.tzinfo is None
        else issue.issue_date.astimezone(WAT)
    )

    return IssueToKitchenDisplay(
        id=issue.id,
        kitchen=KitchenDisplaySimple(
            id=kitchen.id,
            name=kitchen.name,
        ),
        issue_items=issue_items_display,
        issue_date=issue_date_wat.isoformat(),
    )


@router.get("/kitchen", response_model=List[IssueToKitchenDisplay])
def list_kitchen_issues(
    kitchen_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):

    business_id = resolve_business_id(current_user, business_id)

    query = db.query(store_models.StoreIssue).filter(
        store_models.StoreIssue.issue_to == "kitchen",
        store_models.StoreIssue.business_id == business_id
    )

    if kitchen_id:
        query = query.filter(store_models.StoreIssue.kitchen_id == kitchen_id)

    if start_date:
        query = query.filter(store_models.StoreIssue.issue_date >= start_date)

    if end_date:
        query = query.filter(store_models.StoreIssue.issue_date <= end_date)

    issues = query.order_by(store_models.StoreIssue.issue_date.desc()).all()

    result = []

    for issue in issues:

        kitchen = db.query(kitchen_models.Kitchen).filter(
            kitchen_models.Kitchen.id == issue.kitchen_id
        ).first()

        kitchen_display = KitchenDisplaySimple(
            id=kitchen.id,
            name=kitchen.name
        ) if kitchen else None

        issue_items_display = []

        for issue_item in issue.issue_items:

            item = db.query(store_models.StoreItem).filter(
                store_models.StoreItem.id == issue_item.item_id
            ).first()

            issue_items_display.append(
                IssueToKitchenItemDisplay(
                    item=KitchenItemMinimalDisplay(
                        id=issue_item.item_id,
                        name=item.name if item else None
                    ),
                    quantity=issue_item.quantity
                )
            )

        result.append(
            IssueToKitchenDisplay(
                id=issue.id,
                kitchen=kitchen_display,
                issue_items=issue_items_display,
                issue_date=issue.issue_date
            )
        )

    return result




WAT = ZoneInfo("Africa/Lagos")


def now_wat() -> datetime:
    """Return current time in Africa/Lagos timezone"""
    return datetime.now(WAT)


@router.put("/kitchen/{issue_id}", response_model=IssueToKitchenDisplay)
def update_kitchen_issue(
    issue_id: int,
    issue_data: IssueToKitchenCreate,
    business_id: Optional[int] = Query(
        None,
        description="Super admin can specify business"
    ),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin"])
    )
):

    # ----------------------------------------------------
    # Resolve Business
    # ----------------------------------------------------
    business_id = resolve_business_id(
        current_user,
        business_id
    )

    # ----------------------------------------------------
    # Existing Issue
    # ----------------------------------------------------
    issue = (
        db.query(store_models.StoreIssue)
        .filter(
            store_models.StoreIssue.id == issue_id,
            store_models.StoreIssue.issue_to == "kitchen",
            store_models.StoreIssue.business_id == business_id,
        )
        .first()
    )

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Kitchen issue not found"
        )

    # ----------------------------------------------------
    # Kitchen
    # ----------------------------------------------------
    kitchen = (
        db.query(kitchen_models.Kitchen)
        .filter(
            kitchen_models.Kitchen.id == issue_data.kitchen_id,
            kitchen_models.Kitchen.business_id == business_id,
        )
        .first()
    )

    if not kitchen:
        raise HTTPException(
            status_code=404,
            detail="Kitchen not found"
        )

    # ----------------------------------------------------
    # Reverse Previous Issue
    # ----------------------------------------------------
    for old_item in issue.issue_items:

        restore_fifo_stock(
            db=db,
            business_id=business_id,
            item_id=old_item.item_id,
            quantity=old_item.quantity,
        )

        kitchen_inventory = (
            db.query(kitchen_models.KitchenInventory)
            .filter(
                kitchen_models.KitchenInventory.business_id == business_id,
                kitchen_models.KitchenInventory.kitchen_id == issue.kitchen_id,
                kitchen_models.KitchenInventory.item_id == old_item.item_id,
            )
            .first()
        )

        if kitchen_inventory:

            kitchen_inventory.quantity -= old_item.quantity

            if kitchen_inventory.quantity < 0:
                kitchen_inventory.quantity = 0

        db.delete(old_item)

    db.flush()

    # ----------------------------------------------------
    # Update Header
    # ----------------------------------------------------
    issue.kitchen_id = issue_data.kitchen_id

    issue_date = issue_data.issue_date or now_utc()

    if issue_date.tzinfo is None:
        issue_date = issue_date.replace(tzinfo=timezone.utc)

    issue.issue_date = issue_date

    issue_items_display = []

    # ----------------------------------------------------
    # New Items
    # ----------------------------------------------------
    for item_data in issue_data.issue_items:

        item_obj = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.id == item_data.item_id,
                store_models.StoreItem.business_id == business_id,
            )
            .first()
        )

        if not item_obj:
            raise HTTPException(
                status_code=404,
                detail=f"Item {item_data.item_id} not found"
            )

        available = calculate_available_stock(
            db=db,
            business_id=business_id,
            item_id=item_data.item_id,
        )

        if available < item_data.quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough inventory for "
                    f"{item_obj.name}. "
                    f"Available: {available}"
                )
            )

        issue_item = store_models.StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
            business_id=business_id,
        )

        db.add(issue_item)
        db.flush()

        deduct_fifo_stock(
            db=db,
            business_id=business_id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
        )

        kitchen_inventory = (
            db.query(kitchen_models.KitchenInventory)
            .filter(
                kitchen_models.KitchenInventory.business_id == business_id,
                kitchen_models.KitchenInventory.kitchen_id == issue.kitchen_id,
                kitchen_models.KitchenInventory.item_id == item_data.item_id,
            )
            .first()
        )

        if kitchen_inventory:

            kitchen_inventory.quantity += item_data.quantity

        else:

            kitchen_inventory = kitchen_models.KitchenInventory(
                business_id=business_id,
                kitchen_id=issue.kitchen_id,
                item_id=item_data.item_id,
                quantity=item_data.quantity,
            )

            db.add(kitchen_inventory)

        issue_items_display.append(
            IssueToKitchenItemDisplay(
                item=KitchenItemMinimalDisplay(
                    id=item_obj.id,
                    name=item_obj.name,
                ),
                quantity=item_data.quantity,
            )
        )

    db.commit()
    db.refresh(issue)

    issue_date_wat = (
        issue.issue_date.astimezone(WAT)
        if issue.issue_date.tzinfo
        else issue.issue_date.replace(
            tzinfo=timezone.utc
        ).astimezone(WAT)
    )

    return IssueToKitchenDisplay(
        id=issue.id,
        kitchen=KitchenDisplaySimple(
            id=kitchen.id,
            name=kitchen.name,
        ),
        issue_items=issue_items_display,
        issue_date=issue_date_wat.isoformat(),
    )



@router.get("/store/kitchen-items/simple-search", response_model=List[KitchenItemSimple])
def search_kitchen_items(
    search: str = Query("", description="Search kitchen items"),
    limit: int = Query(50, description="Max results"),
    business_id: Optional[int] = Query(
        None,
        description="Super admin must provide business_id"
    ),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["kitchen", "store", "admin", "super_admin"])
    ),
):
    """
    Lightweight search for kitchen items (for autocomplete).
    Multi-tenant secured.
    Returns only id, name, and latest selling price.
    """

    # ✅ Resolve tenant (STRICT)
    resolved_business_id = resolve_business_id(current_user, business_id)

    # 🔁 Subquery: latest inventory per item (PER BUSINESS)
    subquery = (
        db.query(
            KitchenInventory.item_id,
            func.max(KitchenInventory.id).label("latest_inventory_id")
        )
        .filter(KitchenInventory.business_id == resolved_business_id)  # 🔒 IMPORTANT
        .group_by(KitchenInventory.item_id)
        .subquery()
    )

    # 🔗 Main query (STRICT tenant filtering)
    query = (
        db.query(
            StoreItem.id.label("item_id"),
            StoreItem.name.label("item_name"),
            StoreItem.selling_price.label("selling_price"),
        )
        .outerjoin(subquery, subquery.c.item_id == StoreItem.id)
        .outerjoin(
            KitchenInventory,
            KitchenInventory.id == subquery.c.latest_inventory_id
        )
        .filter(
            StoreItem.item_type == "kitchen",
            StoreItem.business_id == resolved_business_id  # 🔒 CRITICAL
        )
    )

    # 🔍 Search filter
    if search:
        query = query.filter(StoreItem.name.ilike(f"%{search}%"))

    # ⚡ Limit results
    items = query.order_by(StoreItem.name.asc()).limit(limit).all()

    # 🧾 Format response
    return [
        KitchenItemSimple(
            item_id=item.item_id,
            item_name=item.item_name,
            selling_price=item.selling_price or 0,
        )
        for item in items
    ]



# ----------------------------
# List Kitchen Items
# ----------------------------
@router.get("/store/kitchen-items", response_model=List[StoreItemDisplay])
def list_kitchen_items(
    business_id: Optional[int] = Query(None, description="Super admin can specify business"),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(role_required(["store", "admin"]))
):
    """
    List all store items that are kitchen items.
    Filter directly by item_type='kitchen'.
    """
    # Resolve business/tenant
    if "super_admin" in current_user.roles:
        effective_business_id = business_id
        if not effective_business_id:
            raise HTTPException(status_code=400, detail="Super admin must provide business_id.")
    else:
        effective_business_id = current_user.business_id

    kitchen_items = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.item_type == "kitchen",
            store_models.StoreItem.business_id == effective_business_id
        )
        .order_by(store_models.StoreItem.name.asc())
        .all()
    )
    return kitchen_items


# ----------------------------
# Delete Kitchen Issue
# ----------------------------
@router.delete("/kitchen/{issue_id}", response_model=dict)
def delete_kitchen_issue(
    issue_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin", "super_admin"])
    )
):
    try:

        # ----------------------------------------
        # Resolve Business
        # ----------------------------------------
        business_id = resolve_business_id(
            current_user,
            business_id
        )

        # ----------------------------------------
        # Find Issue
        # ----------------------------------------
        issue = (
            db.query(store_models.StoreIssue)
            .filter(
                store_models.StoreIssue.id == issue_id,
                store_models.StoreIssue.issue_to == "kitchen",
                store_models.StoreIssue.business_id == business_id,
            )
            .first()
        )

        if not issue:
            raise HTTPException(
                status_code=404,
                detail="Kitchen issue not found"
            )

        # ----------------------------------------
        # Restore Store Stock
        # ----------------------------------------
        for item in issue.issue_items:

            remaining = item.quantity

            # ==========================================
            # 1. Restore Purchase Stock
            # ==========================================
            purchases = (
                db.query(store_models.StoreStockEntry)
                .filter(
                    store_models.StoreStockEntry.business_id == business_id,
                    store_models.StoreStockEntry.item_id == item.item_id,
                )
                .order_by(
                    store_models.StoreStockEntry.purchase_date.asc(),
                    store_models.StoreStockEntry.id.asc(),
                )
                .all()
            )

            for purchase in purchases:

                if remaining <= 0:
                    break

                used = purchase.original_quantity - purchase.quantity

                if used <= 0:
                    continue

                restore = min(used, remaining)

                purchase.quantity += restore
                remaining -= restore

            # ==========================================
            # 2. Restore Opening Stock
            # ==========================================
            if remaining > 0:

                inventories = (
                    db.query(store_models.StoreInventory)
                    .filter(
                        store_models.StoreInventory.business_id == business_id,
                        store_models.StoreInventory.item_id == item.item_id,
                    )
                    .order_by(store_models.StoreInventory.id.asc())
                    .all()
                )

                for inventory in inventories:

                    if remaining <= 0:
                        break

                    used = inventory.opening_quantity - inventory.quantity

                    if used <= 0:
                        continue

                    restore = min(used, remaining)

                    inventory.quantity += restore
                    remaining -= restore

            # ==========================================
            # 3. Restore Adjustment Stock
            # ==========================================
            if remaining > 0:

                adjustments = (
                    db.query(store_models.StoreInventoryAdjustment)
                    .filter(
                        store_models.StoreInventoryAdjustment.business_id == business_id,
                        store_models.StoreInventoryAdjustment.item_id == item.item_id,
                        store_models.StoreInventoryAdjustment.quantity_adjusted < 0,
                    )
                    .order_by(
                        store_models.StoreInventoryAdjustment.adjusted_at.asc(),
                        store_models.StoreInventoryAdjustment.id.asc(),
                    )
                    .all()
                )

                for adjustment in adjustments:

                    if remaining <= 0:
                        break

                    added = abs(adjustment.quantity_adjusted)

                    available_to_restore = (
                        added - adjustment.remaining_quantity
                    )

                    if available_to_restore <= 0:
                        continue

                    restore = min(
                        available_to_restore,
                        remaining
                    )

                    adjustment.remaining_quantity += restore
                    remaining -= restore

            # ==========================================
            # 4. Reduce Kitchen Inventory
            # ==========================================
            kitchen_inventory = (
                db.query(kitchen_models.KitchenInventory)
                .filter(
                    kitchen_models.KitchenInventory.business_id == business_id,
                    kitchen_models.KitchenInventory.kitchen_id == issue.kitchen_id,
                    kitchen_models.KitchenInventory.item_id == item.item_id,
                )
                .first()
            )

            if kitchen_inventory:

                kitchen_inventory.quantity -= item.quantity

                if kitchen_inventory.quantity < 0:
                    kitchen_inventory.quantity = 0

            # ==========================================
            # Delete Issue Item
            # ==========================================
            db.delete(item)

        # ----------------------------------------
        # Delete Issue
        # ----------------------------------------
        db.delete(issue)

        db.commit()

        return {
            "message": "Kitchen issue deleted successfully.",
            "issue_id": issue_id,
            "business_id": business_id,
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete kitchen issue: {str(e)}"
        )



@router.post(
    "/location",
    response_model=store_schemas.IssueDisplay
)
def issue_to_location(
    issue_data: store_schemas.IssueCreate,

    business_id: Optional[int] = Query(
        None,
        description="Super admin can specify business"
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store"])
    )
):
    # ==========================================================
    # 1. Resolve Business
    # ==========================================================

    if "super_admin" in current_user.roles:

        if business_id is None:
            raise HTTPException(
                status_code=400,
                detail="Super admin must provide business_id"
            )

        effective_business_id = business_id

    else:

        effective_business_id = current_user.business_id

        if effective_business_id is None:
            raise HTTPException(
                status_code=400,
                detail="User is not assigned to a business"
            )

    # ==========================================================
    # 2. Validate Location
    # ==========================================================

    location_obj = (
        db.query(location_models.Location)
        .filter(
            location_models.Location.id == issue_data.issued_to_id,
            location_models.Location.business_id == effective_business_id,
            location_models.Location.status == "active",
        )
        .first()
    )

    if not location_obj:
        raise HTTPException(
            status_code=404,
            detail="Location not found or inactive"
        )

    # ==========================================================
    # 3. Determine Issue Date
    # ==========================================================

    issue_date = issue_data.issue_date or datetime.now(timezone.utc)

    if issue_date.tzinfo is None:
        issue_date = issue_date.replace(
            tzinfo=timezone.utc
        )

    issue_date = to_wat(issue_date)

    # ==========================================================
    # 4. Restrict Past-Dated Issues
    # ==========================================================

    if (
        issue_date.date() != now_wat().date()
        and "admin" not in current_user.roles
    ):
        raise HTTPException(
            status_code=400,
            detail="Only admins can post issues for a past date."
        )

    # ==========================================================
    # 5. Validate Issue Type
    # ==========================================================

    if issue_data.issue_to != "location":
        raise HTTPException(
            status_code=400,
            detail="Issue destination must be location."
        )

    # ==========================================================
    # 6. Validate Issue Items
    # ==========================================================

    if not issue_data.issue_items:
        raise HTTPException(
            status_code=400,
            detail="At least one item is required."
        )

    for item_data in issue_data.issue_items:

        if item_data.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Quantity for item {item_data.item_id} "
                    f"must be greater than zero."
                )
            )

    # ==========================================================
    # 7. Create Store Issue
    # ==========================================================

    issue = store_models.StoreIssue(
        business_id=effective_business_id,
        issue_to="location",
        issued_by_id=current_user.id,
        location_id=issue_data.issued_to_id,
        issue_date=issue_date,
    )

    db.add(issue)
    db.flush()

    # ==========================================================
    # 8. Process Items
    # ==========================================================

    issue_items_display: List[
        store_schemas.IssueItemDisplay
    ] = []

    for item_data in issue_data.issue_items:

        # ------------------------------------------------------
        # Validate Store Item
        # ------------------------------------------------------

        item_obj = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.id == item_data.item_id,
                store_models.StoreItem.business_id == effective_business_id,
            )
            .first()
        )

        if not item_obj:
            raise HTTPException(
                status_code=404,
                detail=f"Item {item_data.item_id} not found"
            )

        # ------------------------------------------------------
        # Check Available Central Store Stock
        # ------------------------------------------------------

        available_stock = calculate_available_stock(
            db=db,
            business_id=effective_business_id,
            item_id=item_data.item_id,
        )

        if available_stock < item_data.quantity:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough inventory for item "
                    f"{item_obj.name}. "
                    f"Available: {available_stock}"
                )
            )

        # ------------------------------------------------------
        # Create Store Issue Item
        # ------------------------------------------------------

        issue_item = store_models.StoreIssueItem(
            issue_id=issue.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
            business_id=effective_business_id,
        )

        db.add(issue_item)
        db.flush()

        # ------------------------------------------------------
        # Deduct From Central Store Using FIFO
        # ------------------------------------------------------

        deduct_fifo_stock(
            db=db,
            business_id=effective_business_id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
        )

        # ------------------------------------------------------
        # Find Location Inventory
        # ------------------------------------------------------

        location_inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.location_id
                == issue.location_id,

                location_models.LocationInventory.item_id
                == item_data.item_id,

                location_models.LocationInventory.business_id
                == effective_business_id,
            )
            .first()
        )

        # ------------------------------------------------------
        # Add To Existing Location Inventory
        # ------------------------------------------------------

        if location_inventory:

            location_inventory.quantity += item_data.quantity

            # Keep the item's current unit price if the
            # location inventory already exists.
            #
            # If it was previously empty/null, use the
            # StoreItem unit price.
            if location_inventory.unit_price is None:
                location_inventory.unit_price = item_obj.unit_price

        # ------------------------------------------------------
        # Create New Location Inventory
        # ------------------------------------------------------

        else:

            location_inventory = (
                location_models.LocationInventory(
                    business_id=effective_business_id,

                    location_id=issue.location_id,

                    item_id=item_data.item_id,

                    quantity=item_data.quantity,

                    unit_price=item_obj.unit_price,

                    received_at=issue_date,

                    note=(
                        f"Issued from store "
                        f"through issue #{issue.id}"
                    ),
                )
            )

            db.add(location_inventory)

        # ------------------------------------------------------
        # Prepare Display Item
        # ------------------------------------------------------

        display_item = store_schemas.IssueItemDisplay(
            id=issue_item.id,

            item=store_schemas.StoreItemDisplay(
                id=item_obj.id,
                name=item_obj.name,
                unit=item_obj.unit,

                category=(
                    store_schemas.StoreCategoryDisplay(
                        id=item_obj.category.id,
                        name=item_obj.category.name,
                        created_at=item_obj.category.created_at,
                    )
                    if item_obj.category
                    else None
                ),

                # ✅ Include item type
                item_type=item_obj.item_type,

                unit_price=item_obj.unit_price,
                selling_price=item_obj.selling_price,
                created_at=item_obj.created_at,
            ),

            quantity=item_data.quantity,
        )

        issue_items_display.append(display_item)

    # ==========================================================
    # 9. Commit
    # ==========================================================

    db.commit()
    db.refresh(issue)

    # ==========================================================
    # 10. Return Issue Display
    # ==========================================================

    return store_schemas.IssueDisplay(
        id=issue.id,

        issue_to="location",

        issued_to_id=issue.location_id,

        issued_to=location_obj,

        issue_date=to_wat(issue.issue_date),

        issue_items=issue_items_display,
    )





@router.get(
    "/location",
    response_model=List[store_schemas.IssueDisplay]
)
def list_issues_to_location(
    location_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    business_id: Optional[int] = Query(None),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin"])
    )
):
    try:

        # ==========================================================
        # 1. Resolve Business
        # ==========================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        # ==========================================================
        # 2. Base Query
        # ==========================================================

        query = (
            db.query(store_models.StoreIssue)
            .filter(
                store_models.StoreIssue.issue_to == "location",

                store_models.StoreIssue.business_id
                == effective_business_id,

                store_models.StoreIssue.location_id.isnot(None),
            )
        )

        # ==========================================================
        # 3. Location Filter
        # ==========================================================

        if location_id:
            query = query.filter(
                store_models.StoreIssue.location_id
                == location_id
            )

        # ==========================================================
        # 4. Date Filters
        # ==========================================================

        if start_date:
            query = query.filter(
                store_models.StoreIssue.issue_date
                >= start_date
            )

        if end_date:
            query = query.filter(
                store_models.StoreIssue.issue_date
                <= end_date
            )

        # ==========================================================
        # 5. Get Issues
        # ==========================================================

        issues = (
            query
            .order_by(
                store_models.StoreIssue.issue_date.desc()
            )
            .all()
        )

        result = []

        # ==========================================================
        # 6. Build Response
        # ==========================================================

        for issue in issues:

            # ------------------------------------------------------
            # Validate Location
            # ------------------------------------------------------

            if not issue.location_id:
                continue

            location_obj = (
                db.query(location_models.Location)
                .filter(
                    location_models.Location.id
                    == issue.location_id,

                    location_models.Location.business_id
                    == effective_business_id,
                )
                .first()
            )

            if not location_obj:
                continue

            # ------------------------------------------------------
            # Issue Items
            # ------------------------------------------------------

            issue_items_display = []

            for issue_item in issue.issue_items:

                item_obj = (
                    db.query(store_models.StoreItem)
                    .filter(
                        store_models.StoreItem.id
                        == issue_item.item_id,

                        store_models.StoreItem.business_id
                        == effective_business_id,
                    )
                    .first()
                )

                if not item_obj:
                    continue

                # --------------------------------------------------
                # Category
                # --------------------------------------------------

                category_display = None

                if item_obj.category:

                    category_display = (
                        store_schemas.StoreCategoryDisplay(
                            id=item_obj.category.id,
                            name=item_obj.category.name,
                            created_at=item_obj.category.created_at,
                        )
                    )

                # --------------------------------------------------
                # Item Display
                # --------------------------------------------------

                issue_items_display.append(
                    store_schemas.IssueItemDisplay(

                        id=issue_item.id,

                        item=store_schemas.StoreItemDisplay(
                            id=item_obj.id,
                            name=item_obj.name,
                            unit=item_obj.unit,

                            category=category_display,
                            item_type=item_obj.item_type,

                            unit_price=item_obj.unit_price,
                            selling_price=item_obj.selling_price,

                            created_at=item_obj.created_at,
                        ),

                        quantity=issue_item.quantity,
                    )
                )

            # ------------------------------------------------------
            # Issue Display
            # ------------------------------------------------------

            result.append(
                store_schemas.IssueDisplay(

                    id=issue.id,

                    issue_to="location",

                    issued_to_id=issue.location_id,

                    issued_to=location_obj,

                    issue_date=to_wat(
                        issue.issue_date
                    ),

                    issue_items=issue_items_display,
                )
            )

        return result

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve location issues: {str(e)}"
        )



                                            

@router.get("/stock/{item_id}")
def get_item_stock(
    item_id: int,
    business_id: Optional[int] = Query(
        None,
        description="Super admin can specify business"
    ),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin"])
    )
):
    # ==========================================================
    # 1. Resolve Business
    # ==========================================================

    effective_business_id = resolve_business_id(
        current_user,
        business_id
    )

    # ==========================================================
    # 2. Check Business
    # ==========================================================

    business_exists = (
        db.query(business_models.Business)
        .filter(
            business_models.Business.id
            == effective_business_id
        )
        .first()
    )

    if not business_exists:
        return {
            "item_id": item_id,
            "business_id": effective_business_id,
            "available": 0,
            "message": "Business does not exist",
            "queried_at": now_wat().isoformat()
        }

    # ==========================================================
    # 3. Check Item
    # ==========================================================

    item_exists = (
        db.query(store_models.StoreItem)
        .filter(
            store_models.StoreItem.id == item_id,
            store_models.StoreItem.business_id
            == effective_business_id
        )
        .first()
    )

    if not item_exists:
        return {
            "item_id": item_id,
            "business_id": effective_business_id,
            "available": 0,
            "message": "Item not available",
            "queried_at": now_wat().isoformat()
        }

    # ==========================================================
    # 4. Calculate Central Store Stock
    # ==========================================================

    total = (
        db.query(
            func.sum(
                store_models.StoreStockEntry.quantity
            )
        )
        .filter(
            store_models.StoreStockEntry.item_id == item_id,
            store_models.StoreStockEntry.business_id
            == effective_business_id
        )
        .scalar()
    ) or 0

    # ==========================================================
    # 5. Return
    # ==========================================================

    return {
        "item_id": item_id,
        "business_id": effective_business_id,
        "available": total,
        "message": (
            "Success"
            if total > 0
            else "Item out of stock"
        ),
        "queried_at": now_wat().isoformat()
    }





@router.put(
    "/location-issues/{issue_id}",
    response_model=store_schemas.IssueDisplay
)
def update_location_issue(
    issue_id: int,

    update_data: store_schemas.IssueCreate,

    business_id: Optional[int] = Query(
        None,
        description="Super admin can optionally specify business"
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin", "super_admin"])
    ),
):
    # ==========================================================
    # 1. NORMALIZE USER ROLES
    # ==========================================================

    roles = []

    for role in current_user.roles or []:

        # Role is already a string
        if isinstance(role, str):
            roles.append(role.lower())
            continue

        # RoleSimple / Pydantic object
        role_name = getattr(role, "name", None)
        role_code = getattr(role, "code", None)

        if role_name:
            roles.append(str(role_name).lower())

        if role_code:
            roles.append(str(role_code).lower())

    # ==========================================================
    # 2. FETCH ISSUE
    # ==========================================================

    issue = (
        db.query(store_models.StoreIssue)
        .filter(
            store_models.StoreIssue.id == issue_id
        )
        .first()
    )

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    # ==========================================================
    # 3. MAKE SURE IT IS A LOCATION ISSUE
    # ==========================================================

    if (
        not issue.issue_to
        or issue.issue_to.lower() != "location"
    ):
        raise HTTPException(
            status_code=400,
            detail="Only location issues can be updated"
        )

    # ==========================================================
    # 4. RESOLVE BUSINESS
    # ==========================================================

    if "super_admin" in roles:

        effective_business_id = (
            business_id
            if business_id is not None
            else issue.business_id
        )

    else:

        effective_business_id = (
            current_user.business_id
        )

    if effective_business_id is None:
        raise HTTPException(
            status_code=400,
            detail="Business could not be determined"
        )

    # ==========================================================
    # 5. PREVENT CROSS-TENANT ACCESS
    # ==========================================================

    if issue.business_id != effective_business_id:
        raise HTTPException(
            status_code=403,
            detail="Not allowed to update this issue"
        )

    # ==========================================================
    # 6. VALIDATE LOCATION
    # ==========================================================

    location_obj = (
        db.query(location_models.Location)
        .filter(
            location_models.Location.id
            == update_data.issued_to_id,

            location_models.Location.business_id
            == effective_business_id,

            location_models.Location.status
            == "active",
        )
        .first()
    )

    if not location_obj:
        raise HTTPException(
            status_code=404,
            detail="Location not found or inactive"
        )

    # ==========================================================
    # 7. VALIDATE ISSUE TYPE
    # ==========================================================

    if update_data.issue_to != "location":
        raise HTTPException(
            status_code=400,
            detail="Issue destination must be location"
        )

    # ==========================================================
    # 8. VALIDATE ISSUE ITEMS
    # ==========================================================

    if not update_data.issue_items:
        raise HTTPException(
            status_code=400,
            detail="At least one item is required"
        )

    item_cache = {}

    for item in update_data.issue_items:

        if item.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Quantity for item {item.item_id} "
                    f"must be greater than zero"
                )
            )

        item_obj = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.id
                == item.item_id,

                store_models.StoreItem.business_id
                == effective_business_id,
            )
            .first()
        )

        if not item_obj:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Item {item.item_id} not found"
                )
            )

        item_cache[item.item_id] = item_obj

    # ==========================================================
    # 9. DETERMINE OLD QUANTITIES
    # ==========================================================

    old_quantities = {}

    for old_item in issue.issue_items:

        old_quantities[old_item.item_id] = (
            old_quantities.get(
                old_item.item_id,
                0
            )
            + old_item.quantity
        )

    # ==========================================================
    # 10. CHECK CENTRAL STORE STOCK
    #
    # Add the quantities from the existing issue back to the
    # available stock calculation because we are replacing
    # the old issue.
    # ==========================================================

    requested_quantities = {}

    for item in update_data.issue_items:

        requested_quantities[item.item_id] = (
            requested_quantities.get(
                item.item_id,
                0
            )
            + item.quantity
        )

    for item_id, requested_quantity in (
        requested_quantities.items()
    ):

        available = calculate_available_stock(
            db=db,
            business_id=effective_business_id,
            item_id=item_id,
        )

        old_quantity = old_quantities.get(
            item_id,
            0
        )

        allowed = (
            available
            + old_quantity
        )

        if requested_quantity > allowed:

            item_obj = item_cache[item_id]

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough inventory for item "
                    f"{item_obj.name}. "
                    f"Available: {allowed}"
                )
            )

    # ==========================================================
    # 11. RESTORE OLD LOCATION INVENTORY
    #
    # Remove the old issue quantity from the old location.
    # ==========================================================

    for old_item in issue.issue_items:

        location_inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.location_id
                == issue.location_id,

                location_models.LocationInventory.item_id
                == old_item.item_id,

                location_models.LocationInventory.business_id
                == effective_business_id,
            )
            .first()
        )

        if location_inventory:

            location_inventory.quantity -= (
                old_item.quantity
            )

            if location_inventory.quantity < 0:
                location_inventory.quantity = 0

            db.add(location_inventory)

    # ==========================================================
    # 12. REMOVE EXISTING ISSUE ITEMS
    # ==========================================================

    db.query(
        store_models.StoreIssueItem
    ).filter(
        store_models.StoreIssueItem.issue_id
        == issue.id
    ).delete(
        synchronize_session=False
    )

    db.flush()

    # ==========================================================
    # 13. UPDATE ISSUE HEADER
    # ==========================================================

    issue.issue_to = "location"

    issue.location_id = (
        update_data.issued_to_id
    )

    issue.issue_date = (
        update_data.issue_date
        or datetime.now(timezone.utc)
    )

    if issue.issue_date.tzinfo is None:

        issue.issue_date = (
            issue.issue_date.replace(
                tzinfo=timezone.utc
            )
        )

    issue.issue_date = to_wat(
        issue.issue_date
    )

    issue.issued_by_id = current_user.id

    # ==========================================================
    # 14. CREATE NEW ISSUE ITEMS
    # ==========================================================

    issue_items_display = []

    for item in update_data.issue_items:

        item_obj = item_cache[
            item.item_id
        ]

        # ------------------------------------------------------
        # CREATE ISSUE ITEM
        # ------------------------------------------------------

        issue_item = (
            store_models.StoreIssueItem(
                business_id=effective_business_id,

                issue_id=issue.id,

                item_id=item.item_id,

                quantity=item.quantity,
            )
        )

        db.add(issue_item)
        db.flush()

        # ------------------------------------------------------
        # DEDUCT FROM CENTRAL STORE USING FIFO
        # ------------------------------------------------------

        deduct_fifo_stock(
            db=db,
            business_id=effective_business_id,
            item_id=item.item_id,
            quantity=item.quantity,
        )

        # ------------------------------------------------------
        # FIND LOCATION INVENTORY
        # ------------------------------------------------------

        location_inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.location_id
                == issue.location_id,

                location_models.LocationInventory.item_id
                == item.item_id,

                location_models.LocationInventory.business_id
                == effective_business_id,
            )
            .first()
        )

        # ------------------------------------------------------
        # ADD TO EXISTING LOCATION INVENTORY
        # ------------------------------------------------------

        if location_inventory:

            location_inventory.quantity += (
                item.quantity
            )

            if (
                location_inventory.unit_price
                is None
            ):

                location_inventory.unit_price = (
                    item_obj.unit_price
                )

        # ------------------------------------------------------
        # CREATE NEW LOCATION INVENTORY
        # ------------------------------------------------------

        else:

            location_inventory = (
                location_models.LocationInventory(

                    business_id=
                        effective_business_id,

                    location_id=
                        issue.location_id,

                    item_id=
                        item.item_id,

                    quantity=
                        item.quantity,

                    unit_price=
                        item_obj.unit_price,

                    received_at=
                        issue.issue_date,

                    note=(
                        f"Issued from store "
                        f"through issue #{issue.id}"
                    ),
                )
            )

            db.add(
                location_inventory
            )

        # ------------------------------------------------------
        # CATEGORY
        # ------------------------------------------------------

        category_display = None

        if item_obj.category:

            category_display = (
                store_schemas.StoreCategoryDisplay(
                    id=item_obj.category.id,

                    name=item_obj.category.name,

                    created_at=
                        item_obj.category.created_at,
                )
            )

        # ------------------------------------------------------
        # RESPONSE ITEM
        # ------------------------------------------------------

        issue_items_display.append(

            store_schemas.IssueItemDisplay(

                id=issue_item.id,

                item=(
                    store_schemas.StoreItemDisplay(

                        id=item_obj.id,

                        name=item_obj.name,

                        unit=item_obj.unit,

                        category=
                            category_display,

                        # IMPORTANT
                        # Include item type
                        item_type=
                            item_obj.item_type,

                        unit_price=
                            item_obj.unit_price,

                        selling_price=
                            item_obj.selling_price,

                        created_at=
                            item_obj.created_at,
                    )
                ),

                quantity=item.quantity,
            )
        )

    # ==========================================================
    # 15. COMMIT
    # ==========================================================

    db.commit()

    db.refresh(issue)

    # ==========================================================
    # 16. RETURN UPDATED ISSUE
    # ==========================================================

    return store_schemas.IssueDisplay(

        id=issue.id,

        issue_to="location",

        issued_to_id=
            issue.location_id,

        issued_to=
            location_obj,

        issue_date=
            to_wat(
                issue.issue_date
            ),

        issue_items=
            issue_items_display,
    )



@router.delete(
    "/location-issues/{issue_id}"
)
def delete_location_issue(
    issue_id: int,

    business_id: Optional[int] = Query(
        None,
        description="Super admin can specify business"
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["admin", "super_admin"])
    )
):
    # ==========================================================
    # 1. Normalize User Roles
    # ==========================================================

    roles = []

    for role in current_user.roles or []:

        # RoleSimple / Pydantic role object
        if hasattr(role, "code") and role.code:
            roles.append(role.code.lower())

        elif hasattr(role, "name") and role.name:
            roles.append(role.name.lower())

        # Plain string role
        elif isinstance(role, str):
            roles.append(role.lower())

    # ==========================================================
    # 2. Fetch Issue
    # ==========================================================

    issue = (
        db.query(store_models.StoreIssue)
        .filter(
            store_models.StoreIssue.id == issue_id
        )
        .first()
    )

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    # ==========================================================
    # 3. Validate Issue Type
    # ==========================================================

    if str(issue.issue_to).lower() != "location":
        raise HTTPException(
            status_code=400,
            detail="This endpoint only deletes location issues"
        )

    # ==========================================================
    # 4. Resolve Business
    # ==========================================================

    if "super_admin" in roles:

        effective_business_id = (
            business_id
            if business_id is not None
            else issue.business_id
        )

    else:

        effective_business_id = current_user.business_id

    if effective_business_id is None:
        raise HTTPException(
            status_code=400,
            detail="Business could not be determined"
        )

    # ==========================================================
    # 5. Prevent Cross-Tenant Delete
    # ==========================================================

    if issue.business_id != effective_business_id:
        raise HTTPException(
            status_code=403,
            detail="Not allowed to delete this issue"
        )

    # ==========================================================
    # 6. Validate Location
    # ==========================================================

    if not issue.location_id:
        raise HTTPException(
            status_code=400,
            detail="Location issue has no location assigned"
        )

    location_obj = (
        db.query(location_models.Location)
        .filter(
            location_models.Location.id
            == issue.location_id,

            location_models.Location.business_id
            == effective_business_id,
        )
        .first()
    )

    if not location_obj:
        raise HTTPException(
            status_code=404,
            detail="Location not found"
        )

    # ==========================================================
    # 7. Restore Central Store Stock
    # ==========================================================

    for item in issue.issue_items:

        remaining_to_restore = float(
            item.quantity
        )

        # ======================================================
        # Restore Opening Stock
        # ======================================================

        inventories = (
            db.query(
                store_models.StoreInventory
            )
            .filter(
                store_models.StoreInventory.item_id
                == item.item_id,

                store_models.StoreInventory.business_id
                == effective_business_id,
            )
            .order_by(
                store_models.StoreInventory.id.desc()
            )
            .all()
        )

        for inventory in inventories:

            if remaining_to_restore <= 0:
                break

            available_space = (
                inventory.opening_quantity
                - inventory.quantity
            )

            if available_space <= 0:
                continue

            restore = min(
                available_space,
                remaining_to_restore
            )

            inventory.quantity += restore

            remaining_to_restore -= restore

            db.add(inventory)

        # ======================================================
        # Restore Adjustment Stock
        # ======================================================

        adjustments = (
            db.query(
                store_models.StoreInventoryAdjustment
            )
            .filter(
                store_models.StoreInventoryAdjustment.item_id
                == item.item_id,

                store_models.StoreInventoryAdjustment.business_id
                == effective_business_id,

                store_models.StoreInventoryAdjustment.quantity_adjusted
                < 0,
            )
            .order_by(
                store_models.StoreInventoryAdjustment.adjusted_at.desc(),
                store_models.StoreInventoryAdjustment.id.desc(),
            )
            .all()
        )

        for adjustment in adjustments:

            if remaining_to_restore <= 0:
                break

            original = abs(
                adjustment.quantity_adjusted
            )

            available_space = (
                original
                - adjustment.remaining_quantity
            )

            if available_space <= 0:
                continue

            restore = min(
                available_space,
                remaining_to_restore
            )

            adjustment.remaining_quantity += restore

            remaining_to_restore -= restore

            db.add(adjustment)

        # ======================================================
        # Restore Purchase Stock
        # ======================================================

        purchases = (
            db.query(
                store_models.StoreStockEntry
            )
            .filter(
                store_models.StoreStockEntry.item_id
                == item.item_id,

                store_models.StoreStockEntry.business_id
                == effective_business_id,
            )
            .order_by(
                store_models.StoreStockEntry.purchase_date.desc(),
                store_models.StoreStockEntry.id.desc(),
            )
            .all()
        )

        for purchase in purchases:

            if remaining_to_restore <= 0:
                break

            available_space = (
                purchase.original_quantity
                - purchase.quantity
            )

            if available_space <= 0:
                continue

            restore = min(
                available_space,
                remaining_to_restore
            )

            purchase.quantity += restore

            remaining_to_restore -= restore

            db.add(purchase)

        # ======================================================
        # Reduce Location Inventory
        # ======================================================

        location_inventory = (
            db.query(
                location_models.LocationInventory
            )
            .filter(
                location_models.LocationInventory.location_id
                == issue.location_id,

                location_models.LocationInventory.item_id
                == item.item_id,

                location_models.LocationInventory.business_id
                == effective_business_id,
            )
            .first()
        )

        if location_inventory:

            location_inventory.quantity -= (
                item.quantity
            )

            if location_inventory.quantity < 0:
                location_inventory.quantity = 0

            db.add(location_inventory)

    # ==========================================================
    # 8. Delete Issue Items
    # ==========================================================

    for item in issue.issue_items:
        db.delete(item)

    # ==========================================================
    # 9. Delete Issue
    # ==========================================================

    db.delete(issue)

    # ==========================================================
    # 10. Commit
    # ==========================================================

    db.commit()

    # ==========================================================
    # 11. Return Response
    # ==========================================================

    return {
        "message": (
            "Location issue deleted and "
            "stock restored successfully"
        ),
        "issue_id": issue_id,
        "business_id": effective_business_id,
    }


# ==========================================================
# CREATE STORE INVENTORY ADJUSTMENT
# ==========================================================

@router.post(
    "/adjust",
    response_model=store_schemas.StoreInventoryAdjustmentDisplay
)
def adjust_store_inventory(
    adjustment_data: store_schemas.StoreInventoryAdjustmentCreate,

    business_id: Optional[int] = Query(
        None,
        description="Super admin can specify business"
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["admin", "super_admin"])
    )
):
    try:

        # ==========================================================
        # 1. RESOLVE BUSINESS
        # ==========================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        if not effective_business_id:
            raise HTTPException(
                status_code=400,
                detail="Business could not be determined."
            )

        # ==========================================================
        # 2. VALIDATE ITEM
        # ==========================================================

        item_obj = (
            db.query(store_models.StoreItem)
            .filter(
                store_models.StoreItem.id
                == adjustment_data.item_id,

                store_models.StoreItem.business_id
                == effective_business_id,
            )
            .first()
        )

        if not item_obj:
            raise HTTPException(
                status_code=404,
                detail="Item not found."
            )

        # ==========================================================
        # 3. VALIDATE QUANTITY
        #
        # + quantity = ADD STOCK
        # - quantity = REMOVE STOCK
        # ==========================================================

        qty = float(
            adjustment_data.quantity_adjusted
        )

        if qty == 0:
            raise HTTPException(
                status_code=400,
                detail="Adjustment cannot be zero."
            )

        # ==========================================================
        # 4. POSITIVE ADJUSTMENT
        #
        # Example:
        #
        # +10
        #
        # Means 10 units are being added to store stock.
        #
        # We create available FIFO stock for these units.
        # ==========================================================

        if qty > 0:

            remaining_quantity = qty

        # ==========================================================
        # 5. NEGATIVE ADJUSTMENT
        #
        # Example:
        #
        # -10
        #
        # Means 10 units are being removed from store stock.
        #
        # We must first verify that enough stock exists.
        # ==========================================================

        else:

            quantity_to_deduct = abs(qty)

            # ------------------------------------------------------
            # Calculate current available store stock
            # ------------------------------------------------------

            available_stock = calculate_available_stock(
                db=db,
                business_id=effective_business_id,
                item_id=adjustment_data.item_id,
            )

            # ------------------------------------------------------
            # Prevent negative inventory
            # ------------------------------------------------------

            if quantity_to_deduct > available_stock:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Not enough inventory for "
                        f"{item_obj.name}. "
                        f"Available: {available_stock}"
                    )
                )

            # ------------------------------------------------------
            # Deduct stock using FIFO
            # ------------------------------------------------------

            deduct_fifo_stock(
                db=db,
                business_id=effective_business_id,
                item_id=adjustment_data.item_id,
                quantity=quantity_to_deduct,
            )

            # Negative adjustment does not create
            # new FIFO stock.
            remaining_quantity = 0

        # ==========================================================
        # 6. CREATE ADJUSTMENT RECORD
        #
        # Store the signed value:
        #
        # +10 = added
        # -10 = removed
        #
        # This allows the balance endpoint to use:
        #
        # SUM(quantity_adjusted)
        # ==========================================================

        adjustment = (
            store_models.StoreInventoryAdjustment(
                business_id=effective_business_id,

                item_id=adjustment_data.item_id,

                quantity_adjusted=qty,

                remaining_quantity=remaining_quantity,

                reason=adjustment_data.reason,

                adjusted_by=current_user.username,

                adjusted_at=now_wat(),
            )
        )

        db.add(adjustment)

        # ==========================================================
        # 7. UPDATE STORE INVENTORY TIMESTAMP
        # ==========================================================

        inventory = (
            db.query(
                store_models.StoreInventory
            )
            .filter(
                store_models.StoreInventory.item_id
                == adjustment_data.item_id,

                store_models.StoreInventory.business_id
                == effective_business_id,
            )
            .first()
        )

        if inventory:

            inventory.last_updated = now_wat()

            db.add(inventory)

        # ==========================================================
        # 8. COMMIT
        # ==========================================================

        db.commit()

        db.refresh(adjustment)

        # ==========================================================
        # 9. BUILD CATEGORY RESPONSE
        # ==========================================================

        category_display = None

        if item_obj.category:

            category_display = (
                store_schemas.StoreCategoryDisplay(
                    id=item_obj.category.id,

                    name=item_obj.category.name,

                    category_name=(
                        item_obj.category.name
                        or "Unknown"
                    ),

                    created_at=(
                        item_obj.category.created_at
                    ),
                )
            )

        # ==========================================================
        # 10. BUILD ITEM RESPONSE
        # ==========================================================

        item_display = (
            store_schemas.StoreItemDisplay(
                id=item_obj.id,

                name=item_obj.name,

                unit=item_obj.unit,

                category=category_display,

                item_type=item_obj.item_type,

                unit_price=item_obj.unit_price,

                selling_price=item_obj.selling_price,

                created_at=item_obj.created_at,
            )
        )

        # ==========================================================
        # 11. RETURN ADJUSTMENT
        # ==========================================================

        return (
            store_schemas.StoreInventoryAdjustmentDisplay(
                id=adjustment.id,

                item=item_display,

                quantity_adjusted=(
                    adjustment.quantity_adjusted
                ),

                reason=adjustment.reason,

                adjusted_by=adjustment.adjusted_by,

                adjusted_at=adjustment.adjusted_at,
            )
        )

    # ==============================================================
    # HTTP EXCEPTION
    # ==============================================================

    except HTTPException:

        db.rollback()

        raise

    # ==============================================================
    # UNEXPECTED ERROR
    # ==============================================================

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to create inventory "
                f"adjustment: {str(e)}"
            )
        )



# ==========================================================
# LIST STORE INVENTORY ADJUSTMENTS
# ==========================================================

@router.get(
    "/adjustments",
    response_model=list[
        store_schemas.StoreInventoryAdjustmentDisplay
    ]
)
def list_store_inventory_adjustments(
    item_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin", "super_admin"])
    )
):
    try:

        # ==================================================
        # 1. Resolve Business
        # ==================================================

        business_id = resolve_business_id(
            current_user,
            business_id
        )

        # ==================================================
        # 2. Base Query
        # ==================================================

        query = (
            db.query(store_models.StoreInventoryAdjustment)
            .filter(
                store_models.StoreInventoryAdjustment.business_id
                == business_id
            )
        )

        # ==================================================
        # 3. Item Filter
        # ==================================================

        if item_id is not None:
            query = query.filter(
                store_models.StoreInventoryAdjustment.item_id
                == item_id
            )

        # ==================================================
        # 4. Date Filters
        # ==================================================

        if start_date:
            query = query.filter(
                store_models.StoreInventoryAdjustment.adjusted_at
                >= start_date
            )

        if end_date:
            query = query.filter(
                store_models.StoreInventoryAdjustment.adjusted_at
                <= end_date
            )

        # ==================================================
        # 5. Get Adjustments
        # ==================================================

        adjustments = (
            query
            .order_by(
                store_models.StoreInventoryAdjustment.adjusted_at.desc(),
                store_models.StoreInventoryAdjustment.id.desc(),
            )
            .all()
        )

        results = []

        # ==================================================
        # 6. Build Response
        # ==================================================

        for adjustment in adjustments:

            item_obj = (
                db.query(store_models.StoreItem)
                .filter(
                    store_models.StoreItem.id
                    == adjustment.item_id,
                    store_models.StoreItem.business_id
                    == business_id,
                )
                .first()
            )

            if not item_obj:
                continue

            category_display = None

            if item_obj.category:
                category_display = (
                    store_schemas.StoreCategoryDisplay(
                        id=item_obj.category.id,
                        name=item_obj.category.name,
                        category_name=(
                            item_obj.category.name
                            or "Unknown"
                        ),
                        created_at=item_obj.category.created_at,
                    )
                )

            item_display = store_schemas.StoreItemDisplay(
                id=item_obj.id,
                name=item_obj.name,
                unit=item_obj.unit,
                category=category_display,
                item_type=item_obj.item_type,
                unit_price=item_obj.unit_price,
                selling_price=item_obj.selling_price,
                created_at=item_obj.created_at,
            )

            results.append(
                store_schemas.StoreInventoryAdjustmentDisplay(
                    id=adjustment.id,
                    item=item_display,
                    quantity_adjusted=(
                        adjustment.quantity_adjusted
                    ),
                    reason=adjustment.reason,
                    adjusted_by=adjustment.adjusted_by,
                    adjusted_at=adjustment.adjusted_at,
                )
            )

        return results

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to retrieve inventory adjustments: "
                f"{str(e)}"
            )
        )


# ==========================================================
# UPDATE STORE INVENTORY ADJUSTMENT
# ==========================================================

@router.put(
    "/adjustments/{adjustment_id}",
    response_model=store_schemas.StoreInventoryAdjustmentDisplay
)
def update_adjustment(
    adjustment_id: int,

    data: store_schemas.StoreInventoryAdjustmentCreate,

    business_id: Optional[int] = Query(
        None,
        description="Super admin can specify business"
    ),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["admin", "super_admin"])
    )
):
    try:

        # ==================================================
        # 1. Resolve Business
        # ==================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        if not effective_business_id:
            raise HTTPException(
                status_code=400,
                detail="Business could not be determined."
            )

        # ==================================================
        # 2. Find Existing Adjustment
        # ==================================================

        adjustment = (
            db.query(
                store_models.StoreInventoryAdjustment
            )
            .filter(
                store_models.StoreInventoryAdjustment.id
                == adjustment_id,

                store_models.StoreInventoryAdjustment.business_id
                == effective_business_id,
            )
            .first()
        )

        if not adjustment:
            raise HTTPException(
                status_code=404,
                detail="Adjustment not found."
            )

        # ==================================================
        # 3. Validate New Item
        # ==================================================

        new_item = (
            db.query(store_models.StoreItem)
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
                detail="Item not found."
            )

        # ==================================================
        # 4. Validate New Quantity
        # ==================================================

        new_qty = float(
            data.quantity_adjusted
        )

        if new_qty == 0:
            raise HTTPException(
                status_code=400,
                detail="Adjustment cannot be zero."
            )

        # ==================================================
        # 5. REVERSE OLD ADJUSTMENT
        # ==================================================

        old_qty = float(
            adjustment.quantity_adjusted
        )

        old_item_id = adjustment.item_id

        # --------------------------------------------------
        # OLD POSITIVE = STOCK WAS ADDED
        # --------------------------------------------------

        if old_qty > 0:

            original_added = old_qty

            remaining = float(
                adjustment.remaining_quantity or 0
            )

            # ----------------------------------------------
            # Check whether some of the added stock
            # has already been consumed.
            # ----------------------------------------------

            if remaining < original_added:

                used = (
                    original_added
                    - remaining
                )

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot edit this adjustment. "
                        f"{used} unit(s) from the original "
                        f"stock adjustment have already "
                        f"been issued."
                    )
                )

            # ----------------------------------------------
            # No stock has been consumed.
            #
            # Remove the old positive adjustment from
            # available FIFO stock.
            # ----------------------------------------------

            adjustment.remaining_quantity = 0

        # --------------------------------------------------
        # OLD NEGATIVE = STOCK WAS REMOVED
        # --------------------------------------------------

        else:

            old_deducted = abs(old_qty)

            # ----------------------------------------------
            # Restore the stock removed by the old
            # adjustment.
            # ----------------------------------------------

            restore_fifo_stock(
                db=db,

                business_id=effective_business_id,

                item_id=old_item_id,

                quantity=old_deducted,
            )

            adjustment.remaining_quantity = 0

        # ==================================================
        # 6. APPLY NEW ADJUSTMENT
        # ==================================================

        # --------------------------------------------------
        # NEW POSITIVE = ADD STOCK
        # --------------------------------------------------

        if new_qty > 0:

            # Positive adjustment creates new FIFO
            # available stock.

            adjustment.remaining_quantity = new_qty

        # --------------------------------------------------
        # NEW NEGATIVE = REMOVE STOCK
        # --------------------------------------------------

        else:

            quantity_to_deduct = abs(
                new_qty
            )

            available = calculate_available_stock(
                db=db,

                business_id=effective_business_id,

                item_id=data.item_id,
            )

            if quantity_to_deduct > available:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Not enough inventory for "
                        f"{new_item.name}. "
                        f"Available: {available}"
                    )
                )

            # ----------------------------------------------
            # Deduct using FIFO.
            # ----------------------------------------------

            deduct_fifo_stock(
                db=db,

                business_id=effective_business_id,

                item_id=data.item_id,

                quantity=quantity_to_deduct,
            )

            adjustment.remaining_quantity = 0

        # ==================================================
        # 7. Update Adjustment Record
        # ==================================================

        adjustment.item_id = data.item_id

        adjustment.quantity_adjusted = new_qty

        adjustment.reason = data.reason

        adjustment.adjusted_by = (
            current_user.username
        )

        adjustment.adjusted_at = now_wat()

        adjustment.business_id = (
            effective_business_id
        )

        db.add(adjustment)

        # ==================================================
        # 8. Update Store Inventory Timestamp
        # ==================================================

        # Update the new item's inventory record.

        inventory = (
            db.query(
                store_models.StoreInventory
            )
            .filter(
                store_models.StoreInventory.item_id
                == data.item_id,

                store_models.StoreInventory.business_id
                == effective_business_id,
            )
            .first()
        )

        if inventory:

            inventory.last_updated = now_wat()

            db.add(inventory)

        # ==================================================
        # 9. Commit
        # ==================================================

        db.commit()

        db.refresh(adjustment)

        # ==================================================
        # 10. Build Category Display
        # ==================================================

        category_display = None

        if new_item.category:

            category_display = (
                store_schemas.StoreCategoryDisplay(

                    id=new_item.category.id,

                    name=new_item.category.name,

                    category_name=(
                        new_item.category.name
                        or "Unknown"
                    ),

                    created_at=(
                        new_item.category.created_at
                    ),
                )
            )

        # ==================================================
        # 11. Build Item Display
        # ==================================================

        item_display = (
            store_schemas.StoreItemDisplay(

                id=new_item.id,

                name=new_item.name,

                unit=new_item.unit,

                category=category_display,

                # ------------------------------------------
                # IMPORTANT
                # ------------------------------------------

                item_type=new_item.item_type,

                unit_price=new_item.unit_price,

                selling_price=new_item.selling_price,

                created_at=new_item.created_at,
            )
        )

        # ==================================================
        # 12. Return Updated Adjustment
        # ==================================================

        return (
            store_schemas.StoreInventoryAdjustmentDisplay(

                id=adjustment.id,

                item=item_display,

                quantity_adjusted=(
                    adjustment.quantity_adjusted
                ),

                reason=adjustment.reason,

                adjusted_by=adjustment.adjusted_by,

                adjusted_at=adjustment.adjusted_at,
            )
        )

    # ======================================================
    # HTTP ERROR
    # ======================================================

    except HTTPException:

        db.rollback()

        raise

    # ======================================================
    # UNEXPECTED ERROR
    # ======================================================

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to update adjustment: {str(e)}"
            )
        )



# ==========================================================
# DELETE STORE INVENTORY ADJUSTMENT
# ==========================================================

@router.delete(
    "/adjustments/{adjustment_id}"
)
def delete_adjustment(
    adjustment_id: int,
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["admin", "super_admin"])
    )
):
    try:

        # ==================================================
        # 1. Resolve Business
        # ==================================================

        business_id = resolve_business_id(
            current_user,
            business_id
        )

        # ==================================================
        # 2. Find Adjustment
        # ==================================================

        adjustment = (
            db.query(
                store_models.StoreInventoryAdjustment
            )
            .filter(
                store_models.StoreInventoryAdjustment.id
                == adjustment_id,
                store_models.StoreInventoryAdjustment.business_id
                == business_id,
            )
            .first()
        )

        if not adjustment:
            raise HTTPException(
                status_code=404,
                detail="Adjustment not found."
            )

        # ==================================================
        # 3. POSITIVE = STOCK WAS ADDED
        # ==================================================

        if adjustment.quantity_adjusted > 0:

            original_added = float(
                adjustment.quantity_adjusted
            )

            remaining = float(
                adjustment.remaining_quantity or 0
            )

            # Some of the adjustment stock has already
            # been issued/consumed.
            if remaining < original_added:

                used = original_added - remaining

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot delete adjustment. "
                        f"{used} unit(s) from this adjustment "
                        f"have already been issued."
                    )
                )

            # No stock from this adjustment has been used.
            # Therefore there is nothing to restore.
            #
            # The stock represented by the adjustment simply
            # disappears when the adjustment is deleted.

        # ==================================================
        # 4. NEGATIVE = STOCK WAS DEDUCTED
        # ==================================================

        else:

            deducted_quantity = abs(
                float(adjustment.quantity_adjusted)
            )

            # Restore the stock that the negative adjustment
            # originally removed.
            restore_fifo_stock(
                db=db,
                business_id=business_id,
                item_id=adjustment.item_id,
                quantity=deducted_quantity,
            )

        # ==================================================
        # 5. Update Inventory Timestamp
        # ==================================================

        inventory = (
            db.query(store_models.StoreInventory)
            .filter(
                store_models.StoreInventory.item_id
                == adjustment.item_id,
                store_models.StoreInventory.business_id
                == business_id,
            )
            .first()
        )

        if inventory:
            inventory.last_updated = now_wat()
            db.add(inventory)

        # ==================================================
        # 6. Save Item Information Before Delete
        # ==================================================

        item_id = adjustment.item_id
        quantity_adjusted = adjustment.quantity_adjusted

        # ==================================================
        # 7. Delete Adjustment
        # ==================================================

        db.delete(adjustment)

        db.commit()

        # ==================================================
        # 8. Response
        # ==================================================

        return {
            "message": "Adjustment deleted successfully.",
            "adjustment_id": adjustment_id,
            "item_id": item_id,
            "quantity_adjusted": quantity_adjusted,
            "business_id": business_id,
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete adjustment: {str(e)}"
        )



@router.post(
    "/location/adjust",
    response_model=location_schemas.LocationInventoryAdjustmentDisplay
)
def adjust_location_inventory(
    adjustment_data:
        location_schemas.LocationInventoryAdjustmentCreate,

    business_id: Optional[int] = Query(None),

    db: Session = Depends(get_db),

    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required([
            "admin",
            "super_admin"
        ])
    )
):
    try:

        # ==========================================================
        # 1. RESOLVE BUSINESS
        # ==========================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        location_id = adjustment_data.location_id
        item_id = adjustment_data.item_id

        qty = int(
            adjustment_data.quantity_adjusted
        )

        # ==========================================================
        # 2. VALIDATE QUANTITY
        # ==========================================================

        if qty == 0:
            raise HTTPException(
                status_code=400,
                detail="Adjustment cannot be zero."
            )

        # ==========================================================
        # 3. VALIDATE LOCATION
        # ==========================================================

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

        # ==========================================================
        # 4. VALIDATE ITEM
        # ==========================================================

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

        # ==========================================================
        # 5. GET CURRENT LOCATION INVENTORY
        # ==========================================================

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

        # ==========================================================
        # 6. NEGATIVE ADJUSTMENT
        #
        # Example:
        #
        # quantity_adjusted = -10
        #
        # Remove 10 from location stock.
        # ==========================================================

        if qty < 0:

            remove_quantity = abs(qty)

            current_quantity = (
                float(inventory.quantity)
                if inventory
                else 0
            )

            if current_quantity < remove_quantity:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot remove {remove_quantity} "
                        f"units. Current location stock is "
                        f"{current_quantity}."
                    )
                )

            inventory.quantity = (
                current_quantity
                - remove_quantity
            )

        # ==========================================================
        # 7. POSITIVE ADJUSTMENT
        #
        # Example:
        #
        # quantity_adjusted = +10
        #
        # Add 10 to location stock.
        # ==========================================================

        else:

            if inventory:

                inventory.quantity = (
                    float(inventory.quantity or 0)
                    + qty
                )

            else:

                inventory = (
                    location_models.LocationInventory(
                        business_id=effective_business_id,

                        location_id=location_id,

                        item_id=item_id,

                        quantity=qty,

                        unit_price=item.unit_price,

                        received_at=now_wat(),

                        note=(
                            "Created through "
                            "location inventory adjustment"
                        )
                    )
                )

                db.add(inventory)

        # ==========================================================
        # 8. CREATE ADJUSTMENT RECORD
        # ==========================================================

        adjustment = (
            location_models.LocationInventoryAdjustment(
                business_id=effective_business_id,

                location_id=location_id,

                item_id=item_id,

                quantity_adjusted=qty,

                reason=adjustment_data.reason,

                adjusted_by=current_user.username,

                adjusted_at=now_wat()
            )
        )

        db.add(adjustment)

        # ==========================================================
        # 9. COMMIT
        # ==========================================================

        db.commit()

        db.refresh(adjustment)

        return adjustment

    except HTTPException:

        db.rollback()
        raise

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                f"Location adjustment failed: "
                f"{str(e)}"
            )
        )


@router.get(
    "/location-balance-stock",
    response_model=list[location_schemas.LocationStockBalance]
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
        description="Search by item or category"
    ),
    business_id: Optional[int] = Query(None),
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
        # ==========================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        # ==========================================================
        # 2. BASE LOCATION INVENTORY QUERY
        # ==========================================================

        query = (
            db.query(
                location_models.LocationInventory,
                store_models.StoreItem,
                store_models.StoreCategory,
                location_models.Location
            )
            .join(
                store_models.StoreItem,
                store_models.StoreItem.id
                == location_models.LocationInventory.item_id
            )
            .outerjoin(
                store_models.StoreCategory,
                store_models.StoreCategory.id
                == store_models.StoreItem.category_id
            )
            .join(
                location_models.Location,
                location_models.Location.id
                == location_models.LocationInventory.location_id
            )
            .filter(
                location_models.LocationInventory.business_id
                == effective_business_id,

                store_models.StoreItem.business_id
                == effective_business_id,

                location_models.Location.business_id
                == effective_business_id
            )
        )

        # ==========================================================
        # 3. FILTER LOCATION
        # ==========================================================

        if location_id:
            query = query.filter(
                location_models.LocationInventory.location_id
                == location_id
            )

        # ==========================================================
        # 4. FILTER ITEM
        # ==========================================================

        if item_id:
            query = query.filter(
                location_models.LocationInventory.item_id
                == item_id
            )

        # ==========================================================
        # 5. FILTER CATEGORY
        # ==========================================================

        if category_id:
            query = query.filter(
                store_models.StoreItem.category_id
                == category_id
            )

        # ==========================================================
        # 6. FILTER ITEM TYPE
        # ==========================================================

        if item_type:
            query = query.filter(
                func.lower(
                    store_models.StoreItem.item_type
                ) == item_type.lower()
            )

        # ==========================================================
        # 7. SEARCH
        # ==========================================================

        if search:

            search_value = f"%{search}%"

            query = query.filter(
                store_models.StoreItem.name.ilike(
                    search_value
                )
                |
                store_models.StoreCategory.name.ilike(
                    search_value
                )
                |
                location_models.Location.name.ilike(
                    search_value
                )
            )

        # ==========================================================
        # 8. ORDER
        # ==========================================================

        query = query.order_by(
            location_models.Location.name.asc(),
            store_models.StoreItem.name.asc()
        )

        rows = query.all()

        # ==========================================================
        # 9. BUILD RESPONSE
        # ==========================================================

        response = []

        for inventory, item, category, location in rows:

            quantity = float(
                inventory.quantity or 0
            )

            unit_price = float(
                inventory.unit_price
                if inventory.unit_price is not None
                else item.unit_price or 0
            )

            total_value = round(
                quantity * unit_price,
                2
            )

            response.append(
                location_schemas.LocationStockBalance(
                    location_id=location.id,
                    location_name=location.name,

                    item_id=item.id,
                    item_name=item.name,

                    category_name=(
                        category.name
                        if category
                        else "Uncategorized"
                    ),

                    item_type=item.item_type,
                    unit=item.unit,

                    quantity=quantity,

                    unit_price=unit_price,

                    total_amount=total_value,

                    received_at=(
                        to_wat(inventory.received_at)
                        if inventory.received_at
                        else None
                    )
                )
            )

        return response

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to retrieve location "
                f"stock balance: {str(e)}"
            )
        )




# ==========================================================
# STORE STOCK BALANCE
# ==========================================================

@router.get(
    "/balance-stock",
    response_model=list[store_schemas.StoreStockBalance]
)
def get_store_balances(
    category_id: Optional[int] = Query(None),
    item_type: Optional[str] = Query(None),
    item_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    business_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: user_schemas.UserDisplaySchema = Depends(
        role_required(["store", "admin", "super_admin"])
    )
):
    try:

        # ==========================================================
        # 1. RESOLVE BUSINESS
        # ==========================================================

        effective_business_id = resolve_business_id(
            current_user,
            business_id
        )

        if not effective_business_id:
            raise HTTPException(
                status_code=400,
                detail="Business could not be determined."
            )

        # ==========================================================
        # 2. OPENING STOCK
        # ==========================================================

        opening_query = (
            db.query(
                store_models.StoreInventory.item_id,
                func.coalesce(
                    store_models.StoreInventory.opening_quantity,
                    0
                ).label("opening_stock")
            )
            .filter(
                store_models.StoreInventory.business_id
                == effective_business_id
            )
            .all()
        )

        opening_map = {
            row.item_id: float(
                row.opening_stock or 0
            )
            for row in opening_query
        }

        # ==========================================================
        # 3. TOTAL RECEIVED
        #
        # Stock received into the central store through purchases.
        # ==========================================================

        received_query = (
            db.query(
                store_models.StoreStockEntry.item_id,

                func.coalesce(
                    func.sum(
                        store_models.StoreStockEntry.original_quantity
                    ),
                    0
                ).label("total_received")
            )
            .filter(
                store_models.StoreStockEntry.business_id
                == effective_business_id
            )
            .group_by(
                store_models.StoreStockEntry.item_id
            )
            .all()
        )

        received_map = {
            row.item_id: float(
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
        # Therefore SUM(quantity_adjusted) represents the
        # NET effect of all adjustments.
        # ==========================================================

        adjustment_query = (
            db.query(
                store_models.StoreInventoryAdjustment.item_id,

                func.coalesce(
                    func.sum(
                        store_models.StoreInventoryAdjustment
                        .quantity_adjusted
                    ),
                    0
                ).label("total_adjusted")
            )
            .filter(
                store_models.StoreInventoryAdjustment.business_id
                == effective_business_id
            )
            .group_by(
                store_models.StoreInventoryAdjustment.item_id
            )
            .all()
        )

        adjustment_map = {
            row.item_id: float(
                row.total_adjusted or 0
            )
            for row in adjustment_query
        }

        # ==========================================================
        # 5. TOTAL STORE ISSUES
        #
        # Anything issued from the central store leaves
        # central store inventory.
        # ==========================================================

        issued_query = (
            db.query(
                store_models.StoreIssueItem.item_id,

                func.coalesce(
                    func.sum(
                        store_models.StoreIssueItem.quantity
                    ),
                    0
                ).label("total_issued")
            )
            .join(
                store_models.StoreIssue,
                store_models.StoreIssue.id
                == store_models.StoreIssueItem.issue_id
            )
            .filter(
                store_models.StoreIssue.business_id
                == effective_business_id
            )
            .group_by(
                store_models.StoreIssueItem.item_id
            )
            .all()
        )

        issued_map = {
            row.item_id: float(
                row.total_issued or 0
            )
            for row in issued_query
        }

        # ==========================================================
        # 6. CATERING / KITCHEN CONSUMPTION
        #
        # Keep this because MealOrder can consume StoreItem
        # stock directly.
        # ==========================================================

        restaurant_issued_query = (
            db.query(
                restaurant_models.MealOrderItem.store_item_id.label(
                    "item_id"
                ),

                func.coalesce(
                    func.sum(
                        restaurant_models.MealOrderItem.store_qty_used
                    ),
                    0
                ).label("restaurant_issued")
            )
            .join(
                restaurant_models.MealOrder,
                restaurant_models.MealOrder.id
                == restaurant_models.MealOrderItem.order_id
            )
            .filter(
                restaurant_models.MealOrder.status == "closed",

                restaurant_models.MealOrder.business_id
                == effective_business_id
            )
            .group_by(
                restaurant_models.MealOrderItem.store_item_id
            )
            .all()
        )

        for row in restaurant_issued_query:

            restaurant_quantity = float(
                row.restaurant_issued or 0
            )

            issued_map[row.item_id] = (
                issued_map.get(row.item_id, 0)
                + restaurant_quantity
            )

        # ==========================================================
        # 7. GET STORE ITEMS
        # ==========================================================

        query = (
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

                store_models.StoreCategory.name.label(
                    "category_name"
                ),

                store_models.StoreItem.unit_price.label(
                    "default_unit_price"
                )
            )
            .outerjoin(
                store_models.StoreCategory,
                store_models.StoreItem.category_id
                == store_models.StoreCategory.id
            )
            .filter(
                store_models.StoreItem.business_id
                == effective_business_id
            )
        )

        # ==========================================================
        # 8. FILTERS
        # ==========================================================

        if category_id is not None:

            query = query.filter(
                store_models.StoreItem.category_id
                == category_id
            )

        if item_type:

            query = query.filter(
                func.lower(
                    store_models.StoreItem.item_type
                )
                == item_type.lower()
            )

        if item_id is not None:

            query = query.filter(
                store_models.StoreItem.id
                == item_id
            )

        if search:

            search_value = f"%{search}%"

            query = query.filter(
                store_models.StoreItem.name.ilike(
                    search_value
                )
                |
                store_models.StoreCategory.name.ilike(
                    search_value
                )
            )

        # ==========================================================
        # 9. ORDER
        # ==========================================================

        query = query.order_by(
            store_models.StoreItem.name.asc()
        )

        items = query.all()

        # ==========================================================
        # 10. BUILD RESPONSE
        # ==========================================================

        response = []

        for item in items:

            # ======================================================
            # 10.1 CURRENT UNIT PRICE
            #
            # Use the most recent purchase price.
            # ======================================================

            latest_entry = (
                db.query(
                    store_models.StoreStockEntry
                )
                .filter(
                    store_models.StoreStockEntry.item_id
                    == item.item_id,

                    store_models.StoreStockEntry.business_id
                    == effective_business_id
                )
                .order_by(
                    store_models.StoreStockEntry.purchase_date.desc(),
                    store_models.StoreStockEntry.id.desc()
                )
                .first()
            )

            if latest_entry:

                current_unit_price = float(
                    latest_entry.unit_price or 0
                )

            else:

                current_unit_price = float(
                    item.default_unit_price or 0
                )

            # ======================================================
            # 10.2 STOCK COMPONENTS
            # ======================================================

            opening_stock = opening_map.get(
                item.item_id,
                0
            )

            total_received = received_map.get(
                item.item_id,
                0
            )

            total_issued = issued_map.get(
                item.item_id,
                0
            )

            total_adjusted = adjustment_map.get(
                item.item_id,
                0
            )

            # ======================================================
            # 10.3 FINAL BALANCE
            #
            # Opening
            # + Received
            # + Adjustments
            # - Issued
            # ======================================================

            balance = (
                opening_stock
                + total_received
                + total_adjusted
                - total_issued
            )

            # ======================================================
            # 10.4 PREVENT NEGATIVE DISPLAY
            # ======================================================

            if balance < 0:
                balance = 0

            # ======================================================
            # 10.5 TOTAL BALANCE VALUE
            # ======================================================

            balance_total_amount = round(
                balance * current_unit_price,
                2
            )

            # ======================================================
            # 10.6 RESPONSE
            # ======================================================

            response.append(
                store_schemas.StoreStockBalance(

                    item_id=item.item_id,

                    item_name=item.item_name,

                    category_name=(
                        item.category_name
                        or "Uncategorized"
                    ),

                    item_type=item.item_type,

                    unit=item.unit,

                    opening_stock=opening_stock,

                    total_received=total_received,

                    total_issued=total_issued,

                    total_adjusted=total_adjusted,

                    balance=balance,

                    current_unit_price=current_unit_price,

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
                "Failed to retrieve store stock balance: "
                f"{str(e)}"
            )
        )