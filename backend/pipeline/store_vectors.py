from qdrant_client.models import (
    VectorParams,
    Distance,
    PointStruct,
)
from config import QDRANT_COLLECTION
from common_utils import create_qdrant_client
import time
import hashlib
import uuid


def _stable_point_id(source_key, page, section, text):
    """Generate a stable UUID from chunk metadata.
    Qdrant requires point IDs to be either unsigned integers or UUIDs.
    """
    key = f"{source_key}|{page}|{section}|{text}".encode("utf-8", errors="ignore")
    # Use SHA1 hash to seed UUID5 (deterministic UUID generation)
    hash_obj = hashlib.sha1(key)
    # Create UUID 5 (SHA1-based) using the hash as namespace
    return str(uuid.UUID(int=int(hash_obj.hexdigest()[:16], 16)))


def store_in_qdrant(chunks, embeddings, pdf_name, replace_pdf=False):
    try:
        client = create_qdrant_client(timeout_seconds=600)
    except Exception as exc:
        print(f"[ERROR] Could not create Qdrant client for {pdf_name}: {exc}")
        return False

    collection_name = QDRANT_COLLECTION

    # Create collection if it does not exist (avoid wiping previous data)
    try:
        client.get_collection(collection_name)
    except Exception as get_exc:
        try:
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=len(embeddings[0]),
                    distance=Distance.COSINE
                )
            )
        except Exception as create_exc:
            print(
                f"[ERROR] Qdrant unavailable while preparing collection '{collection_name}' "
                f"for {pdf_name}: {create_exc}"
            )
            print(f"[INFO] Underlying collection check error: {get_exc}")
            return False

    if replace_pdf:
        # Note: Cannot delete by pdf_name filter without payload index.
        # Instead, rely on UUID collision prevention (same content = same ID)
        # This ensures idempotent re-uploads without duplication.
        pass

    points = []

    for chunk, embedding in zip(chunks, embeddings):
        # Convert tensor to list if needed
        vector = embedding.tolist() if hasattr(embedding, "tolist") else embedding
        

        if isinstance(chunk, dict):
            page_value = chunk.get("page")
            if page_value is None:
                page_value = -1

            section_value = chunk.get("section")
            if not section_value:
                section_value = "Unknown"

            payload = {
                "text": chunk.get("text", ""),
                "pdf_name": chunk.get("pdf_name", pdf_name),
                "source_path": chunk.get("source_path", pdf_name),
                "year_folder": chunk.get("year_folder"),
                "page": page_value,
                "section": section_value,
                "line_start": chunk.get("line_start"),
                "line_end": chunk.get("line_end"),
            }
        else:
            payload = {
                "text": chunk,
                "pdf_name": pdf_name,
                "source_path": pdf_name,
                "year_folder": None,
                "page": -1,
                "section": "Unknown",
            }

        points.append(
            PointStruct(
                id=_stable_point_id(
                    payload.get("source_path") or payload.get("pdf_name", pdf_name),
                    payload.get("page", -1),
                    payload.get("section", "Unknown"),
                    payload.get("text", ""),
                ),
                vector=vector,
                payload=payload,
            )
        )

    if points:
        # Batch upsert with robust retry logic for Qdrant Cloud
        batch_size = 30  # Smaller batches for better reliability on cloud
        max_retries = 5  # More retries for intermittent network issues
        failed_batches = []  # Track failed batches
        
        for i in range(0, len(points), batch_size):
            batch = points[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(points) + batch_size - 1) // batch_size
            
            # Retry logic with exponential backoff
            batch_uploaded = False
            for attempt in range(max_retries):
                try:
                    print(f"  Batch {batch_num}/{total_batches}: uploading {len(batch)} points...", end="", flush=True)
                    client.upsert(collection_name=collection_name, points=batch)
                    print(" OK")
                    batch_uploaded = True
                    break
                except Exception:
                    if attempt < max_retries - 1:
                        # Exponential backoff with jitter
                        wait_time = (2 ** attempt) + (0.1 * (attempt + 1))
                        print(f" CONNECTION ERROR. Retrying in {wait_time:.1f}s (attempt {attempt+1}/{max_retries})...")
                        time.sleep(wait_time)
                        
                        # Recreate client after connection error
                        if attempt >= 2:
                            print("  Reconnecting to Qdrant...")
                            client = create_qdrant_client(timeout_seconds=600)
                    else:
                        print(f" FAILED after {max_retries} attempts (continuing with other batches)...")
                        failed_batches.append(batch_num)
            
            # Continue even if batch fails (partial upload is better than crash)
            if not batch_uploaded and batch_num > 0:
                print(f"  [WARNING] Batch {batch_num} skipped, continuing...")
        
        # Report summary
        if failed_batches:
            stored_count = len(points) - (len(failed_batches) * batch_size)
            print(f"[WARNING] {pdf_name}: {len(failed_batches)} batch(es) failed")
            print(f"[INFO] Partial upload: {stored_count}/{len(points)} points stored (acceptable for incremental indexing)")
            return False
        else:
            print(f"[OK] Stored {len(points)} vectors for {pdf_name}")

    return True
