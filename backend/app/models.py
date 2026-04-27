from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, Float, JSON
import enum
from app.database import Base


class TicketStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class TicketCategory(str, enum.Enum):
    BUG = "bug"
    INFRASTRUCTURE = "infrastructure"
    ACCESS = "access"
    OTHER = "other"


class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    status = Column(
        Enum(TicketStatus), default=TicketStatus.OPEN, nullable=False, index=True
    )
    category = Column(Enum(TicketCategory), nullable=True)
    priority = Column(Enum(TicketPriority), nullable=True)
    tags = Column(JSON, default=list)

    # AI Analysis fields
    root_cause = Column(Text, nullable=True)
    solution = Column(Text, nullable=True)
    suggested_reply = Column(Text, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    analysis_model = Column(String(100), nullable=True)

    # Similar tickets (stored as JSON list of IDs)
    similar_ticket_ids = Column(JSON, default=list)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    analyzed_at = Column(DateTime(timezone=True), nullable=True)
