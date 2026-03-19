# optimizations.py
"""
Optimization strategies for accuracy, runtime, and quality:

1. RESULT RE-RANKING: Score results by relevance, filter low-confidence
2. QUERY OPTIMIZATION: Expand queries, better case detection
3. CACHING: Cache BM25 index, embeddings model, query results
4. CHUNK SIZE: Reduce chunk overlap, optimize granularity
5. PARALLEL EMBEDDINGS: Generate embeddings in parallel for new PDFs
"""

import os
import pickle
import hashlib
import re
from typing import List, Dict, Tuple

CACHE_DIR = ".query_cache"
BM25_CACHE_FILE = ".bm25_index.pkl"
CACHE_VERSION = "v2"

STOPWORDS = {
    "the", "is", "are", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "by",
    "what", "how", "when", "where", "which", "who", "whom", "why", "under", "between", "from",
    "law", "legal"
}

LEGAL_ACRONYM_MAP = {
    "cpc": "criminal procedure code sri lanka",
    "evidence ord": "evidence ordinance sri lanka",
    "evidence ordinance": "evidence ordinance sri lanka",
    "penal code": "penal code sri lanka",
    "constitution": "constitution of sri lanka",
}


def canonicalize_legal_query(query: str) -> str:
    """
    Expand legal shorthand and normalize section references for stronger lexical/semantic retrieval.
    Example: "What does s.45 say in CPC?" -> "what does section 45 say in criminal procedure code sri lanka"
    """
    normalized = (query or "").strip().lower()
    if not normalized:
        return query

    # Normalize section shorthand: s.45 / s 45 -> section 45
    normalized = re.sub(r"\bs\.?\s*(\d+[a-zA-Z0-9-]*)\b", r"section \1", normalized)

    for short_form, expanded in LEGAL_ACRONYM_MAP.items():
        normalized = re.sub(rf"\b{re.escape(short_form)}\b", expanded, normalized)

    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def extract_query_terms(query: str) -> List[str]:
    """Normalize and extract meaningful query terms for scoring/BM25."""
    tokens = re.findall(r"[a-zA-Z]{3,}", query.lower())
    terms = [t for t in tokens if t not in STOPWORDS]
    return list(dict.fromkeys(terms))

def ensure_cache_dir():
    """Create cache directory if missing"""
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)

def cache_query_result(query: str, results: List[Dict]) -> None:
    """Cache retrieval results by query hash"""
    ensure_cache_dir()
    normalized_query = query.strip().lower()
    cache_key = f"{CACHE_VERSION}:{normalized_query}"
    query_hash = hashlib.md5(cache_key.encode()).hexdigest()
    cache_file = os.path.join(CACHE_DIR, f"{query_hash}.pkl")
    try:
        with open(cache_file, "wb") as f:
            pickle.dump(results, f)
    except Exception:
        pass  # Silent fail - cache not critical

def get_cached_query_result(query: str) -> List[Dict] | None:
    """Retrieve cached results by query hash"""
    ensure_cache_dir()
    normalized_query = query.strip().lower()
    cache_key = f"{CACHE_VERSION}:{normalized_query}"
    query_hash = hashlib.md5(cache_key.encode()).hexdigest()
    cache_file = os.path.join(CACHE_DIR, f"{query_hash}.pkl")
    try:
        if os.path.exists(cache_file):
            with open(cache_file, "rb") as f:
                return pickle.load(f)
    except Exception:
        pass
    return None

def is_valid_query(query: str) -> bool:
    """
    Validate if input is a real query (not a command or garbage).
    
    Rejects:
    - Commands (starts with ./ or contains .exe, .py, .bat)
    - File paths (contains backslash or forward slash)
    - Very short inputs (< 3 chars)
    - Only special characters
    """
    query = query.strip()
    
    # Too short
    if len(query) < 3:
        return False
    
    # Command patterns
    if any(pattern in query.lower() for pattern in [".exe", ".py", ".bat", ".ps1", ".sh", "python", "powershell"]):
        return False
    
    # File path patterns
    if query.startswith((".\\", "./", "C:\\", "/")) or "\\" in query[:20]:
        return False
    
    # Only special characters (no letters)
    if not any(c.isalpha() for c in query):
        return False
    
    return True

