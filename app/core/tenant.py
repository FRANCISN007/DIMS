from contextvars import ContextVar
from typing import Optional

from fastapi import HTTPException

from app.core.roles import SUPER_ADMIN


# ==========================================================
# CONTEXTVAR
# ==========================================================

_current_business_id: ContextVar[
    Optional[int]
] = ContextVar(
    "current_business_id",
    default=None
)


def set_current_business(
    business_id: Optional[int]
):
    """Set the current business ID for the request."""

    _current_business_id.set(
        business_id
    )


def get_current_business() -> Optional[int]:
    """Get the current business ID for the request."""

    return _current_business_id.get()


def resolve_business_id(
    current_user,
    business_id: Optional[int] = None,
) -> int:
    """
    Determine the effective business ID.

    Supports:
        - RoleSimple objects
        - string roles
        - multiple roles

    Rules:
        Super Admin:
            - Must provide business_id when no business
              is already assigned.

        Normal users:
            - Always use their assigned business_id.
            - Cannot switch businesses.
    """

    # ======================================================
    # 1. COLLECT USER ROLES
    # ======================================================

    roles = set()

    user_roles = getattr(
        current_user,
        "roles",
        None
    ) or []

    # ------------------------------------------------------
    # Multiple RoleSimple objects
    # ------------------------------------------------------

    if isinstance(
        user_roles,
        (list, tuple, set)
    ):

        for role in user_roles:

            # RoleSimple.name
            role_name = getattr(
                role,
                "name",
                None
            )

            if isinstance(
                role_name,
                str
            ):

                roles.add(
                    role_name.strip().lower()
                )

            # RoleSimple.code
            role_code = getattr(
                role,
                "code",
                None
            )

            if isinstance(
                role_code,
                str
            ):

                roles.add(
                    role_code.strip().lower()
                )

            # In case a plain string is inside the list
            if isinstance(
                role,
                str
            ):

                roles.add(
                    role.strip().lower()
                )

    # ------------------------------------------------------
    # Single string containing comma-separated roles
    # ------------------------------------------------------

    elif isinstance(
        user_roles,
        str
    ):

        for role in user_roles.split(","):

            if isinstance(
                role,
                str
            ):

                role = role.strip().lower()

                if role:
                    roles.add(role)

    # ======================================================
    # 2. LEGACY role_name
    # ======================================================

    role_name = getattr(
        current_user,
        "role_name",
        None
    )

    if isinstance(
        role_name,
        str
    ):

        roles.add(
            role_name.strip().lower()
        )

    else:

        role_name_value = getattr(
            role_name,
            "name",
            None
        )

        if isinstance(
            role_name_value,
            str
        ):

            roles.add(
                role_name_value.strip().lower()
            )

        role_code_value = getattr(
            role_name,
            "code",
            None
        )

        if isinstance(
            role_code_value,
            str
        ):

            roles.add(
                role_code_value.strip().lower()
            )

    # ======================================================
    # 3. LEGACY role_code
    # ======================================================

    role_code = getattr(
        current_user,
        "role_code",
        None
    )

    if isinstance(
        role_code,
        str
    ):

        roles.add(
            role_code.strip().lower()
        )

    else:

        role_code_value = getattr(
            role_code,
            "code",
            None
        )

        if isinstance(
            role_code_value,
            str
        ):

            roles.add(
                role_code_value.strip().lower()
            )

        role_name_value = getattr(
            role_code,
            "name",
            None
        )

        if isinstance(
            role_name_value,
            str
        ):

            roles.add(
                role_name_value.strip().lower()
            )

    # ======================================================
    # DEBUG
    # ======================================================

    print("\n========== BUSINESS RESOLUTION ==========")
    print(
        "USER:",
        getattr(
            current_user,
            "username",
            None
        )
    )
    print(
        "BUSINESS:",
        getattr(
            current_user,
            "business_id",
            None
        )
    )
    print(
        "ROLES:",
        roles
    )
    print(
        "REQUESTED BUSINESS:",
        business_id
    )
    print("==========================================\n")

    # ======================================================
    # 4. SUPER ADMIN
    # ======================================================

    if (
        SUPER_ADMIN.lower()
        in roles
    ):

        if business_id is None:

            if current_user.business_id is not None:

                return int(
                    current_user.business_id
                )

            raise HTTPException(
                status_code=400,
                detail=(
                    "Business ID is required "
                    "for Super Admin."
                )
            )

        return int(
            business_id
        )

    # ======================================================
    # 5. NORMAL USER
    # ======================================================

    if current_user.business_id is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "User is not assigned "
                "to a business."
            )
        )

    # ======================================================
    # 6. PREVENT BUSINESS SWITCHING
    # ======================================================

    if (
        business_id is not None
        and int(business_id)
        != int(current_user.business_id)
    ):

        raise HTTPException(
            status_code=403,
            detail=(
                "You cannot access another business."
            )
        )

    return int(
        current_user.business_id
    )