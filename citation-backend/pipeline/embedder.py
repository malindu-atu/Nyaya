# embedder.py
from sentence_transformers import SentenceTransformer

# Load model once globally (use cached version to avoid network issues)
model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2",
    local_files_only=True
)

def embed_chunks(chunks):
    """
    Takes a list of text chunks and returns embeddings
    """
    embeddings = model.encode(chunks, show_progress_bar=True, convert_to_tensor=True)
    return embeddings
