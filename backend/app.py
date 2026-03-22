#!/usr/bin/env python3
"""
Nyaya Legal Assistant - FastAPI REST API
Provides HTTP endpoints for legal question answering and case lookup.
"""

import json
import logging
import os
import time
import uuid
from threading import Lock
from typing import Any, Dict, Generator, List, Optional

from fastapi import FastAPI, HTTPException, Request, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field

from agent.nyaya_agent import NyayaAgent
from agent.llm import stream_answer
from analytics_store import AnalyticsEvent, analytics_store
from optimizations import is_valid_query
from database import SessionLocal, DB_AVAILABLE
from sqlalchemy import text as sql_text

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_API_KEY = os.getenv("NYAYA_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _require_api_key(key: Optional[str] = Security(_api_key_header)) -> None:
    if _API_KEY and key != _API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")

app = FastAPI(
    title="Nyaya Legal Assistant API",
    description="Sri Lankan Legal Question Answering System",
    version="1.0.0"
)

_raw_cors = os.getenv("CORS_ORIGINS", "")
_cors_origins: list[str] = (
    [o.strip() for o in _raw_cors.split(",") if o.strip()]
    if _raw_cors.strip()
    else ["*"]
)
_allow_credentials = "*" not in _cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

_agent_lock = Lock()
_agent_instance: Optional[NyayaAgent] = None


def get_agent() -> NyayaAgent:
    global _agent_instance
    if _agent_instance is not None:
        return _agent_instance
    with _agent_lock:
        if _agent_instance is None:
            _agent_instance = NyayaAgent(show_debug=False)
    return _agent_instance


class QueryRequest(BaseModel):
    question: str
    description: Optional[str] = "Legal question about Sri Lankan law"


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str
    history: List[ChatTurn] = Field(default_factory=list)


class QueryResponse(BaseModel):
    question: str
    answer: str
    status: str
    source_map: List[Dict[str, Any]] = Field(default_factory=list)
    precedent_chain: List[Dict[str, Any]] = Field(default_factory=list)
    groundedness_score: float = 0.0
    reflection_report: Dict[str, Any] = Field(default_factory=dict)
    latency_seconds: float = 0.0


class HealthResponse(BaseModel):
    status: str
    version: str


def _to_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return default


def _to_list_of_dict(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _to_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _log_event(event_name: str, **payload: Any) -> None:
    event = {"event": event_name, **payload}
    logger.info(json.dumps(event, default=str))


def _validate_question(question: str) -> str:
    cleaned = question.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if not is_valid_query(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Invalid query. Please ask a legal question (not commands or file paths).",
        )
    return cleaned


def _build_query_response(question: str, report: Dict[str, Any]) -> QueryResponse:
    answer = report.get("answer", "")
    status = report.get("status", "success")
    return QueryResponse(
        question=question,
        answer=answer if isinstance(answer, str) else str(answer),
        status=status if isinstance(status, str) else "success",
        source_map=_to_list_of_dict(report.get("source_map", [])),
        precedent_chain=_to_list_of_dict(report.get("precedent_chain", [])),
        groundedness_score=_to_float(report.get("groundedness_score", 0.0), 0.0),
        reflection_report=_to_dict(report.get("reflection_report", {})),
        latency_seconds=_to_float(report.get("latency_seconds", 0.0), 0.0),
    )


def _record_analytics(endpoint: str, request_id: str, response: QueryResponse) -> None:
    analytics_store.record(
        AnalyticsEvent(
            timestamp=time.time(),
            request_id=request_id,
            endpoint=endpoint,
            status=response.status,
            groundedness_score=response.groundedness_score,
            latency_seconds=response.latency_seconds,
            fallback_used=response.status == "fallback",
            no_context=response.status in {"no_context", "insufficient_evidence"},
        )
    )


def _extract_user_id(http_request: Request) -> Optional[str]:
    candidate = (
        http_request.headers.get("X-User-ID")
        or http_request.headers.get("X-User-Id")
        or http_request.headers.get("X-User")
    )
    if not candidate:
        return None
    cleaned = candidate.strip()
    if not cleaned:
        return None
    return cleaned[:128]


def _record_user_history(
    *,
    endpoint: str,
    request_id: str,
    user_id: Optional[str],
    question: str,
    answer: str,
    status: str,
) -> None:
    if not user_id:
        return
    analytics_store.record_user_search(
        timestamp=time.time(),
        request_id=request_id,
        user_id=user_id,
        endpoint=endpoint,
        question=question,
        answer_preview=(answer or "")[:280],
        status=status,
    )


def _process_query(
    endpoint: str,
    request_id: str,
    question: str,
    history: Optional[List[Dict[str, str]]] = None,
    user_id: Optional[str] = None,
) -> QueryResponse:
    log_payload: Dict[str, Any] = {
        "request_id": request_id,
        "question_preview": question[:100],
    }
    if history:
        log_payload["history_turns"] = len(history)
    _log_event(f"{endpoint.strip('/').replace('-', '_')}_started", **log_payload)

    report = get_agent().ask_with_report(question, debug_mode=False, history=history)
    response = _build_query_response(question, report)
    _record_analytics(endpoint, request_id, response)
    _record_user_history(
        endpoint=endpoint,
        request_id=request_id,
        user_id=user_id,
        question=question,
        answer=response.answer,
        status=response.status,
    )

    _log_event(
        f"{endpoint.strip('/').replace('-', '_')}_completed",
        request_id=request_id,
        status=response.status,
        groundedness=response.groundedness_score,
        latency_seconds=response.latency_seconds,
    )
    return response


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.time()

    try:
        response = await call_next(request)
    except Exception as exc:
        _log_event(
            "request_error",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            error=str(exc),
            latency_seconds=round(time.time() - start, 4),
        )
        raise

    response.headers["X-Request-ID"] = request_id
    _log_event(
        "request_complete",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        latency_seconds=round(time.time() - start, 4),
    )
    return response


@app.get("/health", response_model=HealthResponse)
def health_check():
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/test-embed")
async def test_embed():
    from agent.retriever import _embed_query, VectorRetriever
    try:
        vec = _embed_query("burden of proof")
        r = VectorRetriever()
        results = r.search("burden of proof", top_k=3)
        return {
            "embed_dims": len(vec),
            "results_count": len(results),
            "first_result": results[0].get("text", "")[:200] if results else None
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/ask", response_model=QueryResponse)
def ask_legal_question(request: QueryRequest, http_request: Request, _auth: None = Security(_require_api_key)) -> QueryResponse:
    question = _validate_question(request.question)
    try:
        request_id = getattr(http_request.state, "request_id", "unknown")
        user_id = _extract_user_id(http_request)
        return _process_query("/ask", request_id, question, user_id=user_id)
    except Exception as e:
        request_id = getattr(http_request.state, "request_id", "unknown")
        _log_event("ask_failed", request_id=request_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Error processing your question: {str(e)[:200]}")


@app.post("/ask-chat", response_model=QueryResponse)
def ask_chat(request: ChatRequest, http_request: Request, _auth: None = Security(_require_api_key)) -> QueryResponse:
    question = _validate_question(request.question)
    history = [{"role": t.role, "content": t.content} for t in request.history]
    try:
        request_id = getattr(http_request.state, "request_id", "unknown")
        user_id = _extract_user_id(http_request)
        return _process_query("/ask-chat", request_id, question, history=history, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)[:200]}")


@app.post("/ask-stream")
def ask_stream(request: ChatRequest, http_request: Request, _auth: None = Security(_require_api_key)):
    question = _validate_question(request.question)
    request_id = getattr(http_request.state, "request_id", "unknown")
    user_id = _extract_user_id(http_request)
    history = [{"role": t.role, "content": t.content} for t in request.history]

    def _generate() -> Generator[str, None, None]:
        collected_chunks: List[str] = []
        try:
            agent = get_agent()
            from optimizations import canonicalize_legal_query
            from agent.prompts import SYSTEM_PROMPT
            retrieval_query = canonicalize_legal_query(question)
            chunks = agent.retriever.search(retrieval_query, top_k=3, return_metadata=True)
            context_blocks = []
            for chunk in chunks[:2]:
                if isinstance(chunk, dict):
                    text = chunk.get("text", "")[:1200]
                    pdf = chunk.get("pdf_name", "Unknown")
                    page = chunk.get("page", "?")
                    context_blocks.append(f"TEXT:\n{text}\n\nSOURCE: {pdf}, Page {page}\n---")
            context_text = "\n\n".join(context_blocks)
            prompt = (f"{SYSTEM_PROMPT}\n\n**Context:**\n{context_text}\n\n**Question:** {question}\n\nAnswer:")
            for token in stream_answer(prompt, history=history):
                collected_chunks.append(token)
                yield token
            _record_user_history(endpoint="/ask-stream", request_id=request_id, user_id=user_id,
                                  question=question, answer="".join(collected_chunks), status="success")
        except Exception as exc:
            _record_user_history(endpoint="/ask-stream", request_id=request_id, user_id=user_id,
                                  question=question, answer=str(exc), status="error")
            yield f"\n\n[Error: {str(exc)[:200]}]"

    return StreamingResponse(_generate(), media_type="text/plain")


@app.post("/ask-batch")
def ask_batch(requests: list[QueryRequest], http_request: Request, _auth: None = Security(_require_api_key)):
    results = []
    request_id = getattr(http_request.state, "request_id", "unknown")
    for req in requests:
        try:
            result = ask_legal_question(req, http_request)
            results.append(result)
        except HTTPException as e:
            results.append({"question": req.question, "answer": f"Error: {e.detail}", "status": "error"})
    _log_event("ask_batch_completed", request_id=request_id, batch_size=len(requests), result_size=len(results))
    return results


@app.get("/analytics/summary")
def analytics_summary():
    return analytics_store.summary()


@app.get("/analytics/trends")
def analytics_trends(limit: int = 100):
    return analytics_store.trends(limit=limit)


@app.get("/analytics/dashboard", response_class=HTMLResponse)
def analytics_dashboard():
    summary = analytics_store.summary()
    html = f"""
        <html><head><title>Nyaya Analytics Dashboard</title>
        <style>body{{font-family:'Segoe UI',sans-serif;margin:24px;background:#f4f7f8;color:#1d2a30;}}
        .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;}}
        .card{{background:white;border-radius:10px;padding:16px;box-shadow:0 2px 10px rgba(0,0,0,0.08);}}
        .label{{font-size:12px;color:#5b6b73;text-transform:uppercase;}}.value{{font-size:28px;font-weight:700;margin-top:8px;}}</style>
        </head><body><h1>Nyaya Analytics</h1><div class='grid'>
        <div class='card'><div class='label'>Total Requests</div><div class='value'>{summary.get('total_requests',0)}</div></div>
        <div class='card'><div class='label'>Hit Rate</div><div class='value'>{summary.get('hit_rate',0.0)}</div></div>
        <div class='card'><div class='label'>Fallback Rate</div><div class='value'>{summary.get('fallback_rate',0.0)}</div></div>
        <div class='card'><div class='label'>Avg Groundedness</div><div class='value'>{summary.get('avg_groundedness',0.0)}</div></div>
        <div class='card'><div class='label'>Avg Latency (s)</div><div class='value'>{summary.get('avg_latency_seconds',0.0)}</div></div>
        </div><p style='margin-top:20px;color:#5b6b73;'>Refresh to see latest values.</p></body></html>
    """
    return HTMLResponse(content=html)


@app.get("/history")
def get_history(http_request: Request, limit: int = 50):
    user_id = _extract_user_id(http_request)
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user identity header. Send X-User-ID.")
    return {"user_id": user_id, "items": analytics_store.get_user_history(user_id, limit=limit)}


@app.delete("/history")
def clear_history(http_request: Request):
    user_id = _extract_user_id(http_request)
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user identity header. Send X-User-ID.")
    deleted = analytics_store.clear_user_history(user_id)
    return {"user_id": user_id, "deleted": deleted}


@app.get("/info")
def get_info():
    return {
        "name": "Nyaya Legal Assistant",
        "description": "Sri Lankan legal question answering system",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "ask": "POST /ask",
            "ask_chat": "POST /ask-chat (multi-turn, pass history[])",
            "ask_stream": "POST /ask-stream (token streaming)",
            "batch": "POST /ask-batch",
            "info": "GET /info",
            "docs": "GET /docs"
        },
        "features": [
            "Hybrid retrieval (semantic 60% + BM25 40%)",
            "Citation network analysis via Neo4j",
            "Azure OpenAI (gpt-5-nano) for answers with Gemini fallback",
            "Multi-turn chat history via /ask-chat",
            "Token streaming via /ask-stream",
            "Optional API key auth (set NYAYA_API_KEY)",
        ]
    }


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    request_id = getattr(request.state, "request_id", "unknown")
    _log_event("unhandled_exception", request_id=request_id, error=str(exc))
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "request_id": request_id})


