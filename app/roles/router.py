from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.users.auth import get_current_user
from app.users.schemas import UserDisplaySchema
from app.users.permissions import role_required
from app.core.roles import USER_MANAGEMENT_ROLES
from app.business.models import Business

from app.core.schemas import StatusUpdate
from sqlalchemy import  func, or_


from sqlalchemy import exists

from app.users.models import User
from app.core.roles import SUPER_ADMIN, ADMIN


from app.roles.models import Role
from app.roles import schemas


router = APIRouter()



@router.post(
    "",
    response_model=schemas.RoleDisplay,
    status_code=status.HTTP_201_CREATED,
)
def create_role(
    role: schemas.RoleCreate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    """
    Create a new role.

    Rules
    -----
    • Super Admin can create roles for any business.
    • Business Admin can only create roles for their own business.
    • Role name and code must be unique within a business.
    """

    # --------------------------------------------------
    # Determine Business
    # --------------------------------------------------
    if current_user.role_code == SUPER_ADMIN:

        business_id = role.business_id

        if not business_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business is required.",
            )

    else:
        business_id = current_user.business_id

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

    # --------------------------------------------------
    # Check Duplicate Code
    # --------------------------------------------------
    existing_code = (
        db.query(Role)
        .filter(
            Role.business_id == business_id,
            func.lower(Role.code) == role.code.strip().lower(),
        )
        .first()
    )

    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Role code already exists.",
        )

    # --------------------------------------------------
    # Check Duplicate Name
    # --------------------------------------------------
    existing_name = (
        db.query(Role)
        .filter(
            Role.business_id == business_id,
            func.lower(Role.name) == role.name.strip().lower(),
        )
        .first()
    )

    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Role name already exists.",
        )

    # --------------------------------------------------
    # Create Role
    # --------------------------------------------------
    new_role = Role(
        business_id=business_id,
        name=role.name.strip(),
        code=role.code.strip().upper(),
        description=role.description.strip() if role.description else None,
        status=role.status,
    )

    db.add(new_role)
    db.commit()
    db.refresh(new_role)

    return new_role



@router.get(
    "",
    response_model=list[schemas.RoleDisplay],
)
def list_roles(
    search: str | None = Query(
        default=None,
        description="Search by role name or code",
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="Filter by role status",
    ),
    business_id: int | None = Query(
        default=None,
        description="Business (Super Admin only)",
    ),
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    """
    List roles.

    Super Admin
        • Can view roles for any business
        • Optional business_id filter

    Business Admin
        • Can only view roles for their own business
    """

    query = db.query(Role)

    # --------------------------------------------------
    # Business Restriction
    # --------------------------------------------------
    if current_user.role_code == SUPER_ADMIN:

        if business_id:
            query = query.filter(
                Role.business_id == business_id
            )

    else:

        query = query.filter(
            Role.business_id == current_user.business_id
        )

    # --------------------------------------------------
    # Search
    # --------------------------------------------------
    if search:

        search = search.strip()

        query = query.filter(
            or_(
                Role.name.ilike(f"%{search}%"),
                Role.code.ilike(f"%{search}%"),
            )
        )

    # --------------------------------------------------
    # Status
    # --------------------------------------------------
    if status_filter:

        query = query.filter(
            Role.status == status_filter
        )

    # --------------------------------------------------
    # Return
    # --------------------------------------------------
    return (
        query
        .order_by(
            Role.sort_order.asc(),
            Role.name.asc(),
        )
        .all()
    )

@router.get(
    "/simple",
    response_model=list[schemas.RoleSimple],
)
def list_simple_roles(
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(get_current_user),
):
    """
    List active roles.

    - Super Admin → all active roles
    - Business users → active roles for their business only
    """

    query = db.query(Role).filter(
        Role.status == "active"
    )

    if current_user.business_id is not None:
        query = query.filter(
            Role.business_id == current_user.business_id
        )

    return (
        query.order_by(Role.name.asc())
        .all()
    )


@router.get(
    "/{role_id}",
    response_model=schemas.RoleDisplay,
)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(get_current_user),
):
    """
    Get a single role.

    - Super Admin → any role
    - Business users → only roles in their business
    """

    query = db.query(Role).filter(
        Role.id == role_id
    )

    if current_user.business_id is not None:
        query = query.filter(
            Role.business_id == current_user.business_id
        )

    role = query.first()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    return role


@router.put(
    "/{role_id}",
    response_model=schemas.RoleDisplay,
)
def update_role(
    role_id: int,
    role_data: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):

    print("========== UPDATE ROLE ==========")
    print(role_id)
    """
    Update a role.

    - Super Admin → any role
    - Business users → only their business roles
    """

    query = db.query(Role).filter(
        Role.id == role_id
    )

    if current_user.business_id is not None:
        query = query.filter(
            Role.business_id == current_user.business_id
        )

    role = query.first()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    update_data = role_data.model_dump(exclude_unset=True)

    if "name" in update_data:
        update_data["name"] = update_data["name"].strip()

    if "code" in update_data:
        update_data["code"] = update_data["code"].strip().upper()

        existing = (
            db.query(Role)
            .filter(
                Role.code == update_data["code"],
                Role.id != role.id,
            )
        )

        if current_user.business_id is not None:
            existing = existing.filter(
                Role.business_id == current_user.business_id
            )

        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role code already exists.",
            )

    if "name" in update_data:
        existing = (
            db.query(Role)
            .filter(
                Role.name == update_data["name"],
                Role.id != role.id,
            )
        )

        if current_user.business_id is not None:
            existing = existing.filter(
                Role.business_id == current_user.business_id
            )

        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role name already exists.",
            )

    for key, value in update_data.items():
        setattr(role, key, value)

    db.commit()
    db.refresh(role)

    return role


@router.patch(
    "/{role_id}/status",
    response_model=schemas.RoleDisplay,
)
def change_role_status(
    role_id: int,
    status_data: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    """
    Activate or deactivate a role.

    - Super Admin → any role
    - Business users → only their business roles
    """

    query = db.query(Role).filter(
        Role.id == role_id
    )

    if current_user.business_id is not None:
        query = query.filter(
            Role.business_id == current_user.business_id
        )

    role = query.first()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    role.status = status_data.status

    db.commit()
    db.refresh(role)

    return role


@router.delete(
    "/{role_id}",
    status_code=status.HTTP_200_OK,
)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    """
    Delete a role.

    - Super Admin → any non-system role
    - Business users → only non-system roles in their business
    """

    query = db.query(Role).filter(
        Role.id == role_id
    )

    if current_user.business_id is not None:
        query = query.filter(
            Role.business_id == current_user.business_id
        )

    role = query.first()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    if role.code.lower() in {
        SUPER_ADMIN.lower(),
        ADMIN.lower(),
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System roles cannot be deleted.",
        )

    user_query = db.query(User).filter(
        User.role_id == role.id
    )

    if current_user.business_id is not None:
        user_query = user_query.filter(
            User.business_id == current_user.business_id
        )

    if db.query(user_query.exists()).scalar():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This role has been assigned to one or more users and cannot be deleted.",
        )

    db.delete(role)
    db.commit()

    return {
        "detail": "Role deleted successfully."
    }


