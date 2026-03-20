
from neo4j import GraphDatabase
from config import URI, USER, PASSWORD
import re
import time

from neo4j.exceptions import ServiceUnavailable
from difflib import SequenceMatcher


def clean_case_name(raw_name):
    """
    Extract canonical case name in the form: Party1 v. Party2.
    Limits to 1-4 words per party and removes trailing junk tokens.
    Returns the cleaned case name if found, otherwise returns the original string.
    """
    if not raw_name:
        return raw_name
    pattern = r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+v\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})"
    match = re.search(pattern, raw_name, re.IGNORECASE)
    if match:
        left = _clean_party_name(match.group(1).strip())
        right = _clean_party_name(match.group(2).strip())
        if left and right:
            return f"{left.title()} v. {right.title()}"
    return raw_name


def extract_metadata_from_text(text):
    """
    Extract case metadata (year, court, citation, stage) from text.
    Returns dict with extracted fields.
    """
    metadata = {
        "year": None,
        "court": None,
        "citation": None,
        "stage": None,
        "volume": None,
        "status": "Unknown",
    }
    
    # Extract year (4-digit numbers between 1900-2099)
    year_match = re.search(r'\b(19|20)\d{2}\b', text)
    if year_match:
        metadata["year"] = int(year_match.group(0))  # type: ignore
    
    # Extract court abbreviations (SC, CA, D.C., etc.)
    court_patterns = [
        r'\bS\.C\.',  # Supreme Court
        r'\bCA\b',    # Court of Appeal
        r'\bD\.C\.',  # District Court
        r'\bHC\b',    # High Court
        r'\bPC\b',    # Privy Council
    ]
    for pattern in court_patterns:
        if re.search(pattern, text):
            metadata["court"] = pattern.replace(r'\b', '').replace(r'\\b', '').replace('.', '')  # type: ignore
            break
    
    # Extract procedural stage
    stage_keywords = {
        "appeal": r'\b(appeal|appellate)\b',
        "interlocutory": r'\binterlocutory\b',
        "revision": r'\brevision\b',
        "writ": r'\bwrit\b',
        "leave": r'\bleave\b',
    }
    for stage, pattern in stage_keywords.items():
        if re.search(pattern, text, re.IGNORECASE):
            metadata["stage"] = stage  # type: ignore
            break
    
    # Extract volume number (e.g., "79 NLR" or "Vol. 79")
    vol_match = re.search(r'(?:vol\.?\s*)?(\d{1,3})\s*(?:NLR|SLR|LR)\b', text, re.IGNORECASE)
    if vol_match:
        metadata["volume"] = int(vol_match.group(1))  # type: ignore
    
    # Extract citation (e.g., "79 NLR 123")
    citation_match = re.search(r'(\d{1,3}\s+(?:NLR|SLR|LR)\s+\d{1,4})', text)
    if citation_match:
        metadata["citation"] = citation_match.group(1)  # type: ignore

    # Heuristic case status extraction for temporal validation.
    lowered = text.lower()
    if re.search(r'\boverruled\b|\boverturned\b|\breversed\b', lowered):
        metadata["status"] = "Overruled"
    elif re.search(r'\bamended\b|\bmodified\b', lowered):
        metadata["status"] = "Amended"
    elif re.search(r'\bupheld\b|\baffirmed\b', lowered):
        metadata["status"] = "Active"
    
    return metadata


def normalize_title(title):
    if not title:
        return None
    # Pre-clean to canonical Party1 v. Party2 when possible
    title = clean_case_name(title)
    # Lowercase
    title = title.lower().strip()

    # Remove extra spaces
    title = re.sub(r"\s+", " ", title)

    # Normalize v / vs variations
    title = re.sub(r"\bvs?\b\.?", "v.", title)
    title = re.sub(r"\bv\s*\.\s*", "v. ", title)
    title = re.sub(r"\bv\s+", "v. ", title)
    
    # Fix multiple dots
    title = re.sub(r"\.{2,}", ".", title)
    title = re.sub(r"v\.\s*\.", "v.", title)

    # Remove strange characters (keep alphanumeric, spaces, dots)
    title = re.sub(r"[^a-z0-9.\s]", "", title)
    
    # Collapse repeated characters (OCR noise) - reduce 3+ repeats to 2
    title = re.sub(r"([a-z])\1{2,}", r"\1\1", title)
    
    # Remove orphaned dots
    title = re.sub(r"\s+\.", ".", title)
    title = re.sub(r"^\.", "", title)
    
    # Strip trailing punctuation
    title = re.sub(r"[.\s]+$", "", title)

    return title.strip()