# ── Quiz Routes ───────────────────────────────────────────────────────────────

class QuizAttemptCreate(BaseModel):
    user_id: str
    quiz_id: str


class QuizAttemptComplete(BaseModel):
    attempt_id: str
    score: int


def _quiz_db_unavailable():
    raise HTTPException(status_code=503, detail="Quiz database unavailable. Set DATABASE_URL in .env to enable quiz endpoints.")


@app.get("/quizzes")
def get_all_quizzes():
    """Get all quizzes with their questions and options — optimised (3 queries)"""
    if not DB_AVAILABLE:
        _quiz_db_unavailable()
    db = SessionLocal()
    try:
        # Query 1: all quizzes
        quizzes_result = db.execute(sql_text("""
            SELECT id, title, description, created_at, difficulty, duration_minutes
            FROM quizzes2
            ORDER BY created_at DESC
        """)).mappings().all()

        if not quizzes_result:
            return []

        quiz_ids = [str(q['id']) for q in quizzes_result]

        # Query 2: all questions using IN clause with string formatting
        # We build the IN clause manually to avoid SQLAlchemy UUID type issues
        quiz_ids_sql = ", ".join(f"'{qid}'" for qid in quiz_ids)
        questions_result = db.execute(sql_text(f"""
            SELECT id, quiz_id, question_text, explanation
            FROM questions
            WHERE quiz_id::text IN ({quiz_ids_sql})
        """)).mappings().all()

        if not questions_result:
            return [
                {
                    'id': str(q['id']),
                    'title': q['title'],
                    'description': q['description'],
                    'created_at': str(q['created_at']),
                    'difficulty': q.get('difficulty') or 'Medium',
                    'duration_minutes': q.get('duration_minutes') or 10,
                    'questions': [],
                    'question_count': 0,
                }
                for q in quizzes_result
            ]

        question_ids = [str(q['id']) for q in questions_result]

        # Query 3: all options using IN clause
        question_ids_sql = ", ".join(f"'{qid}'" for qid in question_ids)
        options_result = db.execute(sql_text(f"""
            SELECT question_id, option_text, is_correct
            FROM options
            WHERE question_id::text IN ({question_ids_sql})
            ORDER BY option_text
        """)).mappings().all()

        # Build options lookup: question_id -> list of options
        options_by_question: Dict[str, List] = {}
        for opt in options_result:
            qid = str(opt['question_id'])
            if qid not in options_by_question:
                options_by_question[qid] = []
            options_by_question[qid].append(dict(opt))

        # Build questions lookup: quiz_id -> list of questions
        questions_by_quiz: Dict[str, List] = {}
        for q in questions_result:
            qid = str(q['id'])
            quiz_id = str(q['quiz_id'])
            opts = options_by_question.get(qid, [])
            q_dict = {
                'id': qid,
                'question_text': q['question_text'],
                'explanation': q.get('explanation') or '',
                'options': [o['option_text'] for o in opts],
                'correct_option': next(
                    (o['option_text'] for o in opts if o['is_correct']), None
                ),
            }
            if quiz_id not in questions_by_quiz:
                questions_by_quiz[quiz_id] = []
            questions_by_quiz[quiz_id].append(q_dict)

        # Assemble final response
        quizzes = []
        for quiz in quizzes_result:
            quiz_id = str(quiz['id'])
            questions = questions_by_quiz.get(quiz_id, [])
            quizzes.append({
                'id': quiz_id,
                'title': quiz['title'],
                'description': quiz['description'],
                'created_at': str(quiz['created_at']),
                'difficulty': quiz.get('difficulty') or 'Medium',
                'duration_minutes': quiz.get('duration_minutes') or 10,
                'questions': questions,
                'question_count': len(questions),
            })

        return quizzes
    finally:
        db.close()


