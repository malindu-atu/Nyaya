# embedder.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()

HF_API_KEY = os.getenv("HF_API_KEY")
HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
API_URL = f"https://router.huggingface.co/hf-inference/models/{HF_MODEL}/pipeline/feature-extraction"


def _embed_batch(texts: list) -> list:
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    response = requests.post(
        API_URL,
        headers=headers,
        json={"inputs": texts, "options": {"wait_for_model": True}},
        timeout=60,
    )
    if response.status_code != 200:
        raise RuntimeError(f"HuggingFace API error {response.status_code}: {response.text}")
    return response.json()


def embed_chunks(chunks):
    """
    Takes a list of text chunks and returns embeddings (384-dim)
    using the HuggingFace Inference API — no local model needed.
    """
    if not chunks:
        return []

    BATCH_SIZE = 32  # HF free tier works best with smaller batches
    all_embeddings = []

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        batch = [text.replace("\n", " ") for text in batch]
        print(f"  Embedding batch {i // BATCH_SIZE + 1}/{(len(chunks) - 1) // BATCH_SIZE + 1} ({len(batch)} chunks)...")
        embeddings = _embed_batch(batch)
        all_embeddings.extend(embeddings)

    return all_embeddings