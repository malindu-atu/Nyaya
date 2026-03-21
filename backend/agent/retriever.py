from sentence_transformers import SentenceTransformer
from config import QDRANT_COLLECTION
import hashlib
import os
import pickle
from dotenv import load_dotenv
load_dotenv()
from rank_bm25 import BM25Okapi
from optimizations import (
    get_cached_query_result,
    cache_query_result,
    filter_results_by_threshold,
    extract_query_terms,
    canonicalize_legal_query,
    OPTIMIZED_SETTINGS,
)
from common_utils import clean_text, create_qdrant_client
from resilience import CircuitBreaker, call_with_retry


SC_ONLY_MODE = os.getenv("RETRIEVER_SC_ONLY", "1").strip().lower() not in {"0", "false", "no"}
_RERANKER_ENABLED = os.getenv("NYAYA_RERANKER", "0").strip().lower() not in {"0", "false", "no"}

# Lazily loaded cross-encoder (only when NYAYA_RERANKER=1)
_cross_encoder = None

def _get_cross_encoder():
    global _cross_encoder
    if _cross_encoder is not None:
        return _cross_encoder
    try:
        from sentence_transformers import CrossEncoder  # type: ignore
        _cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", max_length=512)
        print("[OK] Cross-encoder re-ranker loaded (ms-marco-MiniLM-L-6-v2)")
    except Exception as exc:
        print(f"[WARNING] Cross-encoder unavailable, falling back to hybrid scores: {exc}")
        _cross_encoder = None
    return _cross_encoder


def _safe_year(value):
    try:
        year = int(value)
        if 1800 <= year <= 2100:
            return year
    except Exception:
        pass
    return None


def _recency_bonus(year, current_year=2026):
    if year is None:
        return 0.0
    age = max(current_year - year, 0)
    # Smooth decay: newer authorities get a mild ranking bonus.
    return 1.0 / (1.0 + (age / 10.0))


def _is_sc_pdf(pdf_name: str | None) -> bool:
    return bool(pdf_name and str(pdf_name).lower().startswith("sc_"))


def _is_sc_doc(payload_or_doc: dict | None) -> bool:
    """
    Detect whether a record belongs to the SC corpus.
    Works for both Qdrant payloads and enriched retriever docs.
    """
    if not isinstance(payload_or_doc, dict):
        return False

    pdf_name = str(payload_or_doc.get("pdf_name") or payload_or_doc.get("pdf") or "").strip().lower()
    source_path = str(payload_or_doc.get("source_path") or "").strip().lower()
    source_filename = source_path.replace("\\", "/").split("/")[-1] if source_path else ""
    return _is_sc_pdf(pdf_name) or _is_sc_pdf(source_filename)


def _safe_page(page_value) -> int:
    try:
        return int(page_value)
    except Exception:
        return 10**9


def _stable_doc_signature(doc: dict | None) -> tuple:
    if not isinstance(doc, dict):
        return ("", "", 10**9, "", "")
    pdf_name = str(doc.get("pdf_name") or "")
    source_path = str(doc.get("source_path") or "")
    page = _safe_page(doc.get("page"))
    section = str(doc.get("section") or "")
    text_prefix = str(doc.get("text") or "")[:120]
    return (pdf_name, source_path, page, section, text_prefix)


def _enrich_points(points, return_metadata=True):
    """
    Helper: Convert Qdrant points to enriched result format.
    Eliminates code duplication between retrievers.
    """
    if not return_metadata:
        return [clean_text((point.payload or {}).get("text", "")) for point in points]
    
    enriched = []
    for point in points:
        payload = point.payload or {}
        enriched.append({
            "text": clean_text(payload.get("text", "")),
            "pdf_name": payload.get("pdf_name") or payload.get("pdf"),
            "source_path": payload.get("source_path"),
            "page": payload.get("page"),
            "section": payload.get("section", "Unknown"),
            "line_start": payload.get("line_start"),
            "line_end": payload.get("line_end"),
            "year": _safe_year(payload.get("year")),
            "qdrant_score": float(getattr(point, "score", 0.0) or 0.0),
        })
    return enriched


_BM25_CACHE_DIR = os.getenv("NYAYA_BM25_CACHE_DIR", ".bm25_cache")


