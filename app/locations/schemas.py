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