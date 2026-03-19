import os
import json
from pipeline.extract_pdf import extract_pages_from_pdf
from pipeline.chunk_pdf import chunk_pages_with_metadata
from pipeline.chunker import logical_chunking
from pipeline.embedder import embed_chunks
from pipeline.store_vectors import store_in_qdrant
from graph.neo4j_loader import create_case_node, create_citation_relationships
from graph.consolidate_graph import consolidate_duplicate_cases
from common_utils import create_qdrant_client
from config import QDRANT_COLLECTION

PDF_FOLDER = "pdfs"
INDEX_STATE_FILE = ".index_state.json"
DEFERRED_QUEUE_FILE = ".deferred_queue.json"


def _iter_pdf_files(pdf_root):
    for current_root, dir_names, file_names in os.walk(pdf_root):
        dir_names.sort()
        for file_name in sorted(file_names):
            if not file_name.lower().endswith(".pdf"):
                continue
            pdf_path = os.path.join(current_root, file_name)
            relative_path = os.path.relpath(pdf_path, pdf_root).replace("\\", "/")
            relative_dir = os.path.dirname(relative_path).replace("\\", "/")
            year_folder = relative_dir.split("/")[0] if relative_dir else None
            yield {
                "pdf_path": pdf_path,
                "display_name": file_name,
                "relative_path": relative_path,
                "year_folder": year_folder,
            }


