from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext  # ✅ Add this
from fastapi import Body
from app.users.auth import authenticate_user, create_access_token, get_current_user
from app.database import get_db
from app.users import crud as user_crud, schemas # Correct import for user CRUD operations
from app.users import models as user_models
from app.business.models import Business
from app.business import models as business_models
from app.license.models import LicenseKey
from sqlalchemy import func
from app.core.timezone import now_wat, to_wat

from app.roles.models import Role
from app.locations.models import Location

from app.users.permissions import role_required

from app.core.roles import (
    SUPER_ADMIN,
    USER_MANAGEMENT_ROLES,
)

import os
from loguru import logger
import os

router = APIRouter()



ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

logger.add("app.log", rotation="500 MB", level="DEBUG")



#log_path = os.path.join(os.getenv("LOCALAPPDATA", "C:\\Temp"), "app.log")
#logger.add("C:/Users/KLOUNGE/Documents/app.log", rotation="500 MB", level="DEBUG")




pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Store your admin password securely (e.g., environment variable)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "supersecret")

@router.post(
    "/register",
    response_model=schemas.UserDisplaySchema,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    """
    Create a new user.
    - Super Admin can create users for any business.
    - Admin can only create users within their own business.
    """

    # --------------------------------------------------
    # Normalize Username
    # --------------------------------------------------
    user.username = user.username.strip().lower()

    # --------------------------------------------------
    # Determine Business
    # --------------------------------------------------
    if current_user.role_code == SUPER_ADMIN:
        business_id = user.business_id
    else:
        business_id = current_user.business_id

    if business_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business is required.",
        )

    # --------------------------------------------------
    # Validate Business
    # --------------------------------------------------
    business = (
        db.query(Business)
        .filter(Business.id == business_id)
        .first()
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found.",
        )

    if not business.is_license_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Business license is inactive.",
        )

    # --------------------------------------------------
    # Check Duplicate Username
    # --------------------------------------------------
    existing_user = (
        db.query(user_models.User)
        .filter(
            user_models.User.business_id == business_id,
            func.lower(user_models.User.username) == user.username,
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists.",
        )

    
    role = (
        db.query(Role)
        .filter(
            Role.id == user.role_id,
            Role.business_id == business_id,
            Role.status == "active",
        )
        .first()
    )

    print("Matched role:", role)

    # --------------------------------------------------
    # Validate Location (Optional)
    # --------------------------------------------------
    if user.location_id is not None:

        location = (
            db.query(Location)
            .filter(
                Location.id == user.location_id,
                Location.business_id == business_id,
                Location.status == "active",
            )
            .first()
        )

        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected location not found.",
            )

    # --------------------------------------------------
    # Hash Password
    # --------------------------------------------------
    hashed_password = pwd_context.hash(user.password)

    # --------------------------------------------------
    # Create User
    # --------------------------------------------------
    new_user = user_crud.create_user(
        db=db,
        user=user,
        hashed_password=hashed_password,
        business_id=business_id,
    )

    return schemas.UserDisplaySchema(
        id=new_user.id,
        username=new_user.username,
        full_name=new_user.full_name,
        phone=new_user.phone,
        business_id=new_user.business_id,
        business_name=business.name,
        role_id=new_user.role_id,
        role_name=role.name,
        role_code=role.code,
        location_id=new_user.location_id,
        location_name=location.name if new_user.location_id else None,
        status=new_user.status,
        created_at=new_user.created_at,
        updated_at=new_user.updated_at,
    )





from datetime import datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.users.auth import authenticate_user, create_access_token
from app.core.roles import SUPER_ADMIN
from app.business.models import Business
from app.license.models import LicenseKey
from app.core.timezone import now_wat
from loguru import logger


