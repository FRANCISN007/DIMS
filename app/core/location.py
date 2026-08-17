# app/core/location.py

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.locations.models import Location


# ==========================================================
# NORMALIZE ROLE
# ==========================================================

def _normalize_role(value) -> Optional[str]:

    if value is None:
        return None

    # ------------------------------------------
    # String
    # ------------------------------------------

    if isinstance(value, str):

        value = (
            value
            .strip()
            .lower()
            .replace("-", "_")
            .replace(" ", "_")
        )

        return value or None

    # ------------------------------------------
    # Object with code
    # ------------------------------------------

    code = getattr(
        value,
        "code",
        None,
    )

    if isinstance(code, str):

        code = (
            code
            .strip()
            .lower()
            .replace("-", "_")
            .replace(" ", "_")
        )

        if code:
            return code

    # ------------------------------------------
    # Object with name
    # ------------------------------------------

    name = getattr(
        value,
        "name",
        None,
    )

    if isinstance(name, str):

        name = (
            name
            .strip()
            .lower()
            .replace("-", "_")
            .replace(" ", "_")
        )

        if name:
            return name

    return None


# ==========================================================
# GET ALL USER ROLES
# ==========================================================

def get_user_roles(current_user):

    roles = set()

    # ======================================================
    # 1. current_user.roles
    # ======================================================

    user_roles = getattr(
        current_user,
        "roles",
        None,
    ) or []

    if isinstance(
        user_roles,
        (list, tuple, set),
    ):

        for role in user_roles:

            normalized = _normalize_role(
                role
            )

            if normalized:
                roles.add(normalized)

    elif isinstance(
        user_roles,
        str,
    ):

        for role in user_roles.split(","):

            normalized = _normalize_role(
                role
            )

            if normalized:
                roles.add(normalized)

    # ======================================================
    # 2. role_name
    # ======================================================

    role_name = _normalize_role(
        getattr(
            current_user,
            "role_name",
            None,
        )
    )

    if role_name:
        roles.add(role_name)

    # ======================================================
    # 3. role_code
    # ======================================================

    role_code = _normalize_role(
        getattr(
            current_user,
            "role_code",
            None,
        )
    )

    if role_code:
        roles.add(role_code)

    return roles


# ==========================================================
# IS CAMP BOSS
# ==========================================================

def is_camp_boss(
    current_user,
) -> bool:

    roles = get_user_roles(
        current_user
    )

    print(
        "\n========== LOCATION ROLE CHECK =========="
    )

    print(
        "USERNAME:",
        getattr(
            current_user,
            "username",
            None,
        )
    )

    print(
        "USER LOCATION:",
        getattr(
            current_user,
            "location_id",
            None,
        )
    )

    print(
        "ROLES FOUND:",
        roles,
    )

    print(
        "IS CAMP BOSS:",
        "camp_boss" in roles,
    )

    print(
        "=========================================\n"
    )

    return (
        "camp_boss" in roles
        or "campboss" in roles
    )


# ==========================================================
# GET USER LOCATION
# ==========================================================

def get_user_location_id(
    current_user,
) -> Optional[int]:

    return getattr(
        current_user,
        "location_id",
        None,
    )


# ==========================================================
# RESOLVE LOCATION FOR CURRENT USER
# ==========================================================

def resolve_location_id(
    current_user,
    requested_location_id: Optional[int] = None,
):
    """
    Resolve and validate the location requested by the user.

    Camp Boss:
        - Must have an assigned location.
        - If a location is supplied, it MUST match
          the Camp Boss's assigned location.
        - Never silently changes the requested location.
        - Different location = 403 Forbidden.

    Other users:
        - Requested location is respected.
    """

    # ======================================================
    # CAMP BOSS
    # ======================================================

    if is_camp_boss(current_user):

        user_location_id = get_user_location_id(
            current_user
        )

        # --------------------------------------------------
        # Camp Boss must have a location
        # --------------------------------------------------

        if user_location_id is None:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Camp Boss is not assigned "
                    "to a location."
                ),
            )

        # --------------------------------------------------
        # If frontend supplied a location, it MUST match
        # --------------------------------------------------

        if (
            requested_location_id is not None
            and int(requested_location_id)
            != int(user_location_id)
        ):

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You cannot create catering usage "
                    "for another location."
                ),
            )

        # --------------------------------------------------
        # No location supplied
        # --------------------------------------------------

        return user_location_id

    # ======================================================
    # OTHER USERS
    # ======================================================

    return requested_location_id

# ==========================================================
# VALIDATE LOCATION ACCESS
# ==========================================================

def validate_location_access(
    db: Session,
    current_user,
    location_id: int,
    business_id: int,
):

    # ======================================================
    # LOCATION MUST BELONG TO BUSINESS
    # ======================================================

    location = (
        db.query(Location)
        .filter(
            Location.id == location_id,
            Location.business_id == business_id,
            Location.status == "active",
        )
        .first()
    )

    if not location:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found or inactive.",
        )

    # ======================================================
    # CAMP BOSS
    # ======================================================

    if is_camp_boss(
        current_user
    ):

        user_location_id = (
            get_user_location_id(
                current_user
            )
        )

        if user_location_id is None:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Camp Boss is not assigned "
                    "to a location."
                ),
            )

        if int(user_location_id) != int(location_id):

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have access "
                    "to this location."
                ),
            )

    return location


# ==========================================================
# APPLY LOCATION ACCESS FILTER
# ==========================================================

def apply_location_access_filter(
    query,
    model,
    current_user,
):

    if is_camp_boss(
        current_user
    ):

        user_location_id = (
            get_user_location_id(
                current_user
            )
        )

        if user_location_id is None:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Camp Boss is not assigned "
                    "to a location."
                ),
            )

        query = query.filter(
            model.location_id
            == user_location_id
        )

    return query