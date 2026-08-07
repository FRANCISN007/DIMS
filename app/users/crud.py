from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.users.models import User
from app.users import schemas as user_schema


# ==========================================================
# CREATE USER
# ==========================================================
def create_user(
    db: Session,
    user: user_schema.UserCreate,
    hashed_password: str,
    business_id: Optional[int] = None,
):

    new_user = User(
        username=user.username.strip().lower(),
        full_name=user.full_name,
        phone=user.phone,
        hashed_password=hashed_password,
        business_id=business_id,
        role_id=user.role_id,
        location_id=user.location_id,
        status="active",
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# ==========================================================
# GET USER BY USERNAME
# ==========================================================
def get_user_by_username(
    db: Session,
    username: str,
):

    return (
        db.query(User)
        .options(
            joinedload(User.business),
            joinedload(User.role),
            joinedload(User.location),
        )
        .filter(User.username == username.strip().lower())
        .first()
    )


# ==========================================================
# LIST ALL USERS
# ==========================================================
def get_all_users(
    db: Session,
    skip: int = 0,
    limit: int = 50,
):

    users = (
        db.query(User)
        .options(
            joinedload(User.business),
            joinedload(User.role),
            joinedload(User.location),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        user_schema.UserDisplaySchema(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            phone=user.phone,

            business_id=user.business_id,
            business_name=user.business.name if user.business else None,

            role_id=user.role_id,
            role_name=user.role.name if user.role else None,
            role_code=user.role.code if user.role else None,

            location_id=user.location_id,
            location_name=user.location.name if user.location else None,

            status=user.status,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        for user in users
    ]


# ==========================================================
# LIST USERS BY BUSINESS
# ==========================================================
def get_users_by_business(
    db: Session,
    business_id: int,
    skip: int = 0,
    limit: int = 50,
):

    users = (
        db.query(User)
        .options(
            joinedload(User.business),
            joinedload(User.role),
            joinedload(User.location),
        )
        .filter(User.business_id == business_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        user_schema.UserDisplaySchema(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            phone=user.phone,

            business_id=user.business_id,
            business_name=user.business.name if user.business else None,

            role_id=user.role_id,
            role_name=user.role.name if user.role else None,
            role_code=user.role.code if user.role else None,

            location_id=user.location_id,
            location_name=user.location.name if user.location else None,

            status=user.status,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        for user in users
    ]


# ==========================================================
# UPDATE USER
# ==========================================================
def update_user(
    db: Session,
    username: str,
    updated_user: user_schema.UserUpdate,
    hashed_password: Optional[str] = None,
):

    user = (
        db.query(User)
        .filter(User.username == username.strip().lower())
        .first()
    )

    if not user:
        return None

    if updated_user.full_name is not None:
        user.full_name = updated_user.full_name

    if updated_user.phone is not None:
        user.phone = updated_user.phone

    if updated_user.role_id is not None:
        user.role_id = updated_user.role_id

    if updated_user.location_id is not None:
        user.location_id = updated_user.location_id

    if updated_user.status is not None:
        user.status = updated_user.status

    if hashed_password:
        user.hashed_password = hashed_password

    db.commit()
    db.refresh(user)

    return user


# ==========================================================
# DELETE USER
# ==========================================================
def delete_user_by_username(
    db: Session,
    username: str,
):

    user = (
        db.query(User)
        .filter(User.username == username.strip().lower())
        .first()
    )

    if not user:
        return False

    db.delete(user)
    db.commit()

    return True