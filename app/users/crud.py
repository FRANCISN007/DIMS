
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.users.models import User
from app.users import schemas as user_schema


# ==========================================================
# CREATE USER
# ==========================================================

# ==========================================================
# CREATE USER
# ==========================================================

def create_user(
    db: Session,
    user: user_schema.UserCreate,
    hashed_password: str,
    business_id: Optional[int] = None,
):
    """
    Create a new user.

    Roles are handled through the User.roles relationship
    and the user_roles association table.

    User status is independent from role status.
    """

    new_user = User(
        username=user.username.strip().lower(),

        full_name=user.full_name.strip(),

        phone=(
            user.phone.strip()
            if user.phone
            else None
        ),

        hashed_password=hashed_password,

        business_id=business_id,

        location_id=user.location_id,

        # IMPORTANT:
        # User status belongs to the USER,
        # not the role.
        status=user.status,
    )

    db.add(new_user)

    # ------------------------------------------------------
    # Assign multiple roles
    # ------------------------------------------------------

    if user.role_ids:

        from app.roles.models import Role

        roles = (
            db.query(Role)
            .filter(
                Role.id.in_(user.role_ids)
            )
            .all()
        )

        new_user.roles = roles

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
    """
    Get one user together with:

    - Business
    - Multiple roles
    - Location
    """

    return (
        db.query(User)
        .options(
            joinedload(User.business),
            joinedload(User.roles),
            joinedload(User.location),
        )
        .filter(
            User.username == username.strip().lower()
        )
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
    """
    Get all users.

    Used by Super Admin.
    """

    users = (
        db.query(User)
        .options(
            joinedload(User.business),
            joinedload(User.roles),
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
            business_name=(
                user.business.name
                if user.business
                else None
            ),

            roles=[
                user_schema.RoleSimple(
                    id=role.id,
                    name=role.name,
                    code=role.code,
                )
                for role in user.roles
            ],

            location_id=user.location_id,
            location_name=(
                user.location.name
                if user.location
                else None
            ),

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
    """
    Get all users belonging to one business.
    """

    users = (
        db.query(User)
        .options(
            joinedload(User.business),
            joinedload(User.roles),
            joinedload(User.location),
        )
        .filter(
            User.business_id == business_id
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
            business_name=(
                user.business.name
                if user.business
                else None
            ),

            roles=[
                user_schema.RoleSimple(
                    id=role.id,
                    name=role.name,
                    code=role.code,
                )
                for role in user.roles
            ],

            location_id=user.location_id,
            location_name=(
                user.location.name
                if user.location
                else None
            ),

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
    """
    Update an existing user.

    Supports:

    - Basic information
    - Multiple roles
    - Location
    - Password
    - Status

    IMPORTANT:
    location_id can intentionally be set to None
    so that an existing location can be removed.
    """

    user = (
        db.query(User)
        .options(
            joinedload(User.roles),
        )
        .filter(
            User.username == username.strip().lower()
        )
        .first()
    )

    if not user:
        return None

    # ======================================================
    # BASIC INFORMATION
    # ======================================================

    if updated_user.full_name is not None:
        user.full_name = (
            updated_user.full_name.strip()
        )

    if updated_user.phone is not None:
        user.phone = (
            updated_user.phone.strip()
            if updated_user.phone
            else None
        )

    # ======================================================
    # MULTIPLE ROLES
    # ======================================================

    if updated_user.role_ids is not None:

        from app.roles.models import Role

        roles = (
            db.query(Role)
            .filter(
                Role.id.in_(
                    updated_user.role_ids
                )
            )
            .all()
        )

        user.roles = roles

    # ======================================================
    # LOCATION
    # ======================================================

    # This intentionally checks for None differently from
    # the old code.
    #
    # If the schema contains location_id, the value should
    # be applied even when it is None so an existing location
    # can be cleared.
    if "location_id" in updated_user.model_fields_set:
        user.location_id = updated_user.location_id

    # ======================================================
    # STATUS
    # ======================================================

    if updated_user.status is not None:
        user.status = updated_user.status

    # ======================================================
    # PASSWORD
    # ======================================================

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
    """
    Delete a user.

    The user_roles association records are automatically
    removed because the association table uses:

        ondelete="CASCADE"
    """

    user = (
        db.query(User)
        .filter(
            User.username == username.strip().lower()
        )
        .first()
    )

    if not user:
        return False

    db.delete(user)
    db.commit()

    return True
