from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.vendor.schemas import VendorDisplay  # ✅ import this
from app.vendor.schemas import VendorInStoreDisplay  # make sure this import path is correct
from app.vendor.schemas import VendorOut

from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Union

from app.kitchen.schemas import KitchenDisplaySimple

from app.locations.schemas import LocationSimple







# ----------------------------
# Store Category
# ----------------------------
class StoreCategoryBase(BaseModel):
    name: str


class StoreCategoryCreate(StoreCategoryBase):
    pass


class StoreCategoryDisplay(StoreCategoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ----------------------------
# Store Item
# ----------------------------
class StoreItemBase(BaseModel):
    name: str
    unit: str
    unit_price: float
    selling_price: Optional[float] = None
    category_id: Optional[int] = None
    item_type: Optional[str] = None




class StoreItemCreate(StoreItemBase):
    pass


# ✅ Nested item info
class StoreItemOut(BaseModel):
    id: int
    name: str
    unit: str
    unit_price: float
    selling_price: float        # ✅ new
    category_id: Optional[int] = None
    item_type: Optional[str] = None


    class Config:
        from_attributes = True



class StoreItemDisplay(BaseModel):
    id: int
    name: str
    unit: str
    category: Optional[StoreCategoryDisplay]
    item_type: Optional[str] = None
    unit_price: float
    selling_price: Optional[float] = None
    created_at: datetime
    


    class Config:
        from_attributes = True



#class StoreItemDisplay(BaseModel):
    #id: int
    #name: str
    #unit: str
    #unit_price: float
    #category_name: Optional[str]
    #created_at: datetime

    #class Config:
        #from_attributes = True



# ----------------------------
# Store Stock Entry (Purchase)
# ----------------------------
from fastapi import Form
from pydantic import BaseModel
from datetime import datetime

class StoreStockEntryCreate(BaseModel):
    item_id: int
    item_name: str
    invoice_number: str
    quantity: int
    unit_price: float
    vendor_id: int
    purchase_date: datetime
    


    @classmethod
    def as_form(
        cls,
        item_id: int = Form(...),
        item_name: str = Form(...),
        invoice_number: str = Form(...),
        quantity: int = Form(...),
        unit_price: float = Form(...),
        vendor_id: int = Form(...),
        purchase_date: datetime = Form(...),
        
    ):
        return cls(
            item_id=item_id,
            item_name=item_name,
            invoice_number=invoice_number,
            quantity=quantity,
            unit_price=unit_price,
            vendor_id=vendor_id,
            purchase_date=purchase_date,
            
        )




class PurchaseCreateList(BaseModel):
    id: int
    item_name: str
    invoice_number:str
    quantity: int
    unit_price: float
    total_amount: float
    purchase_date: datetime
    created_by: Optional[str]
    attachment_url: Optional[str]

    # ✅ Nested item and vendor
    item: Optional["StoreItemOut"] = None
    vendor: Optional["VendorOut"] = None

    class Config:
        from_attributes = True


# --- Display model for frontend lists ---
class StoreStockEntryDisplay(BaseModel):
    id: int
    item_name: str
    quantity: int
    unit_price: float
    total_amount: float
    purchase_date: datetime
    created_by: Optional[str]
    created_at: datetime
    attachment_url: Optional[str]
    kitchen_id: Optional[int] = None  # 👈 NEW

    # ✅ Show full vendor and item info
    item: Optional["StoreItemOut"]
    vendor: Optional["VendorOut"]

    class Config:
        from_attributes = True

class UpdatePurchase(BaseModel):
    id: int
    item_name: str
    quantity: int
    unit_price: float
    total_amount: float
    vendor_id: int
    purchase_date: datetime 
    created_at: datetime
    created_by: Optional[str]
    attachment: Optional[str]  # ✅ include this
    attachment_url: Optional[str]  # ✅ For frontend use

    class Config:
        from_attributes = True



from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field


# ==========================================================
# Store Issue
# ==========================================================

class IssueItemCreate(BaseModel):
    item_id: int
    quantity: int


class IssueCreate(BaseModel):
    issue_to: Literal["location"]
    issued_to_id: int
    issue_items: List[IssueItemCreate]
    issue_date: datetime = Field(default_factory=datetime.utcnow)


class IssueItemDisplay(BaseModel):
    id: int
    item: StoreItemDisplay
    quantity: int

    class Config:
        from_attributes = True


class IssueDisplay(BaseModel):
    id: int
    issue_to: str
    issued_to_id: int

    # Location returned here
    issued_to: Optional["LocationSimple"] = None

    issue_date: datetime
    issue_items: List[IssueItemDisplay]

    class Config:
        from_attributes = True


class IssueDisplayOut(BaseModel):
    id: int
    issue_to: str
    issued_to_id: int
    issue_date: datetime
    issue_items: List[IssueItemDisplay]

    class Config:
        from_attributes = True



class StoreInventoryAdjustmentCreate(BaseModel):
    item_id: int
    quantity_adjusted: int
    reason: str


class StoreInventoryAdjustmentDisplay(BaseModel):
    id: int
    item: StoreItemDisplay
    quantity_adjusted: int
    reason: str
    adjusted_by: str
    adjusted_at: datetime

    class Config:
        from_attributes = True





class StoreStockBalance(BaseModel):
    item_id: int
    item_name: str
    category_name: Optional[str] = None
    item_type: Optional[str] = None   # NEW FIELD
    unit: Optional[str] = None
    opening_stock: float = 0

    total_received: float
    total_issued: float
    total_adjusted: float
    balance: float
    current_unit_price: float
    balance_total_amount: float

    class Config:
        from_attributes = True


class KitchenItemSimple(BaseModel):
    item_id: int
    item_name: str
    selling_price: float

    class Config:
        from_attributes = True

