from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    DateTime,
    Index,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.core.mixins import BusinessMixin
from app.core.timezone import now_wat


WAT = ZoneInfo("Africa/Lagos")


# ==========================================================
# CATERING USAGE
# ==========================================================

class CateringUsage(Base, BusinessMixin):
    __tablename__ = "catering_usages"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=False,
        index=True,
    )

    usage_date = Column(
        DateTime(timezone=True),
        nullable=False,
        default=now_wat,
    )

    note = Column(
        String(255),
        nullable=True,
    )

    created_by = Column(
        String(100),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=now_wat,
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=now_wat,
        onupdate=now_wat,
    )

    # ======================================================
    # STATUS
    # ======================================================

    status = Column(
        String(20),
        nullable=False,
        default="active",
        server_default="active",
        index=True,
    )

    # ======================================================
    # VOID INFORMATION
    # ======================================================

    voided_by = Column(
        String(100),
        nullable=True,
    )

    voided_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    void_reason = Column(
        String(255),
        nullable=True,
    )

    # ======================================================
    # RELATIONSHIPS
    # ======================================================

    location = relationship(
        "Location",
    )

    items = relationship(
        "CateringUsageItem",
        back_populates="usage",
        cascade="all, delete-orphan",
    )

    audits = relationship(
        "CateringUsageAudit",
        back_populates="usage",
        cascade="all, delete-orphan",
    )

    # ======================================================
    # INDEXES
    # ======================================================

    __table_args__ = (
        Index(
            "idx_catering_usage_business_location",
            "business_id",
            "location_id",
        ),
        Index(
            "idx_catering_usage_date",
            "usage_date",
        ),
        Index(
            "idx_catering_usage_status",
            "business_id",
            "status",
        ),
    )


# ==========================================================
# CATERING USAGE ITEM
# ==========================================================

class CateringUsageItem(Base, BusinessMixin):
    __tablename__ = "catering_usage_items"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    usage_id = Column(
        Integer,
        ForeignKey(
            "catering_usages.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=False,
        index=True,
    )

    item_id = Column(
        Integer,
        ForeignKey("store_items.id"),
        nullable=False,
        index=True,
    )

    quantity_used = Column(
        Float,
        nullable=False,
    )

    unit_price = Column(
        Float,
        nullable=True,
    )

    total_amount = Column(
        Float,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=now_wat,
    )

    usage = relationship(
        "CateringUsage",
        back_populates="items",
    )

    location = relationship(
        "Location",
    )

    item = relationship(
        "StoreItem",
    )

    __table_args__ = (
        Index(
            "idx_catering_usage_item_business",
            "business_id",
            "item_id",
        ),
    )


# ==========================================================
# CATERING USAGE AUDIT
# ==========================================================

class CateringUsageAudit(Base, BusinessMixin):
    __tablename__ = "catering_usage_audits"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    usage_id = Column(
        Integer,
        ForeignKey(
            "catering_usages.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    action = Column(
        String(20),
        nullable=False,
        index=True,
    )

    performed_by = Column(
        String(100),
        nullable=True,
    )

    performed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=now_wat,
    )

    reason = Column(
        String(255),
        nullable=True,
    )

    old_data = Column(
        JSON,
        nullable=True,
    )

    new_data = Column(
        JSON,
        nullable=True,
    )

    usage = relationship(
        "CateringUsage",
        back_populates="audits",
    )

    __table_args__ = (
        Index(
            "idx_catering_usage_audit_business_usage",
            "business_id",
            "usage_id",
        ),
    )


    # ==========================================================
# LOCATION INVENTORY ADJUSTMENT
# ==========================================================

class LocationInventoryAdjustment(Base, BusinessMixin):
    __tablename__ = "location_inventory_adjustments"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # ======================================================
    # LOCATION
    # ======================================================

    location_id = Column(
        Integer,
        ForeignKey("locations.id"),
        nullable=False,
        index=True
    )

    # ======================================================
    # ITEM
    # ======================================================

    item_id = Column(
        Integer,
        ForeignKey("store_items.id"),
        nullable=False,
        index=True
    )

    # ======================================================
    # ADJUSTMENT QUANTITY
    #
    # +10 = add 10
    # -10 = remove 10
    # ======================================================

    quantity_adjusted = Column(
        Float,
        nullable=False
    )

    # ======================================================
    # REMAINING QUANTITY
    #
    # Used mainly to keep track of stock added through
    # a positive adjustment.
    #
    # Example:
    #
    # Adjustment = +20
    # Remaining  = 20
    #
    # If 5 of that stock is later consumed:
    #
    # Remaining = 15
    # ======================================================

    remaining_quantity = Column(
        Float,
        nullable=False,
        default=0,
        server_default="0"
    )

    # ======================================================
    # REASON
    # ======================================================

    reason = Column(
        String(255),
        nullable=True
    )

    # ======================================================
    # AUDIT INFORMATION
    # ======================================================

    adjusted_by = Column(
        String(100),
        nullable=True
    )

    adjusted_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=now_wat
    )

    # ======================================================
    # RELATIONSHIPS
    # ======================================================

    location = relationship(
        "Location"
    )

    item = relationship(
        "StoreItem"
    )

    # ======================================================
    # INDEXES
    # ======================================================

    __table_args__ = (
        Index(
            "idx_location_adjustment_business_location",
            "business_id",
            "location_id"
        ),

        Index(
            "idx_location_adjustment_business_item",
            "business_id",
            "item_id"
        ),

        Index(
            "idx_location_adjustment_date",
            "business_id",
            "adjusted_at"
        ),
    )





