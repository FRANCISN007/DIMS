from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    func,
)

from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)

    business_id = Column(
        Integer,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(100), nullable=False)

    code = Column(String(50), nullable=False)

    description = Column(String(255), nullable=True)

    status = Column(
        String(20),
        nullable=False,
        default="active",
        server_default="active",
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
    business = relationship("Business")
    users = relationship("User", back_populates="role")


    

    __table_args__ = (
        UniqueConstraint(
            "business_id",
            "name",
            name="uq_role_business_name",
        ),
        UniqueConstraint(
            "business_id",
            "code",
            name="uq_role_business_code",
        ),
    )