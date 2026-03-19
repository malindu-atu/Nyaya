# Nyaya — Sri Lankan Legal Assistant

AI-powered Sri Lankan legal research assistant with case law retrieval, citation graph analysis, and a quiz system.

## Project Structure

```
Nyaya-full/
├── backend/      # FastAPI Python backend (Nyaya-Database)
└── frontend/     # Next.js TypeScript frontend
```

## Quick Start

### 1. Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env and fill in your Qdrant, Neo4j, and OpenAI keys

# Start the server
uvicorn app:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local — set NYAYA_BACKEND_URL=http://localhost:8000

# Start the dev server
npm run dev
```

Frontend runs at: http://localhost:3000

## Backend API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /ask | Single legal question |
| POST | /ask-chat | Multi-turn chat with history |
| POST | /ask-stream | Streaming token response |
| POST | /ask-batch | Multiple questions at once |
| GET | /history | User search history |
| DELETE | /history | Clear user history |
| GET | /analytics/summary | Usage analytics |
| GET | /analytics/dashboard | Analytics dashboard (HTML) |
| GET | /info | System info |
