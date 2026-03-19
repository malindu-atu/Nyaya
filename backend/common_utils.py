#!/usr/bin/env python3
"""
Shared utility functions used across multiple modules.
Consolidates duplicate code for better maintainability.
"""

import re
import os
from qdrant_client import QdrantClient
from config import QDRANT_HOST, QDRANT_PORT


def clean_text(text):
    """
    Cleans OCR and PDF text:
    - removes extra spaces/newlines
    - removes soft hyphens
    - maintains consistency across all modules
    
    Args:
        text: Text to clean
        
    Returns:
        Cleaned text string
    """
    if not text:
        return ""
    text = re.sub(r'\xAD', '', text)  # Remove OCR soft hyphens
    text = re.sub(r'-\n', '', text)   # Remove hyphen splits
    text = re.sub(r'\n+', ' ', text)  # Remove excessive newlines
    text = re.sub(r'\s+', ' ', text)  # Remove extra spaces
    return text.strip()


def create_qdrant_client(timeout_seconds=60):
    """
    Create Qdrant client with robust timeout handling.
    Centralizes client creation logic for consistency.
    
    Args:
        timeout_seconds: Timeout duration (default 60s, use 600s for large uploads)
        
    Returns:
        QdrantClient instance
    """
    host = os.getenv("QDRANT_HOST")
    api_key = os.getenv("QDRANT_API_KEY")
    
    if host:
        return QdrantClient(
            url=host,
            api_key=api_key,
            timeout=timeout_seconds
        )
    
    if QDRANT_HOST.startswith("http"):
        return QdrantClient(
            url=QDRANT_HOST,
            api_key=api_key,
            timeout=timeout_seconds
        )
    
    return QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, timeout=timeout_seconds)
