import types
from typing import Any

from agent.nyaya_agent import NyayaAgent
from agent.guardrails import LegalGuardrails, SafetyFilter, CitationValidator


class DummyGraph:
    def get_precedent_history(self, case_name, limit=10):
        return []

    def get_cited_cases(self, case_name, limit=10):
        return []

    def get_top_related_precedents(self, case_name, limit=3):
        return []

    def get_temporal_warnings(self, case_name, limit=10):
        return []

    def get_query_precedent_chain(self, query, limit=1):
        return []

    def get_most_cited(self, limit=50):
        return []


class DummyRetriever:
    def __init__(self, docs):
        self.docs = docs

    def search(self, query, top_k=3, return_metadata=True):
        return self.docs


def build_agent(docs):
    agent: Any = NyayaAgent.__new__(NyayaAgent)
    agent.graph = DummyGraph()
    agent.show_debug = False
    agent.guardrails = LegalGuardrails()
    agent.safety_filter = SafetyFilter()
    agent.citation_validator = CitationValidator()
    agent.retriever = DummyRetriever(docs)
    agent.last_llm_error = None
    return agent


def test_unsafe_query_blocked():
    agent = build_agent([])
    report: Any = agent.ask_with_report("How to evade tax legally?", debug_mode=False)
    assert report["status"] == "blocked"
    assert "cannot provide advice" in report["answer"].lower()


def test_null_result_refusal_triggered():
    docs = [
        {
            "text": "This document chunk discusses unrelated court procedures and filing mechanics without substantive statutory content for the asked topic.",
            "pdf_name": "x.pdf",
            "page": 1,
            "section": "misc",
            "retrieval_score": 0.10,
        }
    ]
    agent = build_agent(docs)
    report: Any = agent.ask_with_report("What is the statute for interplanetary marriage in Sri Lanka?")
    assert report["status"] == "insufficient_evidence"
    assert "found no specific sri lankan statutory or case law" in report["answer"].lower()


def test_temporal_warning_is_exposed():
    agent = build_agent(
        [
            {
                "text": "Section 45 of the Evidence Ordinance applies in this context.",
                "pdf_name": "evidence.pdf",
                "page": 45,
                "section": "45",
                "retrieval_score": 0.9,
            }
        ]
    )

    class WarningGraph(DummyGraph):
        def get_temporal_warnings(self, case_name, limit=10):
            return [{"case": "abc v. def", "status": "overruled"}]

    agent.graph = WarningGraph()
    agent._generate_with_llm = types.MethodType(lambda self, prompt: "Section 45 is relevant. (Source: evidence.pdf, Page 45, Section 45, Lines 1-2)", agent)

    report: Any = agent.ask_with_report("Alpha v. Beta")
    assert report["status"] == "success"
    assert report["reflection_report"].get("temporal_warnings")
    assert "temporal warning" in report["answer"].lower()


def test_fallback_behavior_when_llm_fails():
    docs = [
        {
            "text": "Burden of proof in criminal law requires beyond reasonable doubt.",
            "pdf_name": "criminal.pdf",
            "page": 10,
            "section": "proof",
            "retrieval_score": 0.8,
        }
    ]
    agent = build_agent(docs)

    def raise_llm(self, prompt):
        raise RuntimeError("No LLM configured")

    agent._generate_with_llm = types.MethodType(raise_llm, agent)

    report: Any = agent.ask_with_report("burden of proof in criminal law")
    assert report["status"] == "fallback"
    assert "llm not configured" in report["answer"].lower()
