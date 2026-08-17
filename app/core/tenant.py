# app/core/tenant.py

from contextvars import ContextVar
from typing import Optional

from fastapi import HTTPException, status

from app.core.roles import SUPER_ADMIN


# ==========================================================
# CURRENT BUSINESS / TENANT CONTEXT
# ==========================================================

_current_business_id: ContextVar[
    Optional[int]
] = ContextVar(
    "current_business_id",
    default=None,
)


# ==========================================================
# SET CURRENT BUSINESS
# ==========================================================

def set_current_business(
    business_id: Optional[int],
):
    """
    Set the current business/tenant for the request.
    """

    _current_business_id.set(
        business_id
    )


# ==========================================================
# GET CURRENT BUSINESS
# ==========================================================

def get_current_business() -> Optional[int]:
    """
    Get the current business/tenant for the request.
    """

    return _current_business_id.get()


# ==========================================================
# RESOLVE BUSINESS / TENANT
# ==========================================================

def resolve_business_id(
    current_user,
    business_id: Optional[int] = None,
) -> int:
    """
    Determine the effective business ID.

    Super Admin:
        Can select a business.

    Normal users:
        Always use their assigned business.

        They cannot switch businesses.
    """

    # ======================================================
    # 1. COLLECT USER ROLES
    # ======================================================

    roles = set()

    user_roles = getattr(
        current_user,
        "roles",
        None,
    ) or []

    # ------------------------------------------------------
    # Multiple RoleSimple objects
    # ------------------------------------------------------

    if isinstance(
        user_roles,
        (list, tuple, set),
    ):

        for role in user_roles:

            # ----------------------------------------------
            # Plain string
            # ----------------------------------------------

            if isinstance(
                role,
                str,
            ):

                role_value = (
                    role
                    .strip()
                    .lower()
                    .replace(" ", "_")
                )

                if role_value:
                    roles.add(
                        role_value
                    )

                continue

            # ----------------------------------------------
            # RoleSimple.code
            # ----------------------------------------------

            role_code = getattr(
                role,
                "code",
                None,
            )

            if isinstance(
                role_code,
                str,
            ):

                roles.add(
                    role_code
                    .strip()
                    .lower()
                    .replace(" ", "_")
                )

            # ----------------------------------------------
            # RoleSimple.name
            # ----------------------------------------------

            role_name = getattr(
                role,
                "name",
                None,
            )

            if isinstance(
                role_name,
                str,
            ):

                roles.add(
                    role_name
                    .strip()
                    .lower()
                    .replace(" ", "_")
                )

    # ------------------------------------------------------
    # Single string
    # ------------------------------------------------------

    elif isinstance(
        user_roles,
        str,
    ):

        for role in user_roles.split(","):

            role = (
                role
                .strip()
                .lower()
                .replace(" ", "_")
            )

            if role:
                roles.add(role)

    # ======================================================
    # 2. LEGACY ROLE NAME
    # ======================================================

    role_name = getattr(
        current_user,
        "role_name",
        None,
    )

    if isinstance(
        role_name,
        str,
    ):

        roles.add(
            role_name
            .strip()
            .lower()
            .replace(" ", "_")
        )

    # ======================================================
    # 3. LEGACY ROLE CODE
    # ======================================================

    role_code = getattr(
        current_user,
        "role_code",
        None,
    )

    if isinstance(
        role_code,
        str,
    ):

        roles.add(
            role_code
            .strip()
            .lower()
            .replace(" ", "_")
        )

    # ======================================================
    # 4. DEBUG
    # ======================================================

    print(
        "\n========== TENANT RESOLUTION =========="
    )

    print(
        "USER:",
        getattr(
            current_user,
            "username",
            None,
        ),
    )

    print(
        "BUSINESS:",
        getattr(
            current_user,
            "business_id",
            None,
        ),
    )

    print(
        "LOCATION:",
        getattr(
            current_user,
            "location_id",
            None,
        ),
    )

    print(
        "ROLES:",
        roles,
    )

    print(
        "REQUESTED BUSINESS:",
        business_id,
    )

    print(
        "CURRENT TENANT:",
        get_current_business(),
    )

    print(
        "=======================================\n"
    )

    # ======================================================
    # 5. SUPER ADMIN
    # ======================================================

    super_admin_code = (
        SUPER_ADMIN
        .strip()
        .lower()
        .replace(" ", "_")
    )

    if (
        super_admin_code in roles
        or "super_admin" in roles
        or "super_administrator" in roles
    ):

        # --------------------------------------------------
        # Explicit business selected
        # --------------------------------------------------

        if business_id is not None:

            effective_business_id = int(
                business_id
            )

        # --------------------------------------------------
        # Already assigned business
        # --------------------------------------------------

        elif current_user.business_id is not None:

            effective_business_id = int(
                current_user.business_id
            )

        else:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Business ID is required "
                    "for Super Admin."
                ),
            )

        # --------------------------------------------------
        # SET TENANT CONTEXT
        # --------------------------------------------------

        set_current_business(
            effective_business_id
        )

        return effective_business_id

    # ======================================================
    # 6. NORMAL USER MUST HAVE BUSINESS
    # ======================================================

    if current_user.business_id is None:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "User is not assigned "
                "to a business."
            ),
        )

    user_business_id = int(
        current_user.business_id
    )

    # ======================================================
    # 7. PREVENT BUSINESS SWITCHING
    # ======================================================

    if (
        business_id is not None
        and int(business_id)
        != user_business_id
    ):

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You cannot access another business."
            ),
        )

    # ======================================================
    # 8. SET TENANT CONTEXT
    # ======================================================

    set_current_business(
        user_business_id
    )

    return user_business_id