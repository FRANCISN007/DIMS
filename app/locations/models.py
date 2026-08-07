from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    func,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Location(Base):
    __tablename__ = "locations"

    __table_args__ = (
        UniqueConstraint(
            "business_id",
            "code",
            name="uq_location_business_code",
        ),
        UniqueConstraint(
            "business_id",
            "name",
            name="uq_location_business_name",
        ),
        Index("idx_location_business", "business_id"),
        Index("idx_location_name", "name"),
        Index("idx_location_code", "code"),
        Index("idx_location_status", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)

    business_id = Column(
        Integer,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(
        String(100),
        nullable=False,
        index=True,
    )

    code = Column(
        String(30),
        nullable=False,
        index=True,
    )

    address = Column(
        String(255),
        nullable=True,
    )

    description = Column(
        String(255),
        nullable=True,
    )

    status = Column(
        String(20),
        nullable=False,
        default="active",
        server_default="active",
        index=True,
    )

    phone = Column(
        String(20),
        nullable=True,
    )


    sort_order = Column(
        Integer,
        nullable=False,
        default=1,
        server_default="1",
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
        back_populates="locations",
    )

    users = relationship(
        "User",
        back_populates="location",
    )