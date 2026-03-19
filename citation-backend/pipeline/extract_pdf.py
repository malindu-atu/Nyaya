# extract_pdf.py

import fitz  # PyMuPDF
import re


def _clean_text(text):
    # Preprocessing to improve text quality
    # Remove excessive spaces
    text = re.sub(r" +", " ", text)
    # Fix broken line continuations (word-word\nword -> word-word word)
    text = re.sub(r"([a-z])-\s*\n\s*([a-z])", r"\1\2", text)
    # Join broken case names across lines
    text = re.sub(r"([A-Z][a-z]+)\s*\n\s*(v\.)", r"\1 \2", text)
    text = re.sub(r"(v\.)\s*\n\s*([A-Z][a-z]+)", r"\1 \2", text)
    # Normalize multiple dots
    text = re.sub(r"\.{2,}", ".", text)
    # Fix "v. ." to "v."
    text = re.sub(r"v\.\s*\.", "v.", text)
    return text


def extract_pages_from_pdf(pdf_path):
    """
    Extracts per-page text from a PDF for metadata-aware chunking.
    Returns a list of dicts with page_number and text.
    """
    doc = fitz.open(pdf_path)
    pages = []

    for page_number in range(len(doc)):
        page = doc[page_number]
        page_text = page.get_text("text")
        page_text = _clean_text(page_text)
        pages.append({"page_number": page_number + 1, "text": page_text})

    doc.close()
    return pages


def extract_text_from_pdf(pdf_path):
    """
    Extracts full text from a PDF file with preprocessing to clean OCR artifacts.
    """
    pages = extract_pages_from_pdf(pdf_path)
    full_text = "\n".join(page["text"] for page in pages)
    return full_text
