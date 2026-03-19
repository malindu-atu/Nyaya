# Nyaya Quiz

A quiz application with support for multiple topics and difficulty levels. Built with Next.js for the frontend and FastAPI for the backend.

## Features

- Multiple quiz topics including JavaScript, Python, and SQL
- Three difficulty levels per topic: easy, medium, and hard
- Instant feedback with explanations after each answer
- Score tracking and progress visualization
- User attempt history to review past performance
- Responsive interface built with Tailwind CSS

## Installation and Setup

### Prerequisites

You need the following installed on your system:
- Node.js 18 or higher
- Python 3.8 or higher
- Supabase account with PostgreSQL database

### Backend Setup

Navigate to the backend directory and set up the Python environment:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # on windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the backend directory with your database connection:

```
DATABASE_URL=postgresql://username:password@localhost:5432/nyaya_quiz
```

Initialize the database with tables and sample questions:

```bash
python init_db.py
```

Start the backend server:

```bash
uvicorn main:app --reload
```

The API will run at `http://127.0.0.1:8000`

### Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

The application will run at `http://localhost:3000`

## Tech Stack

**Frontend:** Next.js 16, React 19, Tailwind CSS 4  
**Backend:** FastAPI, SQLAlchemy, PostgreSQL (Supabase)
