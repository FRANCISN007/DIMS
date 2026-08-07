from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy import func

from app.core.roles import ADMIN, SUPER_ADMIN


from app.database import get_db
from app.users import crud, schemas as user_schemas
from app.business.models import Business  # New import for business info
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def authenticate_user(db: Session, username: str, password: str):
    user = crud.get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # --------------------------------------------------
    # Decode JWT
    # --------------------------------------------------
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        username = payload.get("sub")
        token_business_id = payload.get("business_id")

        if username is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    # --------------------------------------------------
    # Load User
    # --------------------------------------------------
    user = crud.get_user_by_username(
        db,
        username.strip().lower(),
    )

    if not user:
        raise credentials_exception

    # --------------------------------------------------
    # User must be active
    # --------------------------------------------------
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    # --------------------------------------------------
    # Super Admin
    # --------------------------------------------------
    is_super_admin = user.business_id is None

    business = None

    if not is_super_admin:

        if token_business_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid authentication token.",
            )

        if int(token_business_id) != user.business_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid business access.",
            )

        business = (
            db.query(Business)
            .filter(Business.id == user.business_id)
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
    # Build Current User
    # --------------------------------------------------
    return user_schemas.UserDisplaySchema(
    id=user.id,
    username=user.username,
    full_name=user.full_name,
    phone=user.phone,

    business_id=user.business_id,
    business_name=business.name if business else None,

    role_id=user.role.id if user.role else None,
    role_name=(
        "Super Administrator"
        if is_super_admin
        else (user.role.name if user.role else None)
    ),
    role_code=(
        SUPER_ADMIN
        if is_super_admin
        else (user.role.code if user.role else None)
    ),

    location_id=user.location.id if user.location else None,
    location_name=user.location.name if user.location else None,

    status=user.status,

    created_at=user.created_at,
    updated_at=user.updated_at,
)