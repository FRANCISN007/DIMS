from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    func,
    Index,
    UniqueConstraint,
    Table,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ==========================================================
# USER ↔ ROLE ASSOCIATION
# ==========================================================

user_roles = Table(
    "user_roles",
    Base.metadata,

    Column(
        "user_id",
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),

    Column(
        "role_id",
        Integer,
        ForeignKey(
            "roles.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
)


# ==========================================================
# USER
# ==========================================================

class User(Base):

    __tablename__ = "users"

    __table_args__ = (
        UniqueConstraint(
            "business_id",
            "username",
            name="uq_user_business_username",
        ),

        Index(
            "idx_user_business",
            "business_id",
        ),

        Index(
            "idx_user_location",
            "location_id",
        ),

        Index(
            "idx_user_username",
            "username",
        ),

        Index(
            "idx_user_status",
            "status",
        ),
    )

    # ------------------------------------------------------
    # ID
    # ------------------------------------------------------

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # ------------------------------------------------------
    # USERNAME
    # ------------------------------------------------------

    username = Column(
        String(50),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------
    # BASIC INFORMATION
    # ------------------------------------------------------

    full_name = Column(
        String(150),
        nullable=False,
    )

    phone = Column(
        String(20),
        nullable=True,
    )

    hashed_password = Column(
        String,
        nullable=False,
    )

    # ------------------------------------------------------
    # BUSINESS
    # ------------------------------------------------------

    # Super Admin has no business.
    business_id = Column(
        Integer,
        ForeignKey(
            "businesses.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    # ------------------------------------------------------
    # LOCATION
    # ------------------------------------------------------

    # Location is OPTIONAL.
    #
    # Example:
    # Accountant → may have no location
    # Store      → may have no location
    # Ops Manager → may have no location
    #
    location_id = Column(
        Integer,
        ForeignKey(
            "locations.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # ------------------------------------------------------
    # STATUS
    # ------------------------------------------------------

    status = Column(
        String(20),
        nullable=False,
        default="active",
        server_default="active",
        index=True,
    )

    # ------------------------------------------------------
    # DATES
    # ------------------------------------------------------

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ======================================================
    # RELATIONSHIPS
    # ======================================================

    business = relationship(
        "Business",
        back_populates="users",
    )

    # ------------------------------------------------------
    # MULTIPLE ROLES
    # ------------------------------------------------------

    roles = relationship(
        "Role",
        secondary="user_roles",
        back_populates="users",
        lazy="selectin",
    )

    # ------------------------------------------------------
    # LOCATION
    # ------------------------------------------------------

    location = relationship(
        "Location",
        back_populates="users",
    )