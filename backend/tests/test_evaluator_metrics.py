from evaluate import NyayaEvaluator


class StubRetriever:
    def __init__(self, results):
        self.results = results

    def search(self, query, top_k=10, return_metadata=True):
        return self.results


def _evaluator_with_retriever(results):
    evaluator = NyayaEvaluator.__new__(NyayaEvaluator)
    evaluator.retriever = StubRetriever(results)
    return evaluator


def test_word_overlap_detects_paraphrase_overlap():
    sentence = "The court held mens rea includes intention and recklessness"
    chunk = "In criminal appeals, mens rea means intention, knowledge, or recklessness by the accused."
    score = NyayaEvaluator._word_overlap(sentence, chunk)
    assert score >= 0.28


def test_answer_groundedness_counts_grounded_sentences():
    evaluator = _evaluator_with_retriever([])
    answer = "Mens rea includes intention. Res judicata prevents relitigation."
    chunks = [
        {"text": "Mens rea includes intention and knowledge in criminal law."},
        {"text": "Unrelated content about tax filing dates."},
    ]
    groundedness = evaluator.answer_groundedness(answer, chunks)
    assert 0.45 <= groundedness <= 0.55


def test_recall_matches_pdf_name_and_source_path_filename():
    evaluator = _evaluator_with_retriever(
        [
            {"pdf_name": "", "source_path": "2024/sc_appeal_110_2015.pdf"},
            {"pdf_name": "sc_fr_90_2019.pdf", "source_path": "2024/sc_fr_90_2019.pdf"},
        ]
    )

    assert evaluator.recall_at_5("dummy", "sc_appeal_*.pdf") is True
    assert evaluator.recall_at_5("dummy", "sc_fr_*.pdf") is True
    assert evaluator.recall_at_5("dummy", "sc_spl_la_*.pdf") is False
