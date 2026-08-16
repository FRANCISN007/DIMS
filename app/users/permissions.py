from typing import Iterable

from fastapi import Depends, HTTPException, status

from app.users.auth import get_current_user
from app.users.schemas import UserDisplaySchema
from app.core.roles import ADMIN, SUPER_ADMIN


def role_required(
    allowed_roles: Iterable[str],
    bypass_admin: bool = True,
):
    allowed_set = {
        str(role).lower().strip()
        for role in allowed_roles
    }

    def wrapper(
        current_user: UserDisplaySchema = Depends(
            get_current_user
        ),
    ):

        # ======================================================
        # DEBUG
        # ======================================================

        print("\n================ ROLE DEBUG ================")

        print(
            "CURRENT USER:",
            current_user
        )

        print(
            "roles:",
            getattr(current_user, "roles", None)
        )

        print(
            "role_name:",
            getattr(current_user, "role_name", None)
        )

        print(
            "role_name TYPE:",
            type(
                getattr(current_user, "role_name", None)
            )
        )

        print(
            "role_code:",
            getattr(current_user, "role_code", None)
        )

        print(
            "role_code TYPE:",
            type(
                getattr(current_user, "role_code", None)
            )
        )

        print("============================================\n")

        # ======================================================
        # COLLECT ROLES
        # ======================================================

        user_role_names = set()
        user_role_codes = set()

        roles = getattr(
            current_user,
            "roles",
            []
        ) or []

        for role in roles:

            print(
                "ROLE OBJECT:",
                role
            )

            print(
                "ROLE TYPE:",
                type(role)
            )

            name = getattr(
                role,
                "name",
                None
            )

            code = getattr(
                role,
                "code",
                None
            )

            print(
                "ROLE NAME:",
                name,
                "TYPE:",
                type(name)
            )

            print(
                "ROLE CODE:",
                code,
                "TYPE:",
                type(code)
            )

            if isinstance(name, str):
                user_role_names.add(
                    name.lower().strip()
                )

            if isinstance(code, str):
                user_role_codes.add(
                    code.lower().strip()
                )

        # ======================================================
        # LEGACY ROLE NAME
        # ======================================================

        role_name = getattr(
            current_user,
            "role_name",
            None
        )

        if isinstance(role_name, str):

            user_role_names.add(
                role_name.lower().strip()
            )

        elif role_name is not None:

            # Handle RoleSimple safely

            name = getattr(
                role_name,
                "name",
                None
            )

            code = getattr(
                role_name,
                "code",
                None
            )

            if isinstance(name, str):

                user_role_names.add(
                    name.lower().strip()
                )

            if isinstance(code, str):

                user_role_codes.add(
                    code.lower().strip()
                )

        # ======================================================
        # LEGACY ROLE CODE
        # ======================================================

        role_code = getattr(
            current_user,
            "role_code",
            None
        )

        if isinstance(role_code, str):

            user_role_codes.add(
                role_code.lower().strip()
            )

        elif role_code is not None:

            code = getattr(
                role_code,
                "code",
                None
            )

            name = getattr(
                role_code,
                "name",
                None
            )

            if isinstance(code, str):

                user_role_codes.add(
                    code.lower().strip()
                )

            if isinstance(name, str):

                user_role_names.add(
                    name.lower().strip()
                )

        # ======================================================
        # ADMIN BYPASS
        # ======================================================

        if bypass_admin:

            if (
                ADMIN.lower().strip()
                in user_role_names
                or
                SUPER_ADMIN.lower().strip()
                in user_role_names
            ):
                return current_user

            if (
                ADMIN.lower().strip()
                in user_role_codes
                or
                SUPER_ADMIN.lower().strip()
                in user_role_codes
            ):
                return current_user

        # ======================================================
        # PERMISSION
        # ======================================================

        if not (
            user_role_names.intersection(
                allowed_set
            )
            or
            user_role_codes.intersection(
                allowed_set
            )
        ):

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions.",
            )

        return current_user

    return wrapper