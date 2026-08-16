from fastapi import HTTPException, status

from app.users.schemas import UserDisplaySchema
from app.core.roles import ADMIN, SUPER_ADMIN


def _normalise_role_value(value) -> str | None:
    """
    Safely convert a role value into a lowercase string.

    Supports:
        - normal strings
        - RoleSimple objects
        - objects with name/code attributes
    """

    if value is None:
        return None

    # Normal string
    if isinstance(value, str):
        value = value.strip().lower()

        return value if value else None

    # RoleSimple or similar object
    name = getattr(value, "name", None)

    if isinstance(name, str):
        name = name.strip().lower()

        if name:
            return name

    code = getattr(value, "code", None)

    if isinstance(code, str):
        code = code.strip().lower()

        if code:
            return code

    return None


def resolve_business_id(
    current_user: UserDisplaySchema,
    business_id: int | None = None,
) -> int:

    # ==========================================================
    # 1. COLLECT USER ROLES
    # ==========================================================

    user_roles = set()

    roles = getattr(
        current_user,
        "roles",
        None
    ) or []

    for role in roles:

        role_name = _normalise_role_value(
            getattr(role, "name", None)
        )

        role_code = _normalise_role_value(
            getattr(role, "code", None)
        )

        if role_name:
            user_roles.add(role_name)

        if role_code:
            user_roles.add(role_code)

    # ==========================================================
    # 2. BACKWARD COMPATIBILITY
    # ==========================================================

    legacy_role_name = _normalise_role_value(
        getattr(
            current_user,
            "role_name",
            None
        )
    )

    if legacy_role_name:
        user_roles.add(
            legacy_role_name
        )

    legacy_role_code = _normalise_role_value(
        getattr(
            current_user,
            "role_code",
            None
        )
    )

    if legacy_role_code:
        user_roles.add(
            legacy_role_code
        )

    # ==========================================================
    # 3. DEBUG
    # ==========================================================

    print("\n========== BUSINESS RESOLUTION ==========")
    print("USER ID:", getattr(current_user, "id", None))
    print("BUSINESS ID:", getattr(current_user, "business_id", None))
    print("USER ROLES:", user_roles)
    print("REQUESTED BUSINESS ID:", business_id)
    print("==========================================\n")

    # ==========================================================
    # 4. SUPER ADMIN
    # ==========================================================

    super_admin_value = _normalise_role_value(
        SUPER_ADMIN
    )

    is_super_admin = (
        super_admin_value in user_roles
        or "super administrator" in user_roles
        or "super admin" in user_roles
    )

    if is_super_admin:

        # Super Admin can select any business
        if business_id is not None:
            return int(business_id)

        # If a business is already selected
        if current_user.business_id is not None:
            return int(
                current_user.business_id
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Business ID is required for Super Admin."
            ),
        )

    # ==========================================================
    # 5. ADMIN
    # ==========================================================

    admin_value = _normalise_role_value(
        ADMIN
    )

    is_admin = (
        admin_value in user_roles
        or "admin" in user_roles
    )

    if is_admin:

        if current_user.business_id is None:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "User is not assigned to a business."
                ),
            )

        if (
            business_id is not None
            and int(business_id)
            != int(current_user.business_id)
        ):

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You cannot access another business."
                ),
            )

        return int(
            current_user.business_id
        )

    # ==========================================================
    # 6. OTHER USERS
    # ==========================================================

    if current_user.business_id is None:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "User is not assigned to a business."
            ),
        )

    if (
        business_id is not None
        and int(business_id)
        != int(current_user.business_id)
    ):

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You cannot access another business."
            ),
        )

    return int(
        current_user.business_id
    )