import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import ai_service
from app.database import get_db
from app.models import Ticket, TicketStatus
from app.schemas import (
    AnalyticsResponse,
    SuggestedReply,
    TicketAnalyzeResponse,
    TicketCreate,
    TicketResponse,
    TicketStatusUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Background Task ──────────────────────────────────────────────────────────

def _auto_analyze(ticket_id: int, db_factory):
    """Background task: analyze ticket immediately after creation."""
    db: Session = db_factory()
    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            return

        existing = (
            db.query(Ticket).filter(Ticket.id != ticket_id).all()
        )
        analysis, model_used = ai_service.analyze_ticket(ticket.title, ticket.description)
        similar = ai_service.find_similar_tickets(
            ticket.title, ticket.description, existing
        )

        ticket.category = analysis.category
        ticket.priority = analysis.priority
        ticket.root_cause = analysis.root_cause
        ticket.solution = analysis.solution
        ticket.ai_confidence = analysis.confidence
        ticket.analysis_model = model_used
        ticket.similar_ticket_ids = [s.id for s in similar]
        ticket.analyzed_at = datetime.now(timezone.utc)

        # Also generate reply in background
        try:
            reply = ai_service.generate_suggested_reply(
                ticket.title,
                ticket.description,
                analysis.category.value,
                analysis.priority.value,
                analysis.root_cause,
                analysis.solution,
            )
            ticket.suggested_reply = reply
        except Exception as exc:
            logger.warning("Reply generation failed for ticket %d: %s", ticket_id, exc)

        db.commit()
        logger.info("Auto-analysis complete for ticket id=%d model=%s", ticket_id, model_used)
    except Exception as exc:
        logger.error("Auto-analysis failed for ticket id=%d: %s", ticket_id, exc)
        db.rollback()
    finally:
        db.close()


# ── Ticket Endpoints ─────────────────────────────────────────────────────────

@router.post("/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new support ticket and trigger background AI analysis."""
    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        tags=payload.tags or [],
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Kick off analysis asynchronously
    from app.database import SessionLocal
    background_tasks.add_task(_auto_analyze, ticket.id, SessionLocal)

    logger.info("Ticket created id=%d title=%r", ticket.id, ticket.title)
    return ticket


@router.get("/tickets", response_model=List[TicketResponse])
def list_tickets(
    status: str = None,
    priority: str = None,
    category: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List all tickets with optional filters."""
    query = db.query(Ticket)
    if status:
        query = query.filter(Ticket.status == status.upper())
    if priority:
        query = query.filter(Ticket.priority == priority.lower())
    if category:
        query = query.filter(Ticket.category == category.lower())
    tickets = query.order_by(Ticket.created_at.desc()).offset(skip).limit(limit).all()
    return tickets


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    """Get a single ticket by ID."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    return ticket


@router.post("/tickets/{ticket_id}/analyze", response_model=TicketAnalyzeResponse)
def analyze_ticket(ticket_id: int, db: Session = Depends(get_db)):
    """Manually trigger AI analysis on a ticket (synchronous)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")

    existing = db.query(Ticket).filter(Ticket.id != ticket_id).all()

    try:
        analysis, model_used = ai_service.analyze_ticket(ticket.title, ticket.description)
        similar = ai_service.find_similar_tickets(ticket.title, ticket.description, existing)

        # Generate reply
        reply = ai_service.generate_suggested_reply(
            ticket.title,
            ticket.description,
            analysis.category.value,
            analysis.priority.value,
            analysis.root_cause,
            analysis.solution,
        )

        ticket.category = analysis.category
        ticket.priority = analysis.priority
        ticket.root_cause = analysis.root_cause
        ticket.solution = analysis.solution
        ticket.suggested_reply = reply
        ticket.ai_confidence = analysis.confidence
        ticket.analysis_model = model_used
        ticket.similar_ticket_ids = [s.id for s in similar]
        ticket.analyzed_at = datetime.now(timezone.utc)
        ticket.status = TicketStatus.IN_PROGRESS

        db.commit()
        db.refresh(ticket)

        logger.info("Manual analysis complete for ticket id=%d", ticket_id)
        return TicketAnalyzeResponse(ticket=ticket, analysis=analysis, similar_tickets=similar)

    except Exception as exc:
        db.rollback()
        logger.error("Analysis failed for ticket %d: %s", ticket_id, exc)
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {str(exc)}")


@router.patch("/tickets/{ticket_id}/status", response_model=TicketResponse)
def update_ticket_status(
    ticket_id: int,
    payload: TicketStatusUpdate,
    db: Session = Depends(get_db),
):
    """Update ticket status."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    ticket.status = payload.status
    db.commit()
    db.refresh(ticket)
    return ticket


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    """Delete a ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    db.delete(ticket)
    db.commit()


# ── Analytics Endpoint ───────────────────────────────────────────────────────

@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(db: Session = Depends(get_db)):
    """Return aggregated ticket analytics."""
    total = db.query(func.count(Ticket.id)).scalar() or 0

    status_rows = db.query(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status).all()
    by_status = {row[0].value if row[0] else "unknown": row[1] for row in status_rows}

    cat_rows = db.query(Ticket.category, func.count(Ticket.id)).group_by(Ticket.category).all()
    by_category = {(row[0].value if row[0] else "unanalyzed"): row[1] for row in cat_rows}

    pri_rows = db.query(Ticket.priority, func.count(Ticket.id)).group_by(Ticket.priority).all()
    by_priority = {(row[0].value if row[0] else "unanalyzed"): row[1] for row in pri_rows}

    avg_conf = db.query(func.avg(Ticket.ai_confidence)).scalar()

    return AnalyticsResponse(
        total_tickets=total,
        by_status=by_status,
        by_category=by_category,
        by_priority=by_priority,
        avg_confidence=round(avg_conf, 3) if avg_conf else None,
    )