def score_result_relevance(result: Dict, query: str) -> float:
    """
    Score result relevance (0.0 to 1.0).
    Higher = more relevant.
    
    Factors:
    - Query term presence in text (exact + partial matches)
    - Text length (prefer substantive content)
    - Metadata quality (prefer complete citations)
    """
    text = result.get("text", "").lower()
    query_lower = query.lower()
    
    score = 0.0
    
    # Exact phrase match (highest score)
    if query_lower in text:
        score += 0.6  # Increased from 0.5
    
    # Individual term matches (more weight)
    terms = extract_query_terms(query)
    if terms:
        matched_terms = 0
        text_tokens = set(re.findall(r"[a-zA-Z]{3,}", text))
        for term in terms:
            if term in text_tokens or term in text:
                matched_terms += 1
        term_ratio = matched_terms / len(terms)
        score += 0.4 * term_ratio  # Increased from 0.3
    
    # Text length bonus (prefer substantial chunks)
    text_words = len(text.split())
    if text_words >= 100:
        score += 0.05  # Reduced from 0.1 to prioritize content match
    elif text_words >= 50:
        score += 0.02
    
    return min(1.0, score)

def filter_results_by_threshold(results: List[Dict], query: str, threshold: float = 0.18) -> List[Dict]:
    """
    Filter results by relevance score threshold.
    Default 0.25 = keep results with at least some relevance.
    """
    scored = [(r, score_result_relevance(r, query)) for r in results]
    
    # Sort by score (highest first)
    scored.sort(key=lambda x: x[1], reverse=True)
    
    # Filter and return
    filtered = [r for r, score in scored if score >= threshold]

    # Safety net: avoid false "not found" for valid semantic hits
    if not filtered and scored:
        top = [r for r, score in scored[:3] if score > 0]
        if top:
            return top

    return filtered

def expand_case_query(query: str) -> List[str]:
    """
    Expand case queries with variations:
    - "Smith v. Jones" → ["Smith v. Jones", "Smith v Jones", "smith vs jones"]
    - Helps catch formatting variations in OCR'd text
    """
    variants = [query]
    
    # Try v. → v → vs variations
    if " v. " in query:
        variants.append(query.replace(" v. ", " v "))
        variants.append(query.replace(" v. ", " vs "))
        variants.append(query.replace(" v. ", " vs. "))
    elif " vs " in query and " vs. " not in query:
        variants.append(query.replace(" vs ", " v. "))
        variants.append(query.replace(" vs ", " v "))
    
    # Try lowercase for OCR
    variants.append(query.lower())
    
    return list(set(variants))

def cache_bm25_index(bm25_model, corpus: List[str], documents: List[Dict]) -> None:
    """Cache BM25 index to disk to avoid rebuilding"""
    try:
        data = {
            "bm25": bm25_model,
            "corpus": corpus,
            "documents": documents,
        }
        with open(BM25_CACHE_FILE, "wb") as f:
            pickle.dump(data, f)
    except Exception:
        pass  # Silent fail

def load_bm25_index() -> Tuple | None:
    """Load cached BM25 index from disk"""
    try:
        if os.path.exists(BM25_CACHE_FILE):
            with open(BM25_CACHE_FILE, "rb") as f:
                data = pickle.load(f)
                return data["bm25"], data["corpus"], data["documents"]
    except Exception:
        pass
    return None

# Optimal settings (tuned for legal documents)
OPTIMIZED_SETTINGS = {
    "chunk_size": 250,          # Reduced from 300 for more specific chunks
    "chunk_overlap": 25,        # Reduced from 50 to save space
    "retrieval_top_k": 5,       # Top 5 before filtering
    "result_threshold": 0.18,   # Better recall for natural-language legal questions
    "vector_weight": 0.6,       # 60% semantic
    "bm25_weight": 0.4,         # 40% keyword (good for cases)
    "parallel_workers": 4,      # For embedding generation
    "cache_enabled": True,      # Enable query caching
    "null_result_threshold": 0.18,  # Match result_threshold; avoids premature null-refusal
    "recency_weight": 0.103,
}
