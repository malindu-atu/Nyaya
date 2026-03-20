# chunk_pdf.py
import re

def chunk_text(text, chunk_size=300, overlap=50):
    """
    Logical semantic chunking for law reports:
    - Splits by paragraphs (handles both single and double newlines)
    - Merges paragraphs into chunks of ~chunk_size words
    - Adds optional overlap for context
    """
    # Normalize newlines
    text = re.sub(r'\n+', '\n', text).strip()
    
    # Try double newline split first, fallback to single newline
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paragraphs) < 2:
        # No double newlines found, split by single newline
        paragraphs = [p.strip() for p in text.split("\n") if p.strip() and len(p.strip()) > 20]
    
    if not paragraphs:
        # Last resort: split into fixed-size word chunks
        words = text.split()
        paragraphs = [" ".join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)]
    
    chunks = []
    current_chunk = []

    for para in paragraphs:
        words_in_current = sum(len(p.split()) for p in current_chunk)
        words_in_para = len(para.split())

        if words_in_current + words_in_para <= chunk_size:
            current_chunk.append(para)
        else:
            # finalize current chunk
            if current_chunk:
                chunks.append(" ".join(current_chunk))
            
            # start new chunk with overlap
            if overlap > 0 and current_chunk:
                # take last 'overlap' words from previous chunk
                overlap_words = []
                for p in reversed(current_chunk):
                    overlap_words = p.split() + overlap_words
                    if len(overlap_words) >= overlap:
                        break
                overlap_text = " ".join(overlap_words[-overlap:])
                current_chunk = [overlap_text, para]
            else:
                current_chunk = [para]

    # append remaining chunk
    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def _infer_section(lines, line_index):
    for i in range(line_index, -1, -1):
        line = lines[i].strip()
        if not line:
            continue
        if re.match(r"^(section|sec\.|chapter)\b", line, re.IGNORECASE):
            return line
        if re.match(r"^\d+(\.\d+)*\s+\S+", line):
            return line
        if line.isupper() and len(line.split()) <= 12:
            return line
    return "Unknown"


def chunk_pages_with_metadata(pages, pdf_name, chunk_size=300, overlap=50, extra_metadata=None):
    """
    Chunk per-page text while preserving metadata for citations.
    Returns list of dicts: text + source metadata.
    """
    chunks = []
    extra_metadata = extra_metadata or {}

    for page in pages:
        page_number = page.get("page_number")
        if page_number is None:
            page_number = -1
        text = page["text"]

        lines = [line.strip() for line in text.split("\n") if line.strip()]
        if not lines:
            continue

        current_lines = []
        current_word_count = 0

        for idx, line in enumerate(lines):
            line_words = line.split()
            if current_word_count + len(line_words) <= chunk_size:
                current_lines.append((idx, line))
                current_word_count += len(line_words)
            else:
                if current_lines:
                    line_start = current_lines[0][0] + 1
                    line_end = current_lines[-1][0] + 1
                    section = _infer_section(lines, current_lines[0][0])
                    chunk_text_value = " ".join([l for _, l in current_lines])
                    chunks.append({
                        "text": chunk_text_value,
                        "pdf_name": pdf_name,
                        "page": page_number,
                        "section": section,
                        "line_start": line_start,
                        "line_end": line_end,
                        **extra_metadata,
                    })

                if overlap > 0 and current_lines:
                    overlap_words = []
                    overlap_lines = []
                    for line_idx, line_value in reversed(current_lines):
                        overlap_words = line_value.split() + overlap_words
                        overlap_lines.append((line_idx, line_value))
                        if len(overlap_words) >= overlap:
                            break
                    current_lines = list(reversed(overlap_lines))
                    current_word_count = len(overlap_words)
                else:
                    current_lines = []
                    current_word_count = 0

                current_lines.append((idx, line))
                current_word_count += len(line_words)

        if current_lines:
            line_start = current_lines[0][0] + 1
            line_end = current_lines[-1][0] + 1
            section = _infer_section(lines, current_lines[0][0])
            chunk_text_value = " ".join([l for _, l in current_lines])
            chunks.append({
                "text": chunk_text_value,
                "pdf_name": pdf_name,
                "page": page_number,
                "section": section,
                "line_start": line_start,
                "line_end": line_end,
                **extra_metadata,
            })

    return chunks