def normalize_citation_text(text):
    if not text:
        return ""
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)
    # Normalize v/vs variants (case-insensitive)
    text = re.sub(r"\bvs?\b\.?", "v.", text, flags=re.IGNORECASE)
    # Fix spaced dots like "v ." or "v. ."
    text = re.sub(r"v\s*\.\s*", "v. ", text, flags=re.IGNORECASE)
    text = re.sub(r"\.\s*\.", ". ", text)
    return text


_STOP_TOKENS = {
    "the", "a", "an", "and", "of", "in", "for", "on", "to", "with", "by",
    "from", "at", "as", "is", "was", "were", "be", "been", "being",
    "that", "this", "these", "those", "there", "here", "it", "their",
    "his", "her", "its", "which", "who", "whom", "where", "when", "then",
    "however", "therefore", "thus", "hence", "said", "see", "vide", "per",
    "case", "cases", "reported", "report", "vol", "volume"
}

_TAIL_JUNK = {
    "judge", "judges", "magistrate", "magistrates", "court", "courts",
    "district", "province", "board", "council", "commission", "commissioner",
    "commissioners", "department", "secretary", "minister", "ministry",
    "attorney", "general", "public", "prosecution", "prosecutions",
    "inspector", "assistant", "deputy", "president", "chairman", "chair",
    "director", "officer", "revenue", "inland", "land", "reform",
    "ordinance", "order", "tribunal", "authority", "corporation",
    "company", "co", "ltd", "limited", "bank", "board", "municipal",
    "transport", "railway", "railways", "police", "state", "republic",
    "crown", "queen", "king", "emperor", "empress",
    "counsel", "learned", "declaration", "declaratory", "petition",
    "application", "appeal", "revision", "writ", "interlocutory"
}


