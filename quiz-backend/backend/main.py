from database import SessionLocal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from typing import Optional, List
import uuid

app = FastAPI()

# Add CORS middleware to allow frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuizAttemptCreate(BaseModel):
    user_id: str
    quiz_id: str


class AnswerSubmit(BaseModel):
    attempt_id: str
    question_id: str
    option_id: str


class QuizAttemptComplete(BaseModel):
    attempt_id: str
    score: int


@app.get("/quizzes")
def get_all_quizzes():
    """Get all quizzes with their questions and options"""
    db = SessionLocal()
    try:
        # Fetch all quizzes
        quizzes_result = db.execute(text("""
            SELECT id, title, description, created_at
            FROM quizzes2
            ORDER BY created_at DESC
        """)).mappings().all()
        
        quizzes = []
        for quiz in quizzes_result:
            quiz_dict = dict(quiz)
            quiz_dict['id'] = str(quiz_dict['id'])
            
            # Fetch questions for this quiz
            questions_result = db.execute(text("""
                SELECT id, question_text
                FROM questions
                WHERE quiz_id = :quiz_id
            """), {"quiz_id": quiz['id']}).mappings().all()
            
            questions = []
            for question in questions_result:
                q_dict = dict(question)
                q_dict['id'] = str(q_dict['id'])
                
                # Fetch options for this question
                options_result = db.execute(text("""
                    SELECT option_text, is_correct
                    FROM options
                    WHERE question_id = :question_id
                    ORDER BY option_text
                """), {"question_id": question['id']}).mappings().all()
                
                q_dict['options'] = [opt['option_text'] for opt in options_result]
                q_dict['correct_option'] = next(
                    (opt['option_text'] for opt in options_result if opt['is_correct']),
                    None
                )
                
                questions.append(q_dict)
            
            quiz_dict['questions'] = questions
            quiz_dict['question_count'] = len(questions)
            quizzes.append(quiz_dict)
        
        return quizzes
    finally:
        db.close()


@app.get("/quizzes/{quiz_id}")
def get_quiz(quiz_id: str):
    """Get a single quiz with all its questions and options"""
    db = SessionLocal()
    try:
        # Fetch quiz
        quiz_result = db.execute(text("""
            SELECT id, title, description, created_at
            FROM quizzes2
            WHERE id = :id
        """), {"id": quiz_id}).mappings().first()
        
        if not quiz_result:
            raise HTTPException(status_code=404, detail="Quiz not found")
        
        quiz = dict(quiz_result)
        quiz['id'] = str(quiz['id'])
        
        # Fetch questions
        questions_result = db.execute(text("""
            SELECT id, question_text
            FROM questions
            WHERE quiz_id = :quiz_id
        """), {"quiz_id": quiz_id}).mappings().all()
        
        questions = []
        for question in questions_result:
            q_dict = dict(question)
            q_dict['id'] = str(q_dict['id'])
            
            # Fetch options
            options_result = db.execute(text("""
                SELECT option_text, is_correct
                FROM options
                WHERE question_id = :question_id
                ORDER BY option_text
            """), {"question_id": question['id']}).mappings().all()
            
            q_dict['options'] = [opt['option_text'] for opt in options_result]
            q_dict['correct_option'] = next(
                (opt['option_text'] for opt in options_result if opt['is_correct']),
                None
            )
            
            questions.append(q_dict)
        
        quiz['questions'] = questions
        return quiz
    finally:
        db.close()


@app.post("/attempts/start")
def start_attempt(attempt: QuizAttemptCreate):
    """Start a new quiz attempt"""
    db = SessionLocal()
    try:
        attempt_id = str(uuid.uuid4())
        db.execute(
            text("""
                INSERT INTO quiz_attempts (id, user_id, quiz_id, score, created_at)
                VALUES (:id, :user_id, :quiz_id, 0, NOW())
            """),
            {
                "id": attempt_id,
                "user_id": attempt.user_id,
                "quiz_id": attempt.quiz_id
            }
        )
        db.commit()
        return {"attempt_id": attempt_id, "message": "Attempt started"}
    finally:
        db.close()


@app.post("/answers")
def submit_answer(answer: AnswerSubmit):
    """Submit an answer for a question"""
    db = SessionLocal()
    try:
        db.execute(
            text("""
                INSERT INTO user_answers (id, attempt_id, question_id, option_id)
                VALUES (:id, :attempt_id, :question_id, :option_id)
            """),
            {
                "id": str(uuid.uuid4()),
                "attempt_id": answer.attempt_id,
                "question_id": answer.question_id,
                "option_id": answer.option_id
            }
        )
        db.commit()
        return {"message": "Answer recorded"}
    finally:
        db.close()


@app.post("/attempts/complete")
def complete_attempt(completion: QuizAttemptComplete):
    """Complete a quiz attempt and update the score"""
    db = SessionLocal()
    try:
        db.execute(
            text("""
                UPDATE quiz_attempts
                SET score = :score
                WHERE id = :attempt_id
            """),
            {
                "attempt_id": completion.attempt_id,
                "score": completion.score
            }
        )
        db.commit()
        return {"message": "Attempt completed", "score": completion.score}
    finally:
        db.close()


@app.get("/attempts/{user_id}")
def get_user_attempts(user_id: str):
    """Get all attempts for a user with details"""
    db = SessionLocal()
    try:
        result = db.execute(
            text("""
                SELECT qa.id, qa.quiz_id, qa.score, qa.created_at,
                       q.title, q.description
                FROM quiz_attempts qa
                JOIN quizzes2 q ON qa.quiz_id = q.id
                WHERE qa.user_id = :user_id
                ORDER BY qa.created_at DESC
            """),
            {"user_id": user_id}
        ).mappings().all()
        
        attempts = []
        for row in result:
            attempt_dict = dict(row)
            attempt_dict['id'] = str(attempt_dict['id'])
            attempt_dict['quiz_id'] = str(attempt_dict['quiz_id'])
            
            # Get question count for this quiz
            question_count = db.execute(
                text("""
                    SELECT COUNT(*) FROM questions WHERE quiz_id = :quiz_id
                """),
                {"quiz_id":row['quiz_id']}
            ).scalar()
            
            attempt_dict['total_questions'] = question_count
            attempts.append(attempt_dict)
        
        return attempts
    finally:
        db.close()