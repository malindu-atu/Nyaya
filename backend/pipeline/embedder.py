# embedder.py
import os
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)
_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-ada-002")


def embed_chunks(chunks):
    """
    Takes a list of text chunks and returns embeddings using Azure OpenAI.
    Returns a list of embedding vectors (list of floats).
    """
    if not chunks:
        return []

    # Azure OpenAI allows up to 2048 inputs per request
    # Split into batches to avoid hitting limits
    BATCH_SIZE = 100
    all_embeddings = []

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        # Replace newlines which can affect embedding quality
        batch = [text.replace("\n", " ") for text in batch]
        print(f"  Embedding batch {i // BATCH_SIZE + 1}/{(len(chunks) - 1) // BATCH_SIZE + 1} ({len(batch)} chunks)...")
        response = _client.embeddings.create(
            input=batch,
            model=_DEPLOYMENT,
        )
        batch_embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(batch_embeddings)

    return all_embeddings