@app.get("/quizzes/{quiz_id}")
def get_quiz(quiz_id: str):
    """Get a single quiz with all its questions and options"""
    if not DB_AVAILABLE:
        _quiz_db_unavailable()
    db = SessionLocal()
    try:
        quiz_result = db.execute(sql_text("""
            SELECT id, title, description, created_at, difficulty, duration_minutes
            FROM quizzes2
            WHERE id = :id
        """), {"id": quiz_id}).mappings().first()

        if not quiz_result:
            raise HTTPException(status_code=404, detail="Quiz not found")

        quiz = dict(quiz_result)
        quiz['id'] = str(quiz['id'])

        questions_result = db.execute(sql_text("""
            SELECT id, question_text, explanation
            FROM questions
            WHERE quiz_id = :quiz_id
        """), {"quiz_id": quiz_id}).mappings().all()

        questions = []
        for question in questions_result:
            q_dict = dict(question)
            q_dict['id'] = str(q_dict['id'])

            options_result = db.execute(sql_text("""
                SELECT option_text, is_correct
                FROM options
                WHERE question_id = :question_id
                ORDER BY option_text
            """), {"question_id": question['id']}).mappings().all()

            q_dict['options'] = [opt['option_text'] for opt in options_result]
            q_dict['correct_option'] = next(
                (opt['option_text'] for opt in options_result if opt['is_correct']),
                None
            )
            questions.append(q_dict)

        quiz['questions'] = questions
        return quiz
    finally:
        db.close()


