import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import get_settings
from app.database import init_db
from app.routes import router

# ── Logging Setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
# Suppress SQLAlchemy noise unless debug
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

settings = get_settings()


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 AI Service Desk starting up...")
    init_db()
    if not settings.gemini_api_key:
        logger.warning("⚠️  GEMINI_API_KEY not set — AI features will be unavailable")
    else:
        logger.info("✅ Gemini AI configured successfully")
    yield
    logger.info("🛑 AI Service Desk shutting down")


# ── App Factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Service Desk",
    description="Enterprise-grade AI-powered IT support ticketing system",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1", tags=["tickets"])


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "ai_configured": bool(settings.gemini_api_key),
    }
