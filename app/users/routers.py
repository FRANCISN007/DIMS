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
    # ==========================================================
    # 1. NORMALIZE USERNAME
    # ==========================================================

    username = user.username.strip().lower()

    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required.",
        )

    # ==========================================================
    # 2. DETERMINE CURRENT USER TYPE
    # ==========================================================

    is_super_admin = (
        current_user.role_code == SUPER_ADMIN
        or current_user.business_id is None
    )

    # ==========================================================
    # 3. DETERMINE BUSINESS
    # ==========================================================

    if is_super_admin:

        # Super Admin must select business
        if user.business_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business is required.",
            )

        business_id = user.business_id

    else:

        # Normal Admin uses own business
        if current_user.business_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your account is not assigned to a business."
                ),
            )

        business_id = current_user.business_id

    # ==========================================================
    # 4. LOAD BUSINESS
    # ==========================================================

    business = (
        db.query(Business)
        .filter(
            Business.id == business_id
        )
        .first()
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found.",
        )

    # ==========================================================
    # 5. CHECK BUSINESS LICENSE
    # ==========================================================

    if not business.is_license_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Business license is inactive.",
        )

    # ==========================================================
    # 6. CHECK DUPLICATE USERNAME
    # ==========================================================

    existing_user = (
        db.query(user_models.User)
        .filter(
            user_models.User.business_id == business_id,
            func.lower(
                user_models.User.username
            ) == username,
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists.",
        )

    # ==========================================================
    # 7. VALIDATE USER STATUS
    # ==========================================================

    if user.status not in {"active", "inactive"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User status must be active or inactive.",
        )

    # ==========================================================
    # 8. VALIDATE ROLE IDS
    # ==========================================================

    if not user.role_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one role is required.",
        )

    # ----------------------------------------------------------
    # Remove duplicate role IDs while preserving order
    # ----------------------------------------------------------

    role_ids = list(
        dict.fromkeys(
            int(role_id)
            for role_id in user.role_ids
        )
    )

    # ==========================================================
    # 9. LOAD ACTIVE ROLES
    # ==========================================================

    roles = (
        db.query(Role)
        .filter(
            Role.id.in_(role_ids),
            Role.status == "active",
        )
        .order_by(Role.id)
        .all()
    )

    # ==========================================================
    # 10. MAKE SURE EVERY ROLE EXISTS
    # ==========================================================

    found_role_ids = {
        role.id
        for role in roles
    }

    missing_role_ids = [
        role_id
        for role_id in role_ids
        if role_id not in found_role_ids
    ]

    if missing_role_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "One or more selected roles are invalid "
                "or inactive."
            ),
        )

    # ==========================================================
    # 11. VALIDATE ROLE BUSINESS
    # ==========================================================

    for role in roles:

        if role.business_id is not None:

            if role.business_id != business_id:

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Role '{role.name}' does not belong "
                        f"to the selected business."
                    ),
                )

    # ==========================================================
    # 12. VALIDATE LOCATION
    # ==========================================================

    location = None

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
                detail=(
                    "Selected location was not found, "
                    "is inactive, or does not belong "
                    "to the selected business."
                ),
            )

    # ==========================================================
    # 13. HASH PASSWORD
    # ==========================================================

    hashed_password = pwd_context.hash(
        user.password
    )

    # ==========================================================
    # 14. PREPARE USER DATA
    # ==========================================================

    user.username = username

    # ==========================================================
    # 15. CREATE USER
    # ==========================================================

    new_user = user_crud.create_user(
        db=db,
        user=user,
        hashed_password=hashed_password,
        business_id=business_id,
    )

    # ==========================================================
    # 16. SET USER STATUS
    # ==========================================================
    #
    # IMPORTANT:
    # This belongs to the USER, not the ROLE.
    #
    # John -> inactive
    # Henry -> active
    #
    # Both can still have the Camp Boss role.
    #

    new_user.status = user.status

    # ==========================================================
    # 17. ASSIGN ROLES
    # ==========================================================

    new_user.roles = roles

    # ==========================================================
    # 18. ASSIGN LOCATION
    # ==========================================================

    new_user.location_id = (
        location.id
        if location
        else None
    )

    # ==========================================================
    # 19. SAVE
    # ==========================================================

    db.commit()

    db.refresh(new_user)

    # ==========================================================
    # 20. PRIMARY ROLE
    # ==========================================================

    primary_role = (
        new_user.roles[0]
        if new_user.roles
        else None
    )

    # ==========================================================
    # 21. RETURN USER
    # ==========================================================

    return schemas.UserDisplaySchema(

        id=new_user.id,

        username=new_user.username,

        full_name=new_user.full_name,

        phone=new_user.phone,

        # ------------------------------------------------------
        # Business
        # ------------------------------------------------------

        business_id=new_user.business_id,

        business_name=business.name,

        # ------------------------------------------------------
        # Multiple roles
        # ------------------------------------------------------

        roles=[
            {
                "id": role.id,
                "name": role.name,
                "code": role.code,
            }
            for role in new_user.roles
        ],

        # ------------------------------------------------------
        # Backward compatibility
        # ------------------------------------------------------

        role_id=(
            primary_role.id
            if primary_role
            else None
        ),

        role_name=(
            primary_role.name
            if primary_role
            else None
        ),

        role_code=(
            primary_role.code
            if primary_role
            else None
        ),

        # ------------------------------------------------------
        # Location
        # ------------------------------------------------------

        location_id=(
            location.id
            if location
            else None
        ),

        location_name=(
            location.name
            if location
            else None
        ),

        # ------------------------------------------------------
        # USER STATUS
        # ------------------------------------------------------

        status=new_user.status,

        # ------------------------------------------------------
        # Dates
        # ------------------------------------------------------

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

    Login is allowed only when:

    1. User account status is active.
    2. For business users:
       - At least one role is assigned.
       - Business exists.
       - Business license is active.
       - An active license exists and has not expired.
    3. Super Admin does not depend on a Role record.

    IMPORTANT:
    Role status does NOT control login.

    The USER status controls whether the account can log in.

    Role status should be handled by the authorization /
    permission system after login.

    Supports:
    - Super Admin
    - Business users
    - Multiple roles per user
    - Optional user location
    """

    # ======================================================
    # USERNAME / PASSWORD
    # ======================================================

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
    # AUTHENTICATE USER
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
    #
    # ONLY USER STATUS controls whether the account
    # can authenticate.
    #
    # active   -> login allowed
    # inactive -> login denied
    #
    # Role status is intentionally NOT checked here.
    #
    # ======================================================

    if (
        user.status is None
        or user.status.lower().strip() != "active"
    ):

        logger.warning(
            f"Login blocked - inactive user -> {username}"
        )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    # ======================================================
    # RELATIONSHIPS
    # ======================================================

    roles = user.roles or []

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
    # ROLE VALIDATION
    # ======================================================
    #
    # IMPORTANT:
    #
    # Role status does NOT control login.
    #
    # We only require that a normal business user has
    # at least one assigned role.
    #
    # DO NOT check:
    #
    #     role.status
    #
    # here.
    #
    # Example:
    #
    # User status = active
    # Role status = inactive
    #
    # -> USER CAN LOGIN.
    #
    # Authorization logic should determine what that
    # user can access.
    #
    # ======================================================

    if not is_super_admin:

        if not roles:

            logger.warning(
                f"Login blocked - no role assigned -> {username}"
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no role assigned.",
            )

    # ======================================================
    # BUSINESS USER
    # ======================================================

    if not is_super_admin:

        # --------------------------------------------------
        # BUSINESS MUST EXIST
        # --------------------------------------------------

        if business is None:

            logger.error(
                f"User {username} has business_id "
                f"{user.business_id} but business "
                f"was not found."
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "User is not assigned to "
                    "a valid business."
                ),
            )

        # --------------------------------------------------
        # BUSINESS LICENSE
        # --------------------------------------------------

        if not business.is_license_active:

            logger.warning(
                f"Login blocked - business license inactive "
                f"for {username}"
            )

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
                LicenseKey.business_id == business.id,
                LicenseKey.is_active.is_(True),
            )
            .order_by(
                LicenseKey.expiration_date.desc()
            )
            .first()
        )

        if license_key is None:

            logger.warning(
                f"Login blocked - no active license "
                f"for {username}"
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active license found.",
            )

        # --------------------------------------------------
        # LICENSE EXPIRATION
        # --------------------------------------------------

        if license_key.expiration_date is not None:

            if (
                to_wat(
                    license_key.expiration_date
                )
                < now_wat()
            ):

                logger.warning(
                    f"Login blocked - expired license "
                    f"for {username}"
                )

                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        "Business license has expired."
                    ),
                )

        business_id = business.id

    # ======================================================
    # ROLES
    # ======================================================

    if is_super_admin:

        # --------------------------------------------------
        # SUPER ADMIN
        # --------------------------------------------------

        role_id = None

        role_name = "Super Administrator"

        role_code = SUPER_ADMIN

        role_list = []

        role_ids = []

        role_codes = [
            SUPER_ADMIN
        ]

    else:

        # --------------------------------------------------
        # BUSINESS USER
        # --------------------------------------------------
        #
        # IMPORTANT:
        # Include the assigned roles regardless of their
        # status.
        #
        # Role status is NOT a login restriction.
        #
        # --------------------------------------------------

        role_list = [
            {
                "id": role.id,
                "name": role.name,
                "code": role.code,
            }
            for role in roles
        ]

        role_ids = [
            role.id
            for role in roles
        ]

        role_codes = [
            role.code
            for role in roles
        ]

        # --------------------------------------------------
        # PRIMARY ROLE
        # --------------------------------------------------

        primary_role = (
            roles[0]
            if roles
            else None
        )

        role_id = (
            primary_role.id
            if primary_role
            else None
        )

        role_name = (
            primary_role.name
            if primary_role
            else None
        )

        role_code = (
            primary_role.code
            if primary_role
            else None
        )

    # ======================================================
    # LOCATION
    # ======================================================

    location_id = (
        location.id
        if location
        else None
    )

    location_name = (
        location.name
        if location
        else None
    )

    # ======================================================
    # JWT PAYLOAD
    # ======================================================

    token_data = {

        "sub": user.username,

        "business_id": business_id,

        # --------------------------------------------------
        # MULTIPLE ROLES
        # --------------------------------------------------

        "role_ids": role_ids,

        "role_codes": role_codes,

        # --------------------------------------------------
        # BACKWARD COMPATIBILITY
        # --------------------------------------------------

        "role_id": role_id,

        "role_code": role_code,

        # --------------------------------------------------
        # LOCATION
        # --------------------------------------------------

        "location_id": location_id,
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

        # ==================================================
        # USER
        # ==================================================

        "user": {

            "id": user.id,

            "username": user.username,

            "full_name": user.full_name,

            "phone": user.phone,

            "status": user.status,

            # ----------------------------------------------
            # BUSINESS
            # ----------------------------------------------

            "business_id": user.business_id,

            "business_name": (
                business.name
                if business
                else None
            ),

            # ----------------------------------------------
            # MULTIPLE ROLES
            # ----------------------------------------------

            "roles": role_list,

            # ----------------------------------------------
            # BACKWARD COMPATIBILITY
            # ----------------------------------------------

            "role_id": role_id,

            "role_name": role_name,

            "role_code": role_code,

            # ----------------------------------------------
            # LOCATION
            # ----------------------------------------------

            "location_id": location_id,

            "location_name": location_name,
        },

        # ==================================================
        # BUSINESS
        # ==================================================

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

        # ==================================================
        # LICENSE
        # ==================================================

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
    # ==========================================================
    # 1. DETERMINE CURRENT USER TYPE
    # ==========================================================

    is_super_admin = (
        current_user.role_code == SUPER_ADMIN
        or current_user.business_id is None
    )

    # ==========================================================
    # 2. LOAD USERS
    # ==========================================================

    if is_super_admin:

        users = (
            db.query(user_models.User)
            .order_by(
                user_models.User.id.desc()
            )
            .all()
        )

    else:

        if current_user.business_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your account is not assigned "
                    "to a business."
                ),
            )

        users = (
            db.query(user_models.User)
            .filter(
                user_models.User.business_id
                == current_user.business_id
            )
            .order_by(
                user_models.User.id.desc()
            )
            .all()
        )

    # ==========================================================
    # 3. BUILD RESPONSE
    # ==========================================================

    result = []

    for user in users:

        # ======================================================
        # BUSINESS
        # ======================================================

        business = user.business

        # ======================================================
        # LOCATION
        # ======================================================

        location = user.location

        # ======================================================
        # ROLES
        # ======================================================

        roles = user.roles or []

        # ======================================================
        # PRIMARY ROLE
        # ======================================================

        primary_role = (
            roles[0]
            if roles
            else None
        )

        # ======================================================
        # CREATE USER DISPLAY RESPONSE
        # ======================================================

        result.append(
            schemas.UserDisplaySchema(

                # ------------------------------------------------
                # Basic information
                # ------------------------------------------------

                id=user.id,

                username=user.username,

                full_name=user.full_name,

                phone=user.phone,

                # ------------------------------------------------
                # Business
                # ------------------------------------------------

                business_id=(
                    user.business_id
                ),

                business_name=(
                    business.name
                    if business
                    else None
                ),

                # ------------------------------------------------
                # Multiple roles
                # ------------------------------------------------

                roles=[
                    {
                        "id": role.id,
                        "name": role.name,
                        "code": role.code,
                    }
                    for role in roles
                ],

                # ------------------------------------------------
                # Backward compatibility
                # ------------------------------------------------

                role_id=(
                    primary_role.id
                    if primary_role
                    else None
                ),

                role_name=(
                    primary_role.name
                    if primary_role
                    else None
                ),

                role_code=(
                    primary_role.code
                    if primary_role
                    else None
                ),

                # ------------------------------------------------
                # Location
                # ------------------------------------------------

                location_id=(
                    location.id
                    if location
                    else None
                ),

                location_name=(
                    location.name
                    if location
                    else None
                ),

                # ------------------------------------------------
                # Status
                # ------------------------------------------------

                status=user.status,

                # ------------------------------------------------
                # Dates
                # ------------------------------------------------

                created_at=user.created_at,

                updated_at=user.updated_at,
            )
        )

    # ==========================================================
    # 4. RETURN USERS
    # ==========================================================

    return result




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
    # ==========================================================
    # 1. NORMALIZE USERNAME
    # ==========================================================

    username = username.strip().lower()

    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required.",
        )

    # ==========================================================
    # 2. LOAD USER
    # ==========================================================

    user = user_crud.get_user_by_username(
        db,
        username,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # ==========================================================
    # 3. DETERMINE CURRENT USER TYPE
    # ==========================================================

    is_super_admin = (
        current_user.role_code == SUPER_ADMIN
        or current_user.business_id is None
    )

    # ==========================================================
    # 4. CHECK BUSINESS ACCESS
    # ==========================================================

    if not is_super_admin:

        if current_user.business_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your account is not assigned "
                    "to a business."
                ),
            )

        if user.business_id != current_user.business_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You can only update users "
                    "within your business."
                ),
            )

    # ==========================================================
    # 5. LOAD USER BUSINESS
    # ==========================================================

    business = None

    if user.business_id is not None:

        business = (
            db.query(Business)
            .filter(
                Business.id == user.business_id
            )
            .first()
        )

        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found.",
            )

        # ------------------------------------------------------
        # Check business license
        # ------------------------------------------------------

        if not business.is_license_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Business license is inactive.",
            )

    # ==========================================================
    # 6. VALIDATE ROLES
    # ==========================================================

    roles = None

    if updated_user.role_ids is not None:

        if not updated_user.role_ids:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one role is required.",
            )

        # ------------------------------------------------------
        # Remove duplicate role IDs while preserving order
        # ------------------------------------------------------

        role_ids = list(
            dict.fromkeys(
                int(role_id)
                for role_id in updated_user.role_ids
            )
        )

        # ------------------------------------------------------
        # Load active roles
        # ------------------------------------------------------

        roles = (
            db.query(Role)
            .filter(
                Role.id.in_(role_ids),
                Role.status == "active",
            )
            .order_by(Role.id)
            .all()
        )

        # ------------------------------------------------------
        # Make sure every submitted role was found
        # ------------------------------------------------------

        found_role_ids = {
            role.id
            for role in roles
        }

        missing_role_ids = [
            role_id
            for role_id in role_ids
            if role_id not in found_role_ids
        ]

        if missing_role_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "One or more selected roles are "
                    "invalid or inactive."
                ),
            )

        # ------------------------------------------------------
        # Validate role business
        # ------------------------------------------------------

        if user.business_id is not None:

            for role in roles:

                # ------------------------------------------------
                # Global roles are allowed.
                #
                # Business-specific roles must belong to
                # the user's business.
                # ------------------------------------------------

                if role.business_id is not None:

                    if role.business_id != user.business_id:

                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=(
                                f"Role '{role.name}' does not "
                                f"belong to this business."
                            ),
                        )

    # ==========================================================
    # 7. VALIDATE LOCATION
    # ==========================================================

    location = None

    if updated_user.location_id is not None:

        if user.business_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A location cannot be assigned "
                    "to a user without a business."
                ),
            )

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
                detail=(
                    "Selected location was not found, "
                    "is inactive, or does not belong "
                    "to this business."
                ),
            )

    # ==========================================================
    # 8. HASH PASSWORD
    # ==========================================================

    hashed_password = None

    if updated_user.password:

        hashed_password = pwd_context.hash(
            updated_user.password
        )

    # ==========================================================
    # 9. UPDATE BASIC USER INFORMATION
    # ==========================================================

    updated = user_crud.update_user(
        db=db,
        username=username,
        updated_user=updated_user,
        hashed_password=hashed_password,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User could not be updated.",
        )

    # ==========================================================
    # 10. UPDATE ROLES
    # ==========================================================

    if roles is not None:
        updated.roles = roles

    # ==========================================================
    # 11. UPDATE LOCATION
    # ==========================================================

    if updated_user.location_id is not None:

        updated.location_id = location.id

    # ----------------------------------------------------------
    # If the caller explicitly wants to remove the location,
    # UserUpdate.location_id should support None as an explicit
    # value. Since Pydantic currently defaults None, this section
    # only changes the location when a location ID is supplied.
    # ----------------------------------------------------------

    # ==========================================================
    # 12. SAVE CHANGES
    # ==========================================================

    db.commit()

    db.refresh(updated)

    # ==========================================================
    # 13. LOAD BUSINESS AGAIN
    # ==========================================================

    business = None

    if updated.business_id is not None:

        business = (
            db.query(Business)
            .filter(
                Business.id == updated.business_id
            )
            .first()
        )

    # ==========================================================
    # 14. LOAD LOCATION
    # ==========================================================

    location = None

    if updated.location_id is not None:

        location = (
            db.query(Location)
            .filter(
                Location.id == updated.location_id
            )
            .first()
        )

    # ==========================================================
    # 15. LOAD ROLES
    # ==========================================================

    updated_roles = updated.roles or []

    # ==========================================================
    # 16. PRIMARY ROLE
    # ==========================================================

    primary_role = (
        updated_roles[0]
        if updated_roles
        else None
    )

    # ==========================================================
    # 17. RETURN UPDATED USER
    # ==========================================================

    return schemas.UserDisplaySchema(
        # ------------------------------------------------------
        # Basic information
        # ------------------------------------------------------

        id=updated.id,

        username=updated.username,

        full_name=updated.full_name,

        phone=updated.phone,

        # ------------------------------------------------------
        # Business
        # ------------------------------------------------------

        business_id=updated.business_id,

        business_name=(
            business.name
            if business
            else None
        ),

        # ------------------------------------------------------
        # Multiple roles
        # ------------------------------------------------------

        roles=[
            {
                "id": role.id,
                "name": role.name,
                "code": role.code,
            }
            for role in updated_roles
        ],

        # ------------------------------------------------------
        # Backward compatibility
        # ------------------------------------------------------

        role_id=(
            primary_role.id
            if primary_role
            else None
        ),

        role_name=(
            primary_role.name
            if primary_role
            else None
        ),

        role_code=(
            primary_role.code
            if primary_role
            else None
        ),

        # ------------------------------------------------------
        # Location
        # ------------------------------------------------------

        location_id=(
            location.id
            if location
            else None
        ),

        location_name=(
            location.name
            if location
            else None
        ),

        # ------------------------------------------------------
        # Status
        # ------------------------------------------------------

        status=updated.status,

        # ------------------------------------------------------
        # Dates
        # ------------------------------------------------------

        created_at=updated.created_at,

        updated_at=updated.updated_at,
    )



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