def _bm25_cache_key(num_docs: int) -> str:
    """Cache key encodes collection size + SC-only mode so a schema change invalidates the cache."""
    raw = f"{QDRANT_COLLECTION}:{num_docs}:sc_only={SC_ONLY_MODE}"
    return hashlib.md5(raw.encode()).hexdigest()


def _load_bm25_cache(num_docs: int):
    """Return (bm25_model, documents) from disk cache, or (None, None) on miss/error."""
    key = _bm25_cache_key(num_docs)
    path = os.path.join(_BM25_CACHE_DIR, f"bm25_{key}.pkl")
    if not os.path.exists(path):
        return None, None
    try:
        with open(path, "rb") as f:
            cached = pickle.load(f)
        print(f"[OK] BM25 index loaded from disk cache ({num_docs} docs)")
        return cached["model"], cached["documents"]
    except Exception:
        return None, None


def _save_bm25_cache(num_docs: int, bm25_model, documents) -> None:
    """Persist BM25 model + documents to disk."""
    try:
        os.makedirs(_BM25_CACHE_DIR, exist_ok=True)
        key = _bm25_cache_key(num_docs)
        path = os.path.join(_BM25_CACHE_DIR, f"bm25_{key}.pkl")
        with open(path, "wb") as f:
            pickle.dump({"model": bm25_model, "documents": documents}, f, protocol=pickle.HIGHEST_PROTOCOL)
        print(f"[OK] BM25 index saved to disk cache ({num_docs} docs)")
    except Exception as exc:
        print(f"[WARNING] Could not save BM25 cache: {exc}")


class VectorRetriever:
    def __init__(self):
        self.client = create_qdrant_client()
        self.collection_name = QDRANT_COLLECTION
        self.breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30.0)
        # Use local_files_only to avoid network permission issues on Windows
        self.model = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L6-v2",
            local_files_only=True
        )

    def search(self, query, top_k=5, return_metadata=True):
        query_vector = self.model.encode(query).tolist()

        results = call_with_retry(
            self.client.query_points,
            collection_name=self.collection_name,
            query=query_vector,
            limit=top_k,
            with_payload=True,
            retries=2,
            timeout_seconds=20,
            circuit_breaker=self.breaker,
        )

        return _enrich_points(results.points, return_metadata)


