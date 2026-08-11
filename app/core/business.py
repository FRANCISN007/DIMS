from fastapi import HTTPException, status

from app.users.schemas import UserDisplaySchema
from app.core.roles import ADMIN, SUPER_ADMIN


def resolve_business_id(
    current_user: UserDisplaySchema,
    business_id: int | None = None,
) -> int:
    """
    Resolve the business ID for the current user.

    Rules:

    Super Admin:
        - Can create/access data for any business.
        - If business_id is supplied, use it.
        - If no business_id is supplied, use the user's
          existing business_id if available.

    Admin:
        - Can only work within their assigned business.
        - Cannot switch to another business.

    Other users:
        - Can only work within their assigned business.
        - Cannot switch to another business.
    """

    # ==================================================
    # GET CURRENT ROLE
    # ==================================================

    role_name = (
        current_user.role_name.strip().lower()
        if current_user.role_name
        else ""
    )

    role_code = (
        current_user.role_code.strip().lower()
        if current_user.role_code
        else ""
    )

    # ==================================================
    # SUPER ADMIN
    # ==================================================

    if (
        role_name == SUPER_ADMIN.lower()
        or role_code == SUPER_ADMIN.lower()
    ):

        # Super Admin can specify any business.
        if business_id is not None:
            return business_id

        # If a business is already selected/attached,
        # use it.
        if current_user.business_id is not None:
            return current_user.business_id

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID is required for Super Admin.",
        )

    # ==================================================
    # ADMIN
    # ==================================================

    if (
        role_name == ADMIN.lower()
        or role_code == ADMIN.lower()
    ):

        if current_user.business_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not assigned to a business.",
            )

        # Admin cannot access another business.
        if (
            business_id is not None
            and business_id != current_user.business_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot access another business.",
            )

        return current_user.business_id

    # ==================================================
    # OTHER USERS
    # ==================================================

    if current_user.business_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a business.",
        )

    # Other users cannot switch businesses.
    if (
        business_id is not None
        and business_id != current_user.business_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot access another business.",
        )

    return current_user.business_id