from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


# ==========================================================
# CATERING USAGE ITEM CREATE
# ==========================================================

class CateringUsageItemCreate(BaseModel):

    item_id: int

    quantity_used: float = Field(
        gt=0,
        description="Quantity consumed/used",
    )


# ==========================================================
# CATERING USAGE CREATE
# ==========================================================

class CateringUsageCreate(BaseModel):

    location_id: int

    usage_date: Optional[datetime] = None

    note: Optional[str] = None

    items: list[CateringUsageItemCreate]


# ==========================================================
# CATERING USAGE UPDATE
# ==========================================================

class CateringUsageUpdate(BaseModel):

    location_id: Optional[int] = None

    usage_date: Optional[datetime] = None

    note: Optional[str] = None

    items: Optional[
        list[CateringUsageItemCreate]
    ] = None


# ==========================================================
# CATERING USAGE VOID
# ==========================================================

class CateringUsageVoid(BaseModel):

    reason: str = Field(
        min_length=1,
        max_length=255,
    )


# ==========================================================
# CATERING USAGE ITEM DISPLAY
# ==========================================================

class CateringUsageItemDisplay(BaseModel):

    id: int

    usage_id: int

    location_id: int

    item_id: int

    item_name: Optional[str] = None

    unit: Optional[str] = None

    quantity_used: float

    unit_price: Optional[float] = None

    total_amount: Optional[float] = None

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


# ==========================================================
# CATERING USAGE DISPLAY
# ==========================================================

class CateringUsageDisplay(BaseModel):

    id: int

    business_id: int

    location_id: int

    location_name: Optional[str] = None

    usage_date: datetime

    note: Optional[str] = None

    created_by: Optional[str] = None

    created_at: datetime

    updated_at: Optional[datetime] = None

    status: str

    voided_by: Optional[str] = None

    voided_at: Optional[datetime] = None

    void_reason: Optional[str] = None

    items: list[CateringUsageItemDisplay] = []

    model_config = ConfigDict(
        from_attributes=True
    )



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