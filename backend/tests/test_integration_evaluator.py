from evaluate import NyayaEvaluator


class StubAgent:
    def ask_with_report(self, question, debug_mode=False):
        return {
            "answer": "The court applied mens rea principles and cited relevant appeal authority.",
            "status": "success",
        }


class StubRetriever:
    def search(self, query, top_k=10, return_metadata=True):
        return [
            {
                "text": "Mens rea principles were applied by the Supreme Court in this appeal.",
                "pdf_name": "sc_appeal_200_2020.pdf",
                "source_path": "2020/sc_appeal_200_2020.pdf",
                "page": 12,
                "section": "Criminal",
            }
        ]


def test_run_single_test_end_to_end_with_stubs():
    evaluator = NyayaEvaluator.__new__(NyayaEvaluator)
    evaluator.agent = StubAgent()
    evaluator.retriever = StubRetriever()

    test_case = {
        "id": 999,
        "category": "Semantic_Legal",
        "question": "Explain mens rea",
        "expected_pdf": "sc_appeal_*.pdf",
    }

    result = evaluator.run_single_test(test_case)

    assert result["status"] == "PASSED"
    assert result["recall_at_5"] is True
    assert 0.0 <= result["answer_groundedness"] <= 1.0
