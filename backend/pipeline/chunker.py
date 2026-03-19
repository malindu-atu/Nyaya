import re

def logical_chunking(text):
    # Split by paragraph numbers like [1], 1., etc.
    pattern = r"\n\s*(\[\d+\]|\d+\.)"

    splits = re.split(pattern, text)

    chunks = []
    current_chunk = ""

    for part in splits:
        if re.match(r"(\[\d+\]|\d+\.)", part):
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = part
        else:
            current_chunk += " " + part

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks
