from agent.retriever import _is_sc_doc
from optimizations import OPTIMIZED_SETTINGS


def test_is_sc_doc_accepts_pdf_name_prefix():
    assert _is_sc_doc({"pdf_name": "sc_appeal_12_2020.pdf"}) is True


def test_is_sc_doc_accepts_source_path_filename_prefix():
    assert _is_sc_doc({"source_path": "2025/sc_fr_116_2021.pdf"}) is True


def test_is_sc_doc_rejects_nlr_documents():
    assert _is_sc_doc({"pdf_name": "New-Law-Report-Vol-80.pdf"}) is False
    assert _is_sc_doc({"source_path": "nlr/New-Law-Report-Vol-80.pdf"}) is False


def test_null_result_threshold_not_stricter_than_result_threshold():
    assert OPTIMIZED_SETTINGS["null_result_threshold"] <= OPTIMIZED_SETTINGS["result_threshold"]
