from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ==========================================================
# Base Schema
# ==========================================================

class LocationBase(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"


# ==========================================================
# Create
# ==========================================================

class LocationCreate(LocationBase):
    pass


# ==========================================================
# Update
# ==========================================================

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


# ==========================================================
# Display
# ==========================================================

class LocationDisplay(LocationBase):
    id: int
    business_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LocationSimple(BaseModel):
    id: int
    name: str
    code: str

    model_config = ConfigDict(from_attributes=True)




class LocationStockBalance(BaseModel):
    location_id: int
    location_name: str

    item_id: int
    item_name: str

    category_name: str
    item_type: Optional[str] = None
    unit: str

    quantity: float

    unit_price: float
    total_amount: float

    received_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==========================================================
# LOCATION INVENTORY ADJUSTMENT
# ==========================================================

class LocationInventoryAdjustmentCreate(BaseModel):
    location_id: int
    item_id: int
    quantity_adjusted: int
    reason: Optional[str] = None


class LocationInventoryAdjustmentDisplay(BaseModel):
    id: int

    location_id: int
    item_id: int

    quantity_adjusted: int

    reason: Optional[str] = None
    adjusted_by: Optional[str] = None
    adjusted_at: datetime

    class Config:
        from_attributes = True