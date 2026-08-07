from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    func,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        UniqueConstraint(
            "business_id",
            "username",
            name="uq_user_business_username",
        ),
        Index("idx_user_business", "business_id"),
        Index("idx_user_role", "role_id"),
        Index("idx_user_location", "location_id"),
        Index("idx_user_username", "username"),
        Index("idx_user_status", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)

    username = Column(
        String(50),
        nullable=False,
        index=True,
    )

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

    # Super Admin has no business
    business_id = Column(
        Integer,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Super Admin may not have a business role
    role_id = Column(
        Integer,
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Optional for users not assigned to a location
    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status = Column(
        String(20),
        nullable=False,
        default="active",
        server_default="active",
        index=True,
    )

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

    # Relationships
    business = relationship(
        "Business",
        back_populates="users",
    )

    role = relationship(
        "Role",
        back_populates="users",
    )

    location = relationship(
        "Location",
        back_populates="users",
    )