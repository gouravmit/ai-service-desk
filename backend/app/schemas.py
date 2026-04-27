from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.models import TicketStatus, TicketCategory, TicketPriority


# ── Request Schemas ──────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=255, description="Ticket title")
    description: str = Field(..., min_length=10, description="Detailed description of the issue")
    tags: Optional[List[str]] = Field(default_factory=list)


class TicketStatusUpdate(BaseModel):
    status: TicketStatus


# ── AI Response Schemas ──────────────────────────────────────────────────────

class AIAnalysis(BaseModel):
    category: TicketCategory
    priority: TicketPriority
    root_cause: str
    solution: str
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    model_used: Optional[str] = None


class SuggestedReply(BaseModel):
    reply: str
    generated_at: datetime


class SimilarTicket(BaseModel):
    id: int
    title: str
    similarity_score: float
    status: TicketStatus


# ── Response Schemas ─────────────────────────────────────────────────────────

class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    status: TicketStatus
    category: Optional[TicketCategory] = None
    priority: Optional[TicketPriority] = None
    tags: Optional[List[str]] = None
    root_cause: Optional[str] = None
    solution: Optional[str] = None
    suggested_reply: Optional[str] = None
    ai_confidence: Optional[float] = None
    analysis_model: Optional[str] = None
    similar_ticket_ids: Optional[List[int]] = None
    created_at: datetime
    updated_at: datetime
    analyzed_at: Optional[datetime] = None


class TicketAnalyzeResponse(BaseModel):
    ticket: TicketResponse
    analysis: AIAnalysis
    similar_tickets: List[SimilarTicket] = []


class AnalyticsResponse(BaseModel):
    total_tickets: int
    by_status: dict
    by_category: dict
    by_priority: dict
    avg_confidence: Optional[float] = None
