"""
Analytics aggregation with SQLite persistence.
Events are written to nyaya_analytics.db so data survives server restarts.
"""

import os
import sqlite3
from collections import deque
from dataclasses import dataclass
from threading import Lock
from typing import Any, Dict, Deque, List
import time

_DB_PATH = os.getenv("NYAYA_ANALYTICS_DB", "nyaya_analytics.db")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS analytics_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     REAL    NOT NULL,
    request_id    TEXT    NOT NULL,
    endpoint      TEXT    NOT NULL,
    status        TEXT    NOT NULL,
    groundedness_score REAL NOT NULL DEFAULT 0.0,
    latency_seconds    REAL NOT NULL DEFAULT 0.0,
    fallback_used INTEGER NOT NULL DEFAULT 0,
    no_context    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ae_timestamp ON analytics_events(timestamp);

CREATE TABLE IF NOT EXISTS user_search_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     REAL    NOT NULL,
    request_id    TEXT    NOT NULL,
    user_id       TEXT    NOT NULL,
    endpoint      TEXT    NOT NULL,
    question      TEXT    NOT NULL,
    answer_preview TEXT   NOT NULL,
    status        TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ush_user_time ON user_search_history(user_id, timestamp DESC);
"""


@dataclass
class AnalyticsEvent:
    timestamp: float
    request_id: str
    endpoint: str
    status: str
    groundedness_score: float
    latency_seconds: float
    fallback_used: bool
    no_context: bool


class AnalyticsStore:
    def __init__(self, max_events: int = 5000):
        self.max_events = max_events
        # In-memory mirror for fast reads
        self._events: Deque[AnalyticsEvent] = deque(maxlen=max_events)
        self._lock = Lock()
        self._db_path = _DB_PATH
        self._init_db()

    def _init_db(self) -> None:
        """Create table if it doesn't exist and load recent events into memory."""
        try:
            with sqlite3.connect(self._db_path) as conn:
                conn.executescript(_SCHEMA)
                conn.commit()
                rows = conn.execute(
                    "SELECT timestamp, request_id, endpoint, status, "
                    "groundedness_score, latency_seconds, fallback_used, no_context "
                    "FROM analytics_events ORDER BY id DESC LIMIT ?",
                    (self.max_events,),
                ).fetchall()
            for row in reversed(rows):
                self._events.append(AnalyticsEvent(
                    timestamp=row[0], request_id=row[1], endpoint=row[2],
                    status=row[3], groundedness_score=row[4], latency_seconds=row[5],
                    fallback_used=bool(row[6]), no_context=bool(row[7]),
                ))
        except Exception as exc:
            # DB init failure is non-fatal; analytics degrades to in-memory only.
            print(f"[WARNING] Analytics DB init failed ({exc}); using in-memory only.")

    def record(self, event: AnalyticsEvent) -> None:
        with self._lock:
            self._events.append(event)
        try:
            with sqlite3.connect(self._db_path) as conn:
                conn.execute(
                    "INSERT INTO analytics_events "
                    "(timestamp, request_id, endpoint, status, groundedness_score, "
                    "latency_seconds, fallback_used, no_context) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (event.timestamp, event.request_id, event.endpoint, event.status,
                     event.groundedness_score, event.latency_seconds,
                     int(event.fallback_used), int(event.no_context)),
                )
                conn.commit()
        except Exception:
            pass  # persistence failure must not affect the request path

    def record_user_search(
        self,
        *,
        timestamp: float,
        request_id: str,
        user_id: str,
        endpoint: str,
        question: str,
        answer_preview: str,
        status: str,
    ) -> None:
        """Persist per-user search history for frontend chat/history views."""
        try:
            with sqlite3.connect(self._db_path) as conn:
                conn.execute(
                    "INSERT INTO user_search_history "
                    "(timestamp, request_id, user_id, endpoint, question, answer_preview, status) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        timestamp,
                        request_id,
                        user_id,
                        endpoint,
                        question,
                        answer_preview,
                        status,
                    ),
                )
                conn.commit()
        except Exception:
            pass

    def get_user_history(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Return newest-first user search history rows."""
        safe_limit = max(1, min(limit, 200))
        try:
            with sqlite3.connect(self._db_path) as conn:
                rows = conn.execute(
                    "SELECT timestamp, request_id, endpoint, question, answer_preview, status "
                    "FROM user_search_history WHERE user_id = ? "
                    "ORDER BY id DESC LIMIT ?",
                    (user_id, safe_limit),
                ).fetchall()
            return [
                {
                    "timestamp": row[0],
                    "request_id": row[1],
                    "endpoint": row[2],
                    "question": row[3],
                    "answer_preview": row[4],
                    "status": row[5],
                }
                for row in rows
            ]
        except Exception:
            return []

    def clear_user_history(self, user_id: str) -> int:
        """Delete all history rows for a user and return deleted row count."""
        try:
            with sqlite3.connect(self._db_path) as conn:
                cur = conn.execute(
                    "DELETE FROM user_search_history WHERE user_id = ?",
                    (user_id,),
                )
                conn.commit()
                return cur.rowcount if cur.rowcount is not None else 0
        except Exception:
            return 0

    def summary(self) -> Dict[str, Any]:
        with self._lock:
            events: List[AnalyticsEvent] = list(self._events)

        total = len(events)
        if total == 0:
            return {
                "total_requests": 0,
                "hit_rate": 0.0,
                "fallback_rate": 0.0,
                "no_context_rate": 0.0,
                "avg_groundedness": 0.0,
                "avg_latency_seconds": 0.0,
                "last_updated": time.time(),
            }

        fallback_count = sum(1 for e in events if e.fallback_used)
        no_context_count = sum(1 for e in events if e.no_context)
        avg_groundedness = sum(e.groundedness_score for e in events) / total
        avg_latency = sum(e.latency_seconds for e in events) / total
        hit_rate = (total - no_context_count) / total

        return {
            "total_requests": total,
            "hit_rate": round(hit_rate, 4),
            "fallback_rate": round(fallback_count / total, 4),
            "no_context_rate": round(no_context_count / total, 4),
            "avg_groundedness": round(avg_groundedness, 4),
            "avg_latency_seconds": round(avg_latency, 4),
            "last_updated": time.time(),
        }

    def trends(self, limit: int = 100) -> Dict[str, Any]:
        with self._lock:
            events = list(self._events)[-limit:]

        return {
            "points": [
                {
                    "timestamp": e.timestamp,
                    "groundedness": e.groundedness_score,
                    "latency_seconds": e.latency_seconds,
                    "fallback_used": e.fallback_used,
                    "status": e.status,
                }
                for e in events
            ],
            "count": len(events),
        }


analytics_store = AnalyticsStore()
