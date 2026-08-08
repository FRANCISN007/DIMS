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

    # Role selected from /roles/
    role_ids: list[int]

    # Optional business
    business_id: Optional[int] = None

    # Optional location
    location_id: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None

    # Role selected from /roles/
    role_ids: Optional[list[int]] = None

    # Business can be changed by Super Admin
    business_id: Optional[int] = None

    # Location belongs to the selected business
    location_id: Optional[int] = None

    status: Optional[str] = None


class UserRoleDisplay(BaseModel):
    id: int
    name: str
    code: str

    model_config = ConfigDict(
        from_attributes=True
    )


# ==========================================================
# Display User
# ==========================================================

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RoleSimple(BaseModel):
    id: int
    name: str
    code: str

    model_config = ConfigDict(from_attributes=True)


from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ==========================================================
# ROLE SIMPLE
# ==========================================================

class RoleSimple(BaseModel):
    id: int
    name: str
    code: str

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# USER DISPLAY
# ==========================================================

class UserDisplaySchema(BaseModel):

    id: int

    username: str

    full_name: str | None = None

    phone: str | None = None

    # ------------------------------------------------------
    # BUSINESS
    # ------------------------------------------------------

    business_id: int | None = None

    business_name: str | None = None

    # ------------------------------------------------------
    # MULTIPLE ROLES
    # ------------------------------------------------------

    roles: list[RoleSimple] = []

    # ------------------------------------------------------
    # BACKWARD COMPATIBILITY
    # ------------------------------------------------------

    # These allow existing routers such as:
    #
    # current_user.role_code
    #
    # to continue working while we migrate
    # authorization to multiple roles.

    role_id: int | None = None

    role_name: str | None = None

    role_code: str | None = None

    # ------------------------------------------------------
    # LOCATION
    # ------------------------------------------------------

    location_id: int | None = None

    location_name: str | None = None

    # ------------------------------------------------------
    # STATUS
    # ------------------------------------------------------

    status: str

    # ------------------------------------------------------
    # DATES
    # ------------------------------------------------------

    created_at: datetime

    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )

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