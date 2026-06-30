import logging
import logging.config
import os
import traceback
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# ── Structured Logging ────────────────────────────────────────────────────────
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%dT%H:%M:%S",
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
            }
        },
        "root": {"level": "INFO", "handlers": ["console"]},
        # Quieten noisy third-party loggers
        "loggers": {
            "uvicorn.access": {"level": "WARNING"},
            "httpx": {"level": "WARNING"},
        },
    }
)

logger = logging.getLogger(__name__)

# ── DB ────────────────────────────────────────────────────────────────────────
from db.database import create_db_and_tables  # noqa: E402 — after load_dotenv
from api.v1.router import v1_router            # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — initialising database …")
    create_db_and_tables()
    
    # Auto-seed voices if table is empty
    from sqlmodel import Session
    from db.database import engine
    from db.models import VoiceDefinition
    with Session(engine) as session:
        from sqlmodel import func, select
        voices_count = session.exec(select(func.count(VoiceDefinition.id))).one()
        if voices_count == 0:
            logger.info("Voices database is empty. Seeding prebuilt voices …")
            from scripts.seed_voices import seed_voices
            seed_voices(session)
            
    yield
    logger.info("Shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Audiobook TTS Engine",
    description="API for managing audiobook characters, dictionaries, and generating TTS audio.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Global exception handler (#15) ───────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler so unhandled errors return a safe JSON 500 rather than
    leaking stack traces to the client."""
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. See server logs for details."},
    )


# ── CORS ──────────────────────────────────────────────────────────────────────
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(v1_router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"message": "Welcome to Audiobook TTS Engine"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