@router.post("/token")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Authenticate user and return JWT token.
    """

    username = (
        form_data.username
        .strip()
        .lower()
    )

    password = form_data.password

    logger.info(
        f"Login attempt -> {username}"
    )

    # ======================================================
    # AUTHENTICATE
    # ======================================================

    user = authenticate_user(
        db=db,
        username=username,
        password=password,
    )

    if not user:

        logger.warning(
            f"Authentication failed -> {username}"
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    logger.info(
        f"Password authentication successful -> {username}"
    )

    # ======================================================
    # USER STATUS
    # ======================================================

    if user.status != "active":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    # ======================================================
    # RELATIONSHIPS
    # ======================================================

    role = user.role
    business = user.business
    location = user.location

    # ======================================================
    # SUPER ADMIN
    # ======================================================

    is_super_admin = (
        user.business_id is None
    )

    business_id = None
    license_key = None

    # ======================================================
    # BUSINESS USER
    # ======================================================

    if not is_super_admin:

        if business is None:

            logger.error(
                f"User {username} has business_id "
                f"{user.business_id} but business was not found."
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not assigned to a valid business.",
            )

        # --------------------------------------------------
        # BUSINESS LICENSE
        # --------------------------------------------------

        if not business.is_license_active:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Business license is inactive.",
            )

        # --------------------------------------------------
        # ACTIVE LICENSE
        # --------------------------------------------------

        license_key = (
            db.query(LicenseKey)
            .filter(
                LicenseKey.business_id
                == business.id,

                LicenseKey.is_active.is_(True),
            )
            .order_by(
                LicenseKey.expiration_date.desc()
            )
            .first()
        )

        if license_key is None:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active license found.",
            )

        # --------------------------------------------------
        # LICENSE EXPIRATION
        # --------------------------------------------------

        if (
            license_key.expiration_date
            is not None
        ):

            if (
                to_wat(
                    license_key.expiration_date
                )
                < now_wat()
            ):

                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Business license has expired.",
                )

        business_id = business.id

    # ======================================================
    # JWT PAYLOAD
    # ======================================================

    token_data = {
        "sub": user.username,

        "business_id": business_id,

        "role_id": (
            role.id
            if role
            else None
        ),

        "role_code": (
            SUPER_ADMIN
            if is_super_admin
            else (
                role.code
                if role
                else None
            )
        ),

        "location_id": (
            location.id
            if location
            else None
        ),
    }

    logger.info(
        f"JWT payload -> {token_data}"
    )

    # ======================================================
    # CREATE TOKEN
    # ======================================================

    access_token = create_access_token(
        data=token_data
    )

    logger.info(
        f"Login successful -> {username}"
    )

    # ======================================================
    # RESPONSE
    # ======================================================

    return {

        "access_token": access_token,

        "token_type": "bearer",

        "user": {

            "id": user.id,

            "username": user.username,

            "full_name": user.full_name,

            "phone": user.phone,

            "status": user.status,

            "business_id": user.business_id,

            "business_name": (
                business.name
                if business
                else None
            ),

            "role_id": (
                role.id
                if role
                else None
            ),

            "role_name": (
                "Super Administrator"
                if is_super_admin
                else (
                    role.name
                    if role
                    else None
                )
            ),

            "role_code": (
                SUPER_ADMIN
                if is_super_admin
                else (
                    role.code
                    if role
                    else None
                )
            ),

            "location_id": (
                location.id
                if location
                else None
            ),

            "location_name": (
                location.name
                if location
                else None
            ),
        },

        "business": {

            "id": (
                business.id
                if business
                else None
            ),

            "name": (
                business.name
                if business
                else None
            ),

            "address": (
                business.address
                if business
                else None
            ),

            "phone": (
                business.phone
                if business
                else None
            ),

            "email": (
                business.email
                if business
                else None
            ),
        },

        "license": {

            "is_active": (
                license_key.is_active
                if license_key
                else None
            ),

            "expiration_date": (
                license_key.expiration_date
                if license_key
                else None
            ),
        },
    }



# ==========================================================
# LIST USERS
# ==========================================================
@router.get(
    "/",
    response_model=list[schemas.UserDisplaySchema],
)
def list_users(
    db: Session = Depends(get_db),
    current_user: schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):

    if current_user.role_code == SUPER_ADMIN:
        return user_crud.get_all_users(db)

    return user_crud.get_users_by_business(
        db=db,
        business_id=current_user.business_id,
    )


# ==========================================================
# RESET PASSWORD
# ==========================================================
@router.put(
    "/{username}/reset-password",
)
def reset_password(
    username: str,
    new_password: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):

    user = user_crud.get_user_by_username(
        db,
        username,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if (
        current_user.role_code != SUPER_ADMIN
        and user.business_id != current_user.business_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only reset passwords within your business.",
        )

    user.hashed_password = pwd_context.hash(
        new_password
    )

    db.commit()

    return {
        "message": "Password reset successfully."
    }


# ==========================================================
# CURRENT USER
# ==========================================================
@router.get(
    "/me",
    response_model=schemas.UserDisplaySchema,
)
def get_current_user_info(
    current_user: schemas.UserDisplaySchema = Depends(
        get_current_user
    ),
):

    return current_user


# ==========================================================
# UPDATE USER
# ==========================================================
@router.put(
    "/{username}",
    response_model=schemas.UserDisplaySchema,
)
def update_user(
    username: str,
    updated_user: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):

    user = user_crud.get_user_by_username(
        db,
        username,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if (
        current_user.role_code != SUPER_ADMIN
        and user.business_id != current_user.business_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update users within your business.",
        )

    # -----------------------------
    # Validate Role
    # -----------------------------
    if updated_user.role_id is not None:

        role = (
            db.query(Role)
            .filter(
                Role.id == updated_user.role_id,
                Role.business_id == user.business_id,
                Role.status == "active",
            )
            .first()
        )

        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected role not found.",
            )

    # -----------------------------
    # Validate Location
    # -----------------------------
    if updated_user.location_id is not None:

        location = (
            db.query(Location)
            .filter(
                Location.id == updated_user.location_id,
                Location.business_id == user.business_id,
                Location.status == "active",
            )
            .first()
        )

        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected location not found.",
            )

    hashed_password = None

    if updated_user.password:
        hashed_password = pwd_context.hash(
            updated_user.password
        )

    updated = user_crud.update_user(
        db=db,
        username=username,
        updated_user=updated_user,
        hashed_password=hashed_password,
    )

    return updated


# ==========================================================
# DELETE USER
# ==========================================================
@router.delete(
    "/{username}",
)
def delete_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: schemas.UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):

    username = username.strip().lower()

    if username == current_user.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )

    user = user_crud.get_user_by_username(
        db,
        username,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if (
        current_user.role_code != SUPER_ADMIN
        and user.business_id != current_user.business_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete users within your business.",
        )

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully."
    }