@app.post("/attempts/start")
def start_attempt(attempt: QuizAttemptCreate):
    if not DB_AVAILABLE:
        _quiz_db_unavailable()
    db = SessionLocal()
    try:
        attempt_id = str(uuid.uuid4())
        db.execute(
            sql_text("INSERT INTO quiz_attempts (id, user_id, quiz_id, score, created_at) VALUES (:id, :user_id, :quiz_id, 0, NOW())"),
            {"id": attempt_id, "user_id": attempt.user_id, "quiz_id": attempt.quiz_id}
        )
        db.commit()
        return {"attempt_id": attempt_id, "message": "Attempt started"}
    finally:
        db.close()


@app.post("/attempts/complete")
def complete_attempt(completion: QuizAttemptComplete):
    if not DB_AVAILABLE:
        _quiz_db_unavailable()
    db = SessionLocal()
    try:
        db.execute(
            sql_text("UPDATE quiz_attempts SET score = :score WHERE id = :attempt_id"),
            {"attempt_id": completion.attempt_id, "score": completion.score}
        )
        db.commit()
        return {"message": "Attempt completed", "score": completion.score}
    finally:
        db.close()


@app.get("/attempts/{user_id}")
def get_user_attempts(user_id: str):
    if not DB_AVAILABLE:
        _quiz_db_unavailable()
    db = SessionLocal()
    try:
        result = db.execute(
            sql_text("""
                SELECT qa.id, qa.quiz_id, qa.score, qa.created_at, q.title, q.description
                FROM quiz_attempts qa
                JOIN quizzes2 q ON qa.quiz_id = q.id
                WHERE qa.user_id = :user_id
                ORDER BY qa.created_at DESC
            """),
            {"user_id": user_id}
        ).mappings().all()

        attempts = []
        for row in result:
            attempt_dict = dict(row)
            attempt_dict['id'] = str(attempt_dict['id'])
            attempt_dict['quiz_id'] = str(attempt_dict['quiz_id'])
            question_count = db.execute(
                sql_text("SELECT COUNT(*) FROM questions WHERE quiz_id = :quiz_id"),
                {"quiz_id": row['quiz_id']}
            ).scalar()
            attempt_dict['total_questions'] = question_count
            attempts.append(attempt_dict)

        return attempts
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")