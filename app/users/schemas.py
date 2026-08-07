from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ==========================================================
# Business Info
# ==========================================================

class BusinessInfo(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# Create User
# ==========================================================

class UserCreate(BaseModel):
    username: str
    full_name: str
    phone: Optional[str] = None
    password: str

    role_id: Optional[int] = None
    location_id: Optional[int] = None

    business_id: Optional[int] = None


# ==========================================================
# Update User
# ==========================================================

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None

    role_id: Optional[int] = None
    location_id: Optional[int] = None

    status: Optional[str] = None


# ==========================================================
# Display User
# ==========================================================

class UserDisplaySchema(BaseModel):
    id: int
    username: str
    full_name: str | None = None
    phone: str | None = None

    business_id: int | None = None
    business_name: str | None = None

    role_id: int | None = None
    role_name: str |None = None
    role_code: str | None = None

    location_id: int | None = None
    location_name: str | None = None

    status: str

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# Super Admin
# ==========================================================

class SuperAdminCreate(BaseModel):
    username: str
    full_name: str
    password: str
    admin_license_password: str


class SuperAdminUpdate(BaseModel):
    username: str
    full_name: Optional[str] = None
    new_password: str
    admin_license_password: str



class UserSimple(BaseModel):
    id: int
    full_name: str

    model_config = ConfigDict(from_attributes=True)