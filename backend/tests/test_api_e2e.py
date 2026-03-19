from fastapi.testclient import TestClient

import app


class StubAgent:
    def ask_with_report(self, question, debug_mode=False, history=None):
        if "batch-fail" in question:
            raise RuntimeError("forced failure")
        return {
            "answer": "Test answer",
            "status": "success",
            "source_map": [
                {
                    "paragraph_id": 1,
                    "pdf_name": "x.pdf",
                    "page": 1,
                    "section": "1",
                    "exact_quote": "test",
                    "qdrant_score": 0.8,
                }
            ],
            "precedent_chain": [],
            "groundedness_score": 0.8,
            "reflection_report": {},
            "latency_seconds": 0.2,
        }


def test_ask_e2e(monkeypatch):
    monkeypatch.setattr(app, "get_agent", lambda: StubAgent())
    client = TestClient(app.app)

    response = client.post("/ask", json={"question": "What is burden of proof?"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["source_map"][0]["exact_quote"] == "test"
    assert "x-request-id" in {k.lower() for k in response.headers.keys()}


def test_ask_batch_e2e(monkeypatch):
    monkeypatch.setattr(app, "get_agent", lambda: StubAgent())
    client = TestClient(app.app)

    response = client.post(
        "/ask-batch",
        json=[
            {"question": "first"},
            {"question": "second"},
        ],
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["status"] == "success"
