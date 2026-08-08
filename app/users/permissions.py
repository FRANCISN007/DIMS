from typing import Iterable

from fastapi import Depends, HTTPException, status

from app.users.auth import get_current_user
from app.users.schemas import UserDisplaySchema
from app.core.roles import ADMIN, SUPER_ADMIN


def role_required(
    allowed_roles: Iterable[str],
    bypass_admin: bool = True,
):
    """
    Ensures the current user has one of the allowed roles.

    Supports both role_name and role_code.

    Super Admin / Admin bypass permission checking when
    bypass_admin=True.
    """

    allowed_set = {
        role.lower().strip()
        for role in allowed_roles
    }

    def wrapper(
        current_user: UserDisplaySchema = Depends(get_current_user),
    ):

        # --------------------------------------------------
        # Normalize role name and role code
        # --------------------------------------------------

        role_name = (
            current_user.role_name.lower().strip()
            if current_user.role_name
            else ""
        )

        role_code = (
            current_user.role_code.lower().strip()
            if current_user.role_code
            else ""
        )

        # --------------------------------------------------
        # Super Admin / Admin bypass
        # --------------------------------------------------

        if bypass_admin:

            if role_name in {
                ADMIN.lower(),
                SUPER_ADMIN.lower(),
            }:
                return current_user

            if role_code in {
                ADMIN.lower(),
                SUPER_ADMIN.lower(),
            }:
                return current_user

        # --------------------------------------------------
        # Permission check
        # --------------------------------------------------

        if (
            role_name not in allowed_set
            and role_code not in allowed_set
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions.",
            )

        return current_user

    return wrapper