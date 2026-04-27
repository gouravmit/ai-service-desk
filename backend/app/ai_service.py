import json
import logging
import re
import math
from datetime import datetime, timezone
from typing import Optional

from google import genai

from app.config import get_settings
from app.schemas import AIAnalysis, SimilarTicket
from app.models import TicketCategory, TicketPriority

logger = logging.getLogger(__name__)
settings = get_settings()

PRIMARY_MODEL = "gemini-2.5-flash"
FALLBACK_MODEL = "gemini-2.5-pro"

# Lazy client — initialized on first use so missing key doesn't crash import
_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _call_gemini(prompt: str) -> tuple[str, str]:
    """Call Gemini with primary model, fallback on failure. Returns (text, model_used)."""
    client = _get_client()

    for model in (PRIMARY_MODEL, FALLBACK_MODEL):
        try:
            response = client.models.generate_content(
                model=model,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
            )
            text = response.text or ""
            logger.info("Gemini response received from model=%s len=%d", model, len(text))
            return text, model
        except Exception as exc:
            logger.warning("Model %s failed: %s", model, exc)
            if model == FALLBACK_MODEL:
                raise

    raise RuntimeError("All Gemini models failed")


def _extract_json(raw: str) -> dict:
    """Extract JSON object from raw Gemini output (may be wrapped in markdown fences)."""
    # Strip markdown fences
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    # Find the first JSON object
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in response: {raw[:200]}")
    return json.loads(match.group())


# ── Core Analysis ────────────────────────────────────────────────────────────

def analyze_ticket(title: str, description: str) -> tuple[AIAnalysis, str]:
    """
    Analyze a support ticket using Gemini and return structured AIAnalysis.
    Returns (analysis, model_used).
    """
    prompt = f"""You are a senior IT support engineer at a Fortune 500 company.
Analyze the following IT support ticket and return a STRICT JSON object.

TICKET TITLE: {title}
TICKET DESCRIPTION: {description}

Return ONLY this JSON (no markdown, no explanation, no extra text):
{{
  "category": "<one of: bug | infrastructure | access | other>",
  "priority": "<one of: low | medium | high>",
  "root_cause": "<concise 1-2 sentence root cause analysis>",
  "solution": "<numbered step-by-step resolution plan, minimum 3 steps>",
  "confidence": <float between 0.0 and 1.0 representing your confidence>
}}

Guidelines:
- high priority: system outage, data loss, security breach, production down
- medium priority: degraded performance, multiple users affected, business impact
- low priority: cosmetic issues, single-user non-blocking, enhancement requests
- bug: software malfunction, crash, unexpected behavior
- infrastructure: network, server, cloud, DevOps, database
- access: permissions, authentication, SSO, VPN, credentials
- other: anything else
"""

    raw, model_used = _call_gemini(prompt)
    data = _extract_json(raw)

    # Validate & coerce enums
    category = TicketCategory(data.get("category", "other").lower())
    priority = TicketPriority(data.get("priority", "medium").lower())
    confidence = float(data.get("confidence", 0.75))
    confidence = max(0.0, min(1.0, confidence))

    solution_raw = data.get("solution", "Please escalate to Tier 2 support.")
    if isinstance(solution_raw, list):
        solution = "\n".join(str(s) for s in solution_raw)
    else:
        solution = str(solution_raw)

    analysis = AIAnalysis(
        category=category,
        priority=priority,
        root_cause=data.get("root_cause", "Unable to determine root cause."),
        solution=solution,
        confidence=confidence,
        model_used=model_used,
    )
    return analysis, model_used


def generate_suggested_reply(
    title: str,
    description: str,
    category: str,
    priority: str,
    root_cause: str,
    solution: str,
) -> str:
    """Generate a professional IT support reply email."""
    prompt = f"""You are a professional IT support specialist writing a response to a user's support ticket.

TICKET TITLE: {title}
DESCRIPTION: {description}
CATEGORY: {category}
PRIORITY: {priority}
ROOT CAUSE: {root_cause}
PROPOSED SOLUTION: {solution}

Write a professional, empathetic, and clear support reply email. Include:
1. Acknowledgment of the issue
2. Brief explanation of the root cause (in user-friendly language, no jargon)
3. Clear step-by-step instructions for the user to follow
4. Estimated resolution time based on priority (high=1-4h, medium=1-2 days, low=3-5 days)
5. Professional sign-off from "IT Support Team"

Keep the tone professional but warm. Do NOT include a subject line. Start with "Dear [User],"
"""

    raw, _ = _call_gemini(prompt)
    # Clean up any accidental JSON wrapping
    cleaned = raw.strip()
    if cleaned.startswith("{"):
        try:
            data = json.loads(cleaned)
            return data.get("reply", cleaned)
        except Exception:
            pass
    return cleaned


# ── Similarity Detection ─────────────────────────────────────────────────────

def _tokenize(text: str) -> set[str]:
    """Simple word tokenizer with stop-word filtering."""
    stop_words = {
        "the", "a", "an", "is", "in", "on", "at", "to", "for", "of",
        "and", "or", "but", "not", "with", "this", "that", "my", "i",
        "we", "it", "be", "was", "are", "have", "has", "can", "will",
        "when", "how", "what", "why", "where", "which", "do", "get",
    }
    words = re.findall(r"\b[a-z]{3,}\b", text.lower())
    return {w for w in words if w not in stop_words}


def _jaccard_similarity(set_a: set, set_b: set) -> float:
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union else 0.0


def find_similar_tickets(
    title: str,
    description: str,
    existing_tickets: list,
    top_k: int = 3,
    threshold: float = 0.15,
) -> list[SimilarTicket]:
    """
    Find similar tickets using Jaccard similarity on tokenized title+description.
    Returns top_k tickets above threshold, sorted by similarity descending.
    """
    query_tokens = _tokenize(f"{title} {description}")
    scored = []

    for ticket in existing_tickets:
        candidate_tokens = _tokenize(f"{ticket.title} {ticket.description}")
        score = _jaccard_similarity(query_tokens, candidate_tokens)
        if score >= threshold:
            scored.append(
                SimilarTicket(
                    id=ticket.id,
                    title=ticket.title,
                    similarity_score=round(score, 4),
                    status=ticket.status,
                )
            )

    scored.sort(key=lambda x: x.similarity_score, reverse=True)
    return scored[:top_k]
