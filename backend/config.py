# config.py
import os
from dotenv import load_dotenv

load_dotenv()

URI = os.getenv("NEO4J_URI", "neo4j+s://dbd77c8f.databases.neo4j.io")
USER = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "")

QDRANT_HOST = os.getenv(
	"QDRANT_HOST",
	"https://8dc86e88-89a7-42aa-b9bc-cfe21e785acd.europe-west3-0.gcp.cloud.qdrant.io",
)
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "sri_lankan_cases")

PDF_FILE = os.getenv("PDF_FILE", "New-Law-Report-Vol-80.pdf")

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-nano")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")
