from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    func,
    UniqueConstraint,
    Index,
    Float,
)
from sqlalchemy.orm import relationship

from app.database import Base


from sqlalchemy.orm import relationship
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.mixins import BusinessMixin
from app.core.timezone import now_wat, to_wat  # ✅ centralized WAT functions




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

    inventory_items = relationship(
        "LocationInventory",
        back_populates="location",
        cascade="all, delete-orphan",

    )


    issues = relationship(
        "StoreIssue",
        back_populates="location",
    )



class LocationInventory(Base, BusinessMixin):
    __tablename__ = "location_inventory"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=False,
    )

    item_id = Column(
        Integer,
        ForeignKey("store_items.id"),
        nullable=False,
    )

    opening_quantity = Column(
        Float,
        default=0,
        nullable=False,
    )

    quantity = Column(
        Float,
        default=0,
        nullable=False,
    )

    # ======================================================
    # UNIT PRICE
    #
    # Optional because the location currently consumes stock.
    # It is NOT a selling price.
    # ======================================================

    unit_price = Column(
        Float,
        nullable=True,
    )

    received_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=now_wat,
    )

    note = Column(
        String,
        nullable=True,
    )

    # ======================================================
    # RELATIONSHIPS
    # ======================================================

    location = relationship(
        "Location",
        back_populates="inventory_items",
    )

    item = relationship(
        "StoreItem",
    )

    # ======================================================
    # TENANT-SAFE UNIQUE CONSTRAINT
    # ======================================================

    __table_args__ = (
        UniqueConstraint(
            "business_id",
            "location_id",
            "item_id",
            name="unique_location_item",
        ),
    )

