from typing import Iterable

from fastapi import Depends, HTTPException, status

from app.users.auth import get_current_user
from app.users.schemas import UserDisplaySchema
from app.core.roles import ADMIN, SUPER_ADMIN



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

    Role permissions are checked using role_name.

    role_name:
        - admin
        - super_admin
        - manager
        - cashier
        - etc.

    role_code:
        - ADM001
        - ADM111
        - etc.

    If bypass_admin=True, users with ADMIN or SUPER_ADMIN
    automatically pass the permission check.
    """

    # --------------------------------------------------
    # Normalize allowed roles
    # --------------------------------------------------
    allowed_set = {
        role.lower().strip()
        for role in allowed_roles
    }

    def wrapper(
        current_user: UserDisplaySchema = Depends(get_current_user),
    ):
        # --------------------------------------------------
        # Get user's role NAME
        # --------------------------------------------------
        user_role = (
            current_user.role_name.lower().strip()
            if current_user.role_name
            else ""
        )

        # --------------------------------------------------
        # Super Admin / Admin bypass
        # --------------------------------------------------
        if bypass_admin and user_role in {
            ADMIN.lower(),
            SUPER_ADMIN.lower(),
        }:
            return current_user

        # --------------------------------------------------
        # Permission check
        # --------------------------------------------------
        if user_role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions.",
            )

        return current_user

    return wrapper
