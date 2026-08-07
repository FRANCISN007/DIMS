from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ==========================================================
# Base Schema
# ==========================================================

class RoleBase(BaseModel):
    business_id: int | None = None
    name: str
    code: str
    description: Optional[str] = None
    status: str = "active"


# ==========================================================
# Create
# ==========================================================

class RoleCreate(RoleBase):
    pass


# ==========================================================
# Update
# ==========================================================

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


# ==========================================================
# Simple (Dropdowns)
# ==========================================================

class RoleSimple(BaseModel):
    id: int
    name: str
    code: str

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# Display
# ==========================================================

class RoleDisplay(RoleBase):
    id: int
    business_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)