"""
Quiz database connection — uses Supabase/Postgres via DATABASE_URL env var.
This is separate from the Qdrant vector store used by the legal Q&A agent.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Only initialise the engine if DATABASE_URL is set.
# This allows the backend to start without a database (quiz endpoints will return 503).
if DATABASE_URL:
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(bind=engine)
        DB_AVAILABLE = True
        logger.info("[quiz-db] Database connection initialised")
    except Exception as e:
        logger.warning(f"[quiz-db] Failed to initialise database: {e}")
        engine = None
        SessionLocal = None
        DB_AVAILABLE = False
else:
    logger.warning("[quiz-db] DATABASE_URL not set — quiz endpoints will be unavailable")
    engine = None
    SessionLocal = None
    DB_AVAILABLE = False
