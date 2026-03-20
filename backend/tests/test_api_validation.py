from fastapi.testclient import TestClient

import app


class StubAgent:
    def ask_with_report(self, question, debug_mode=False):
        return {
            "answer": "ok",
            "status": "success",
            "source_map": [],
            "precedent_chain": [],
            "groundedness_score": 0.9,
            "reflection_report": {},
            "latency_seconds": 0.1,
        }


def test_ask_rejects_empty_question(monkeypatch):
    monkeypatch.setattr(app, "get_agent", lambda: StubAgent())
    client = TestClient(app.app)

    response = client.post("/ask", json={"question": "   "})
    assert response.status_code == 400
    assert "cannot be empty" in response.json()["detail"].lower()


def test_ask_rejects_invalid_query(monkeypatch):
    monkeypatch.setattr(app, "is_valid_query", lambda question: False)
    monkeypatch.setattr(app, "get_agent", lambda: StubAgent())
    client = TestClient(app.app)

    response = client.post("/ask", json={"question": "../../etc/passwd"})
    assert response.status_code == 400
    assert "invalid query" in response.json()["detail"].lower()


def test_health_has_cors_header_for_origin():
    client = TestClient(app.app)
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") in {"*", "http://localhost:3000"}