class HybridRetriever:
    """
    Hybrid retriever combining vector search (semantic) and BM25 (keyword).
    
    Combines:
    - Vector search: 70% weight (semantic similarity)
    - BM25 search: 30% weight (exact matches, legal terms)
    
    This improves precision for legal queries which often include:
    - Exact case names
    - Specific legal citations
    - Domain-specific terminology
    """
    
    def __init__(self):
        self.vector_retriever = VectorRetriever()
        self.client = self.vector_retriever.client
        self.collection_name = self.vector_retriever.collection_name
        self.bm25_corpus = None
        self.bm25_model = None
        self.documents = None
        
        # Build BM25 index from all documents in Qdrant
        self._build_bm25_index()
    
    def _build_bm25_index(self):
        """Fetch all documents from Qdrant and build BM25 index (with disk cache)."""
        try:
            # Initialize as empty list (not None) to avoid NoneType errors
            self.documents = []
            documents = []
            
            # Get all documents from Qdrant
            # For cloud instances, fetching all documents can timeout
            # In that case, we fallback to vector-only search
            try:
                import socket
                all_docs = call_with_retry(
                    self.client.scroll,
                    collection_name=self.collection_name,
                    limit=10000,  # Adjust if you have more documents
                    timeout=30,  # Qdrant API timeout
                    retries=1,
                    timeout_seconds=35,
                    circuit_breaker=self.vector_retriever.breaker,
                )
            except (TimeoutError, socket.error, OSError, ConnectionError) as scroll_err:
                print(f"[WARNING] Could not fetch all docs for BM25 (network/timeout): {type(scroll_err).__name__}")
                print("[INFO] Switching to vector-only search (BM25 disabled)")
                self.documents = []
                self.bm25_model = None
                return
            except Exception as scroll_err:
                print(f"[WARNING] Could not fetch all docs for BM25: {type(scroll_err).__name__}")
                print("[INFO] Switching to vector-only search (BM25 disabled)")
                self.documents = []
                self.bm25_model = None
                return

            raw_points = all_docs[0]
            num_docs_total = len(raw_points)

            # Try loading from disk cache before re-tokenizing everything
            cached_model, cached_docs = _load_bm25_cache(num_docs_total)
            if cached_model is not None and cached_docs is not None:
                self.bm25_model = cached_model
                self.documents = cached_docs
                return
            
            # Extract text and tokenize for BM25
            for point in raw_points:
                payload = point.payload or {}
                if SC_ONLY_MODE and not _is_sc_doc(payload):
                    continue

                text = payload.get("text", "")
                cleaned = clean_text(text)
                if len(cleaned) > 20:  # Skip very short docs
                    # Tokenize: split by whitespace and lowercase
                    tokens = cleaned.lower().split()
                    documents.append(tokens)
                    self.documents.append({
                        "text": cleaned,
                        "id": point.id,
                        "payload": payload
                    })
            
            # Build BM25 model
            if documents:
                self.bm25_model = BM25Okapi(documents)
                print(f"[OK] Built BM25 index from {len(documents)} documents")
                _save_bm25_cache(num_docs_total, self.bm25_model, self.documents)
            else:
                print("[WARNING] No documents found for BM25 indexing")
                self.documents = []
                
        except Exception as e:
            print(f"[WARNING] Failed to build BM25 index: {e}")
            # Ensure documents is an empty list, not None
            if self.documents is None:
                self.documents = []
            self.bm25_model = None
    
    def search(self, query, top_k=5, return_metadata=True, vector_weight=0.6):
        """
        Hybrid search combining vector and BM25 scores.
        
        Args:
            query: Search query string
            top_k: Number of results to return
            return_metadata: Include document metadata
            vector_weight: Weight for vector score (0.0-1.0), BM25 gets (1-vector_weight)
            
        Returns:
            List of ranked documents
        """
        query = canonicalize_legal_query(query)
        bm25_weight = 1.0 - vector_weight
        recency_weight = float(OPTIMIZED_SETTINGS.get("recency_weight", 0.10))
        
        # Check cache first (skip if exact match found)
        if OPTIMIZED_SETTINGS.get("cache_enabled"):
            cached = get_cached_query_result(query)
            if cached:
                if SC_ONLY_MODE:
                    cached = [doc for doc in cached if _is_sc_doc(doc)]
                # If cache is stale/insufficient after filtering, continue with live retrieval.
                if len(cached) < max(1, top_k):
                    cached = None
            if cached:
                # Debug: print(f"[CACHE HIT] Retrieved cached results for query")
                if return_metadata:
                    return cached[:top_k]
                return [r.get("text", "") for r in cached[:top_k]]
        
        # Get vector search results (always available)
        vector_results = self.vector_retriever.search(query, top_k=top_k*2, return_metadata=True)
        if SC_ONLY_MODE:
            vector_results = [doc for doc in vector_results if isinstance(doc, dict) and _is_sc_doc(doc)]
        
        # Get BM25 scores (fallback to vector-only if BM25 failed)
        bm25_scores = {}
        if self.bm25_model and self.documents and len(self.documents) > 0:
            try:
                query_tokens = extract_query_terms(query)
                if not query_tokens:
                    query_tokens = clean_text(query).lower().split()
                bm25_ranking = self.bm25_model.get_scores(query_tokens)
                
                # Create mapping of doc_id to BM25 score
                for i, score in enumerate(bm25_ranking):
                    bm25_scores[i] = score
            except Exception:
                pass
        
        # Combine and rank results
        combined_results = {}
        
        # Add vector results with vector scores
        for i, doc in enumerate(vector_results):
            doc_id = id(doc)  # Use doc object id as key
            # Vector score is already normalized (0-1) by Qdrant
            vector_score = 1.0 - (i / (len(vector_results) + 1))  # Inverse rank scoring
            combined_results[doc_id] = {
                "doc": doc,
                "vector_score": vector_score,
                "bm25_score": 0.0,
                "final_score": vector_score * vector_weight
            }
        
        # Add BM25 scores for documents (only if available)
        if self.documents and len(self.documents) > 0:
            for i, doc in enumerate(self.documents):
                bm25_score = bm25_scores.get(i, 0.0)
                if bm25_score > 0:
                    doc_id = id(doc)
                    # Normalize BM25 score to 0-1 range
                    max_bm25 = max(bm25_scores.values()) if bm25_scores else 1.0
                    normalized_bm25 = bm25_score / max(max_bm25, 1.0)
                    
                    if doc_id in combined_results:
                        # Update existing result
                        combined_results[doc_id]["bm25_score"] = normalized_bm25
                        recency = _recency_bonus(_safe_year(doc["payload"].get("year")))
                        combined_results[doc_id]["recency_score"] = recency
                        combined_results[doc_id]["final_score"] = (
                            combined_results[doc_id]["vector_score"] * vector_weight +
                            normalized_bm25 * bm25_weight +
                            recency * recency_weight
                        )
                    else:
                        # Add new result from BM25
                        recency = _recency_bonus(_safe_year(doc["payload"].get("year")))
                        combined_results[doc_id] = {
                            "doc": {
                                "text": doc["text"],
                                "pdf_name": doc["payload"].get("pdf_name", "Unknown"),
                                "source_path": doc["payload"].get("source_path"),
                                "page": doc["payload"].get("page", "Unknown"),
                                "section": doc["payload"].get("section", "Unknown"),
                                "line_start": doc["payload"].get("line_start"),
                                "line_end": doc["payload"].get("line_end"),
                                "year": _safe_year(doc["payload"].get("year")),
                                "qdrant_score": 0.0,
                            },
                            "vector_score": 0.0,
                            "bm25_score": normalized_bm25,
                            "recency_score": recency,
                            "final_score": normalized_bm25 * bm25_weight + recency * recency_weight
                        }
        
        # Sort by final score with deterministic tie-breakers.
        sorted_results = sorted(
            combined_results.values(),
            key=lambda x: (
                -float(x.get("final_score", 0.0)),
                *_stable_doc_signature(x.get("doc") if isinstance(x, dict) else None),
            )
        )

        # Optional cross-encoder re-ranking over top candidates
        if _RERANKER_ENABLED:
            ce = _get_cross_encoder()
            if ce is not None:
                candidates = sorted_results[:min(20, len(sorted_results))]
                pairs = [(query, r["doc"].get("text", "")[:512]) for r in candidates]
                try:
                    ce_scores = ce.predict(pairs)
                    for item, score in zip(candidates, ce_scores):
                        item["final_score"] = float(score)
                    candidates.sort(key=lambda x: x["final_score"], reverse=True)
                    sorted_results = candidates + sorted_results[len(candidates):]
                except Exception:
                    pass  # silently fall back to hybrid scores
        
        # Apply relevance filtering (accuracy improvement)
        docs_for_filtering = [r["doc"] for r in sorted_results]
        filtered_results = filter_results_by_threshold(
            docs_for_filtering,
            query,
            threshold=OPTIMIZED_SETTINGS.get("result_threshold", 0.32)
        )[:top_k]

        # Attach final retrieval score for downstream confidence policies.
        filtered_by_text = {doc.get("text", "")[:500]: doc for doc in filtered_results if isinstance(doc, dict)}
        for item in sorted_results:
            doc = item.get("doc", {})
            text_key = (doc.get("text", "") if isinstance(doc, dict) else "")[:500]
            if text_key in filtered_by_text:
                filtered_by_text[text_key]["retrieval_score"] = round(float(item.get("final_score", 0.0)), 4)

        # Ensure stable output ordering for identical queries.
        filtered_results = sorted(
            filtered_results,
            key=lambda doc: (
                -float((doc or {}).get("retrieval_score", 0.0)) if isinstance(doc, dict) else 0.0,
                *_stable_doc_signature(doc if isinstance(doc, dict) else None),
            )
        )[:top_k]
        
        # Cache results for future queries
        if OPTIMIZED_SETTINGS.get("cache_enabled"):
            cache_query_result(query, filtered_results)
        
        if return_metadata:
            return filtered_results
        else:
            return [clean_text(r.get("text", "")) for r in filtered_results]