def _clean_party_name(name):
    if not name:
        return ""
    # Keep letters, numbers, spaces, ampersand, and dots
    name = re.sub(r"[^A-Za-z0-9&.\s]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        return ""
    tokens = name.split()
    cleaned = []
    for tok in tokens:
        low = tok.lower().strip(".")
        if low in _STOP_TOKENS:
            continue
        # Drop single-letter tokens (OCR noise)
        if len(low) == 1:
            continue
        # Skip tokens that are purely numbers
        if re.match(r"^[0-9]+$", low):
            continue
        # Skip highly corrupted tokens (>50% non-alphabetic)
        alpha_ratio = len([c for c in low if c.isalpha()]) / max(len(low), 1)
        if alpha_ratio < 0.5:
            continue
        cleaned.append(tok)
    # Trim trailing legal-role junk words
    while cleaned and cleaned[-1].lower().strip(".") in _TAIL_JUNK:
        cleaned.pop()
    # Limit to main parties (2-4 tokens max)
    if len(cleaned) > 4:
        cleaned = cleaned[:4]
    # Require minimum meaningful content
    if not cleaned or len(" ".join(cleaned)) < 4:
        return ""
    return " ".join(cleaned)


def _is_valid_case_name(left, right):
    if not left or not right:
        return False
    if len(re.findall(r"[A-Za-z]", left)) < 2:
        return False
    if len(re.findall(r"[A-Za-z]", right)) < 2:
        return False
    return True


def _normalize_key(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    # Collapse long character repeats (OCR noise)
    text = re.sub(r"([a-z])\1{2,}", r"\1\1", text)
    tokens = [t for t in text.split() if len(t) > 1 and t not in _STOP_TOKENS]
    return " ".join(tokens)


def _token_jaccard(a, b):
    a_set = set(a.split())
    b_set = set(b.split())
    if not a_set or not b_set:
        return 0.0
    return len(a_set & b_set) / len(a_set | b_set)


def _similar(a, b):
    return SequenceMatcher(None, a, b).ratio()


def _split_citation(citation):
    parts = citation.split(" v. ")
    if len(parts) != 2:
        return None, None
    return parts[0].strip(), parts[1].strip()


def dedupe_citations(citations, similarity_threshold=0.88):
    """
    Merge near-duplicate citations (OCR variants) using per-party fuzzy
    similarity. Returns list of canonical citation strings.
    """
    canonical = []
    canonical_pairs = []

    for citation in citations:
        left, right = _split_citation(citation)
        if not left or not right:
            continue
        left_key = _normalize_key(left)
        right_key = _normalize_key(right)
        if not left_key or not right_key:
            continue

        merged = False
        for (cl, cr, cl_key, cr_key) in canonical_pairs:
            left_sim = max(_similar(left_key, cl_key), _token_jaccard(left_key, cl_key))
            right_sim = max(_similar(right_key, cr_key), _token_jaccard(right_key, cr_key))
            if left_sim >= similarity_threshold and right_sim >= similarity_threshold:
                merged = True
                break

        if not merged:
            canonical.append(citation)
            canonical_pairs.append((left, right, left_key, right_key))

    return canonical


def extract_citations_from_text(text):
    """
    Strictly extract case citations using proper name pattern.
    Only captures: [Proper Name(s) v. Proper Name(s)]
    Ignores OCR garbage like "learned counsel", "path iran", etc.
    """
    normalized_text = normalize_citation_text(text)
    
    # Strict pattern: only proper names (capitalized words) before/after v.
    # Captures 1-4 capitalized words per party (typical legal case format)
    pattern = r'\b([A-Z][a-z]*(?:\s+[A-Z][a-z]*){0,3}?)\s+v\.\s+([A-Z][a-z]*(?:\s+[A-Z][a-z]*){0,3}?)(?=\s|$|[,.])'
    
    matches = re.findall(pattern, normalized_text)
    citations = []
    
    for left, right in matches:
        # Skip if either side is too short or too long
        if len(left) < 3 or len(right) < 3:
            continue
        if len(left) > 60 or len(right) > 60:
            continue
        
        left_clean = _clean_party_name(left)
        right_clean = _clean_party_name(right)
        
        if not _is_valid_case_name(left_clean, right_clean):
            continue
        
        # More restrictive length limits (2-4 words per party)
        if len(left_clean.split()) > 4 or len(right_clean.split()) > 4:
            continue
        
        # Build citation with cleaned names
        citation = f"{left_clean} v. {right_clean}"
        citations.append(citation)
    
    return citations

    


driver = GraphDatabase.driver(
    URI,
    auth=(USER, PASSWORD),
    max_connection_lifetime=1000,  # seconds
    connection_timeout=60,         # seconds

)

def create_case_node(title, text=None):
    """
    Create a case node with metadata extracted from text.
    """
    normalized = normalize_title(title)
    if not normalized:
        return

    # Extract metadata if text is provided
    metadata = extract_metadata_from_text(text) if text else {}

    for attempt in range(3):  # Retry up to 3 times
        try:
            with driver.session() as session:
                session.run("""
                    MERGE (c:Case {title: $title})
                    SET c.year = COALESCE(c.year, $year),
                        c.court = COALESCE(c.court, $court),
                        c.citation = COALESCE(c.citation, $citation),
                        c.stage = COALESCE(c.stage, $stage),
                        c.volume = COALESCE(c.volume, $volume),
                        c.status = COALESCE(c.status, $status)
                """, 
                title=normalized,
                year=metadata.get("year"),
                court=metadata.get("court"),
                citation=metadata.get("citation"),
                stage=metadata.get("stage"),
                volume=metadata.get("volume"),
                status=metadata.get("status")
                )
            break  # success
        except ServiceUnavailable:
            print(f"Service unavailable, retrying {attempt+1}/3...")
            time.sleep(2)

def create_citation_relationships(text, pdf_name, chunks=None):
    normalized_source = normalize_title(pdf_name)
    if not normalized_source:
        return

    citations = []
    if chunks:
        for chunk in chunks:
            citations.extend(extract_citations_from_text(chunk))
    else:
        citations = extract_citations_from_text(text)

    # De-duplicate and merge near-duplicates
    for citation in dedupe_citations(sorted(set(citations))):
        normalized_citation = normalize_title(citation)
        if not normalized_citation:
            continue
        
        # Extract metadata for the cited case
        metadata = extract_metadata_from_text(text)
        
        for attempt in range(3):
            try:
                with driver.session() as session:
                    # Create/merge cited case with metadata
                    session.run("""
                        MERGE (cited:Case {title: $citation})
                        SET cited.year = COALESCE(cited.year, $year),
                            cited.court = COALESCE(cited.court, $court),
                            cited.citation = COALESCE(cited.citation, $citation_str),
                            cited.stage = COALESCE(cited.stage, $stage),
                            cited.volume = COALESCE(cited.volume, $volume)
                        WITH cited
                        MATCH (source:Case {title: $pdf})
                        MERGE (source)-[:CITES]->(cited)
                    """, 
                    citation=normalized_citation, 
                    pdf=normalized_source,
                    year=metadata.get("year"),
                    court=metadata.get("court"),
                    citation_str=metadata.get("citation"),
                    stage=metadata.get("stage"),
                    volume=metadata.get("volume")
                    )
                break
            except ServiceUnavailable:
                print(f"Service unavailable, retrying citation '{citation}'...")
                time.sleep(2)
