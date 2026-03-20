from pipeline.ingestion import _iter_pdf_files


def test_iter_pdf_files_finds_nested_year_folders(tmp_path):
    pdf_root = tmp_path / "pdfs"
    (pdf_root / "2024").mkdir(parents=True)
    (pdf_root / "2025" / "appeals").mkdir(parents=True)

    (pdf_root / "2024" / "alpha.pdf").write_bytes(b"%PDF-1.4\n")
    (pdf_root / "2025" / "appeals" / "beta.PDF").write_bytes(b"%PDF-1.4\n")
    (pdf_root / "notes.txt").write_text("ignore me", encoding="utf-8")

    files = list(_iter_pdf_files(str(pdf_root)))

    assert files == [
        {
            "pdf_path": str(pdf_root / "2024" / "alpha.pdf"),
            "display_name": "alpha.pdf",
            "relative_path": "2024/alpha.pdf",
            "year_folder": "2024",
        },
        {
            "pdf_path": str(pdf_root / "2025" / "appeals" / "beta.PDF"),
            "display_name": "beta.PDF",
            "relative_path": "2025/appeals/beta.PDF",
            "year_folder": "2025",
        },
    ]