def _load_index_state():
    if not os.path.exists(INDEX_STATE_FILE):
        return {}
    try:
        with open(INDEX_STATE_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _load_deferred_queue():
    if not os.path.exists(DEFERRED_QUEUE_FILE):
        return {}
    try:
        with open(DEFERRED_QUEUE_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_index_state(state):
    with open(INDEX_STATE_FILE, "w", encoding="utf-8") as file:
        json.dump(state, file, indent=2)


def _save_deferred_queue(state):
    with open(DEFERRED_QUEUE_FILE, "w", encoding="utf-8") as file:
        json.dump(state, file, indent=2)


def _pdf_signature(pdf_path):
    stats = os.stat(pdf_path)
    return {
        "size": stats.st_size,
        "mtime_ns": stats.st_mtime_ns,
    }


def check_qdrant_connectivity() -> bool:
    """
    Quick pre-flight test to see if Qdrant is reachable.
    Prints actionable guidance on WinError 10013 (socket permission denied).
    Returns True if reachable, False otherwise.
    """
    try:
        client = create_qdrant_client(timeout_seconds=15)
        client.get_collections()
        print("[OK] Qdrant connection: reachable.")
        return True
    except Exception as exc:
        msg = str(exc)
        print(f"\n[ERROR] Cannot reach Qdrant: {exc}")
        if "10013" in msg or "forbidden by its access permissions" in msg.lower():
            print("""
[FIX] WinError 10013 — Windows is blocking Python's outbound socket.
Try the following steps:
  1. Open Windows Defender Firewall → Allow an app → browse to
     .venv\\Scripts\\python.exe → tick both Private and Public.
  2. Temporarily disable antivirus / web-shield and retry.
  3. If on a VPN or campus network, switch to a regular connection.
  4. Run PowerShell as Administrator and check:
       netsh interface ipv4 show excludedportrange protocol=tcp
     If port 443 or 6333 is excluded, release it or use a different network.
  5. If nothing works, run on a different device/hotspot — your PDFs
     will be skipped automatically once uploaded (index state is synced).
""")
        return False


def _bootstrap_index_state_from_qdrant(pdf_root):
    """
    On a fresh device with no .index_state.json, query Qdrant to find which
    PDFs are already indexed and pre-populate the skip list so they are not
    re-processed unnecessarily.
    """
    print("[INFO] No local index state found. Checking Qdrant for already-indexed PDFs...")
    try:
        client = create_qdrant_client(timeout_seconds=60)
        indexed_paths = set()
        offset = None

        while True:
            result, next_offset = client.scroll(
                collection_name=QDRANT_COLLECTION,
                limit=1000,
                offset=offset,
                with_payload=["source_path"],
                with_vectors=False,
            )
            for point in result:
                sp = (point.payload or {}).get("source_path")
                if sp:
                    indexed_paths.add(sp)
            if next_offset is None:
                break
            offset = next_offset

        if not indexed_paths:
            print("[INFO] Qdrant collection is empty. All PDFs will be processed fresh.")
            return {}

        print(f"[INFO] Qdrant already contains {len(indexed_paths)} indexed PDF path(s).")

        # Build real signatures for local files that are already in Qdrant,
        # so the normal skip check will work on future runs too.
        state = {}
        matched = 0
        for pdf_info in _iter_pdf_files(pdf_root):
            if pdf_info["relative_path"] in indexed_paths:
                state[pdf_info["relative_path"]] = _pdf_signature(pdf_info["pdf_path"])
                matched += 1

        print(f"[INFO] Pre-populated index state for {matched} local PDF(s) → these will be skipped.")
        return state

    except Exception as exc:
        print(f"[WARNING] Could not sync index state from Qdrant ({exc}). Will process all PDFs.")
        return {}


def _pages_to_text(pages):
    return "\n".join(page.get("text", "") for page in pages)


def _process_pdf(pdf_info, index_state, deferred_queue, force_retry=False):
    pdf_path = pdf_info["pdf_path"]
    display_name = pdf_info["display_name"]
    relative_path = pdf_info["relative_path"]
    year_folder = pdf_info["year_folder"]

    current_signature = _pdf_signature(pdf_path)
    previous_signature = index_state.get(relative_path)

    if (not force_retry) and previous_signature == current_signature:
        print(f"\nSkipping unchanged PDF: {relative_path}")
        return "skipped"

    print(f"\nProcessing: {relative_path}")

    pages = extract_pages_from_pdf(pdf_path)
    text = _pages_to_text(pages)

    chunks = chunk_pages_with_metadata(
        pages,
        display_name,
        extra_metadata={
            "source_path": relative_path,
            "year_folder": year_folder,
        },
    )
    citation_chunks = logical_chunking(text)

    chunk_texts = [chunk["text"] for chunk in chunks]
    embeddings = embed_chunks(chunk_texts)

    upload_ok = store_in_qdrant(chunks, embeddings, relative_path, replace_pdf=True)
    if not upload_ok:
        print(f"[WARNING] Deferred indexing for {relative_path} due to Qdrant connectivity issues.")
        deferred_queue[relative_path] = {
            "signature": current_signature,
            "last_error": "qdrant_upload_failed",
        }
        _save_deferred_queue(deferred_queue)
        return "deferred"

    # Pass text for metadata extraction (Neo4j - optional)
    try:
        create_case_node(display_name, text=text)
        create_citation_relationships(text, display_name, chunks=citation_chunks)
    except Exception as e:
        print(f"[WARNING] Neo4j graph update failed for {relative_path}: {e}")
        print("[INFO] Continuing with vector store indexing...")

    index_state[relative_path] = current_signature
    _save_index_state(index_state)
    if relative_path in deferred_queue:
        deferred_queue.pop(relative_path, None)
        _save_deferred_queue(deferred_queue)
    return "processed"


def process_all_pdfs(run_dedup=False):
    if not check_qdrant_connectivity():
        print("[WARNING] Qdrant is unreachable. Ingestion will run but all uploads will be deferred.")
    if not os.path.exists(INDEX_STATE_FILE):
        index_state = _bootstrap_index_state_from_qdrant(PDF_FOLDER)
        if index_state:
            _save_index_state(index_state)
    else:
        index_state = _load_index_state()
    deferred_queue = _load_deferred_queue()
    processed_count = 0
    skipped_count = 0
    deferred_count = 0

    for pdf_info in _iter_pdf_files(PDF_FOLDER):
        status = _process_pdf(pdf_info, index_state, deferred_queue, force_retry=False)
        if status == "skipped":
            skipped_count += 1
        elif status == "deferred":
            deferred_count += 1
        else:
            processed_count += 1

    print("\nAll PDFs processed successfully.")
    print(f"Processed: {processed_count} | Skipped unchanged: {skipped_count} | Deferred (upload failed): {deferred_count}")

    if run_dedup and processed_count > 0:
        try:
            print("\n" + "="*60)
            print("Starting case deduplication...")
            print("="*60)
            consolidate_duplicate_cases(similarity_threshold=0.85)
        except Exception as e:
            print(f"[WARNING] Neo4j deduplication failed: {e}")
            print("[INFO] Vector store is ready for queries.")


def retry_deferred_pdfs(run_dedup=False):
    deferred_queue = _load_deferred_queue()
    if not deferred_queue:
        print("[INFO] No deferred PDFs found.")
        return

    index_state = _load_index_state()
    by_relative_path = {item["relative_path"]: item for item in _iter_pdf_files(PDF_FOLDER)}
    targets = sorted(deferred_queue.keys())

    print(f"[INFO] Retrying {len(targets)} deferred PDF(s)...")

    processed_count = 0
    deferred_count = 0
    missing_count = 0

    for relative_path in targets:
        pdf_info = by_relative_path.get(relative_path)
        if not pdf_info:
            print(f"[WARNING] Deferred file not found locally: {relative_path}")
            missing_count += 1
            continue

        status = _process_pdf(pdf_info, index_state, deferred_queue, force_retry=True)
        if status == "processed":
            processed_count += 1
        elif status == "deferred":
            deferred_count += 1

    print("\nDeferred retry run completed.")
    print(
        f"Retried successfully: {processed_count} | "
        f"Still deferred: {deferred_count} | Missing local files: {missing_count}"
    )

    if run_dedup and processed_count > 0:
        try:
            print("\n" + "="*60)
            print("Starting case deduplication...")
            print("="*60)
            consolidate_duplicate_cases(similarity_threshold=0.85)
        except Exception as e:
            print(f"[WARNING] Neo4j deduplication failed: {e}")
            print("[INFO] Vector store is ready for queries.")
