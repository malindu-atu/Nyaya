"""Manual Qdrant connectivity smoke helper."""

import os

from dotenv import load_dotenv
from qdrant_client import QdrantClient


def run_manual_qdrant_check() -> None:
    load_dotenv()
    host = os.getenv("QDRANT_HOST")
    api_key = os.getenv("QDRANT_API_KEY")
    collection = os.getenv("QDRANT_COLLECTION", "sri_lankan_cases")

    print(f"Testing connection to: {host}")
    print(f"Collection: {collection}")
    print(f"API Key: {'[OK]' if api_key else '[MISSING]'}\\n")

    try:
        print("Creating client with 60s timeout...")
        client = QdrantClient(url=host, api_key=api_key, timeout=60)
        print("Checking collection info...")
        collection_info = client.get_collection(collection_name=collection)

        print("\\n[SUCCESS] Connected to Qdrant!")
        print(f"Collection: {collection}")
        print(f"Vector count: {collection_info.points_count}")
        vectors_config = collection_info.config.params.vectors
        vector_size = "unknown"
        if isinstance(vectors_config, dict):
            first_cfg = next(iter(vectors_config.values()), None)
            if first_cfg is not None:
                vector_size = str(getattr(first_cfg, "size", "unknown"))
        elif vectors_config is not None:
            vector_size = str(getattr(vectors_config, "size", "unknown"))
        print(f"Vector size: {vector_size}")
    except Exception as exc:
        print(f"\\n[ERROR] Connection failed: {exc}")


def test_qdrant_smoke_placeholder():
    assert True


if __name__ == "__main__":
    run_manual_qdrant_check()
