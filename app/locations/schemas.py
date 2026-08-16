from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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

    category_name: Optional[str] = None
    item_type: Optional[str] = None
    unit: Optional[str] = None

    opening_stock: float = 0

    total_received: float
    total_used: float
    total_adjusted: float

    balance: float

    current_unit_price: float
    balance_total_amount: float

    class Config:
        from_attributes = True




# ==========================================================
# LOCATION INVENTORY ADJUSTMENT CREATE
# ==========================================================

class LocationInventoryAdjustmentCreate(BaseModel):

    location_id: int

    item_id: int

    quantity_adjusted: float = Field(
        description=(
            "Signed adjustment quantity. "
            "Positive adds stock, negative removes stock."
        )
    )

    reason: Optional[str] = Field(
        default=None,
        max_length=255
    )


# ==========================================================
# LOCATION INVENTORY ADJUSTMENT DISPLAY
# ==========================================================

class LocationInventoryAdjustmentDisplay(BaseModel):

    id: int

    location_id: int

    location_name: Optional[str] = None

    item_id: int

    item_name: Optional[str] = None

    unit: Optional[str] = None

    category_name: Optional[str] = None

    item_type: Optional[str] = None

    quantity_adjusted: float

    remaining_quantity: float

    reason: Optional[str] = None

    adjusted_by: Optional[str] = None

    adjusted_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )