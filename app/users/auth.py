from datetime import datetime, timedelta, timezone
from typing import Optional
import os

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database import get_db
from app.users import crud
from app.users import schemas as user_schemas
from app.business.models import Business
from app.core.roles import SUPER_ADMIN

load_dotenv()


# ==========================================================
# CONFIGURATION
# ==========================================================

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY environment variable is not configured."
    )

ALGORITHM = os.getenv("ALGORITHM", "HS256")

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "60"
    )
)


# ==========================================================
# SECURITY
# ==========================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/users/token"
)


# ==========================================================
# PASSWORD
# ==========================================================

def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:

    try:
        return pwd_context.verify(
            plain_password,
            hashed_password,
        )

    except Exception:
        return False


def get_password_hash(
    password: str,
) -> str:

    return pwd_context.hash(password)


# ==========================================================
# CREATE ACCESS TOKEN
# ==========================================================

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
):

    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = (
            datetime.now(timezone.utc)
            + timedelta(
                minutes=ACCESS_TOKEN_EXPIRE_MINUTES
            )
        )

    to_encode["exp"] = expire

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


# ==========================================================
# AUTHENTICATE USER
# ==========================================================

def authenticate_user(
    db: Session,
    username: str,
    password: str,
):

    username = username.strip().lower()

    user = crud.get_user_by_username(
        db,
        username,
    )

    if not user:
        return None

    if not user.hashed_password:
        return None

    if not verify_password(
        password,
        user.hashed_password,
    ):
        return None

    return user


# ==========================================================
# CURRENT USER
# ==========================================================

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials.",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    # ======================================================
    # DECODE TOKEN
    # ======================================================

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

    except JWTError as exc:
        print(
            "JWT DECODE ERROR:",
            repr(exc)
        )
        raise credentials_exception

    # ======================================================
    # TOKEN USERNAME
    # ======================================================

    username = payload.get("sub")

    if not username:
        print(
            "JWT ERROR: Missing sub claim"
        )
        raise credentials_exception

    username = str(username).strip().lower()

    # ======================================================
    # TOKEN BUSINESS
    # ======================================================

    token_business_id = payload.get(
        "business_id"
    )

    # ======================================================
    # LOAD USER
    # ======================================================

    user = crud.get_user_by_username(
        db,
        username,
    )

    if not user:
        print(
            f"JWT ERROR: User '{username}' not found"
        )
        raise credentials_exception

    # ======================================================
    # USER STATUS
    # ======================================================

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    # ======================================================
    # DETERMINE SUPER ADMIN
    # ======================================================

    is_super_admin = (
        user.business_id is None
    )

    business = None

    # ======================================================
    # SUPER ADMIN
    # ======================================================

    if is_super_admin:

        business = None

    # ======================================================
    # BUSINESS USER
    # ======================================================

    else:

        if token_business_id is None:
            print(
                "JWT ERROR: Business user has no business_id in token"
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid authentication token.",
            )

        try:
            token_business_id = int(
                token_business_id
            )

        except (
            TypeError,
            ValueError,
        ):

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid business access.",
            )

        # --------------------------------------------------
        # Verify token business matches database
        # --------------------------------------------------

        if token_business_id != user.business_id:

            print(
                "JWT BUSINESS MISMATCH:",
                {
                    "token_business_id":
                        token_business_id,

                    "user_business_id":
                        user.business_id,

                    "username":
                        user.username,
                }
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid business access.",
            )

        # --------------------------------------------------
        # Load Business
        # --------------------------------------------------

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

        # --------------------------------------------------
        # License
        # --------------------------------------------------

        if not business.is_license_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Business license is inactive.",
            )

    # ======================================================
    # ROLES
    # ======================================================

    roles = user.roles or []

    if is_super_admin:

        role_id = None

        role_name = "Super Administrator"

        role_code = SUPER_ADMIN

        role_list = []

    else:

        role_list = [
            {
                "id": role.id,
                "name": role.name,
                "code": role.code,
            }
            for role in roles
        ]

        # --------------------------------------------------
        # Primary role for backward compatibility
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

        # ------------------------------------------------------
        # SUPER ADMIN
        # ------------------------------------------------------

        if is_super_admin:

            role_id = None
            role_name = "Super Administrator"
            role_code = SUPER_ADMIN

            role_list = []

        # ------------------------------------------------------
        # BUSINESS USER
        # ------------------------------------------------------

        else:

            role_list = [
                {
                    "id": role.id,
                    "name": role.name,
                    "code": role.code,
                }
                for role in roles
            ]

            # --------------------------------------------------
            # Primary role for backward compatibility
            # --------------------------------------------------

            primary_role = roles[0] if roles else None

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

    location = user.location

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
    # RETURN CURRENT USER
    # ======================================================

    return user_schemas.UserDisplaySchema(

    id=user.id,

    username=user.username,

    full_name=user.full_name,

    phone=user.phone,

    business_id=user.business_id,

    business_name=(
        business.name
        if business
        else None
    ),

    # Multiple roles
    roles=role_list,

    # Backward compatibility
    role_id=role_id,
    role_name=role_name,
    role_code=role_code,

    location_id=(
        user.location.id
        if user.location
        else None
    ),

    location_name=(
        user.location.name
        if user.location
        else None
    ),

    status=user.status,

    created_at=user.created_at,

    updated_at=user.updated_at,
)