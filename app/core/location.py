# app/core/location.py

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.locations.models import Location


# ==========================================================
# LOCATION ACCESS HELPERS
# ==========================================================

def is_camp_boss(current_user) -> bool:
    """
    Check whether the current user has the Camp Boss role.
    """

    roles = getattr(current_user, "roles", []) or []

    for role in roles:

        if isinstance(role, str):
            role_name = role

        else:
            role_name = getattr(
                role,
                "code",
                None
            ) or getattr(
                role,
                "name",
                None
            )

        if role_name:
            role_name = role_name.lower().replace(" ", "_")

            if role_name == "camp_boss":
                return True

    return False


def get_user_location_id(current_user) -> Optional[int]:
    """
    Return the location assigned to the current user.
    """

    return getattr(
        current_user,
        "location_id",
        None
    )


def validate_location_access(
    db: Session,
    current_user,
    location_id: int,
    business_id: int,
):
    """
    Validate that the current user is allowed to access
    the specified location.

    Camp Boss:
        Can ONLY access their assigned location.

    Other authorized roles:
        Can access locations within their business.
    """

    # ------------------------------------------------------
    # Validate location belongs to the business
    # ------------------------------------------------------

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

    # ------------------------------------------------------
    # CAMP BOSS RESTRICTION
    # ------------------------------------------------------

    if is_camp_boss(current_user):

        user_location_id = get_user_location_id(
            current_user
        )

        if user_location_id is None:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Camp Boss is not assigned "
                    "to a location."
                ),
            )

        if user_location_id != location_id:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have access to "
                    "this location."
                ),
            )

    return location


def resolve_location_id(
    current_user,
    requested_location_id: Optional[int],
):
    """
    Resolve the location that should actually be used.

    Camp Boss:
        Always uses their assigned location.
        Frontend location_id is ignored.

    Other roles:
        Requested location is respected.
    """

    if is_camp_boss(current_user):

        user_location_id = get_user_location_id(
            current_user
        )

        if user_location_id is None:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Camp Boss is not assigned "
                    "to a location."
                ),
            )

        return user_location_id

    return requested_location_id


def apply_location_access_filter(
    query,
    model,
    current_user,
):
    """
    Apply the Camp Boss location restriction directly
    to a SQLAlchemy query.

    Camp Boss:
        query is restricted to current_user.location_id.

    Other roles:
        query remains unchanged.
    """

    if is_camp_boss(current_user):

        user_location_id = get_user_location_id(
            current_user
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
            model.location_id == user_location_id
        )

    return query