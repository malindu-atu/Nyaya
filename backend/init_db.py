import os
import uuid
from sqlalchemy import text
from database import engine

def init_db():
    print("Initializing database...")
    
    # Read schema.sql
    try:
        with open("schema.sql", "r") as f:
            schema_sql = f.read()
    except FileNotFoundError:
        print("Error: schema.sql not found.")
        return

    with engine.connect() as connection:
        # Begin transaction
        trans = connection.begin()
        try:
            # Execute schema.sql to create tables
            print("Creating schema...")
            # Split schema by statement if needed, but simple execution often works for postgres
            # For robustness, let's just execute the whole block. 
            # If there are issues with multiple statements, we might need to split by ';'
            connection.execute(text(schema_sql))
            
            # Check if data exists in quizzes2 table
            result = connection.execute(text("SELECT count(*) FROM quizzes2"))
            count = result.scalar()
            
            if count == 0:
                print("Adding sample data...")
                
                # Generate IDs
                quiz_id = str(uuid.uuid4())
                q1_id = str(uuid.uuid4())
                q2_id = str(uuid.uuid4())
                
                # Insert Quiz
                connection.execute(text("""
                    INSERT INTO quizzes2 (id, title, description)
                    VALUES (:id, 'General Knowledge', 'Test your general knowledge with these questions')
                """), {"id": quiz_id})
                
                # Insert Question 1
                connection.execute(text("""
                    INSERT INTO questions (id, quiz_id, question_text)
                    VALUES (:id, :quiz_id, 'What is the capital of France?')
                """), {"id": q1_id, "quiz_id": quiz_id})
                
                # Insert Options for Q1
                connection.execute(text("""
                    INSERT INTO options (question_id, option_text, is_correct)
                    VALUES 
                    (:q_id, 'London', FALSE),
                    (:q_id, 'Paris', TRUE),
                    (:q_id, 'Berlin', FALSE),
                    (:q_id, 'Madrid', FALSE)
                """), {"q_id": q1_id})

                # Insert Question 2
                connection.execute(text("""
                    INSERT INTO questions (id, quiz_id, question_text)
                    VALUES (:id, :quiz_id, 'Which language is primarily used for web development in the browser?')
                """), {"id": q2_id, "quiz_id": quiz_id})
                
                # Insert Options for Q2
                connection.execute(text("""
                    INSERT INTO options (question_id, option_text, is_correct)
                    VALUES 
                    (:q_id, 'Python', FALSE),
                    (:q_id, 'JavaScript', TRUE),
                    (:q_id, 'C++', FALSE),
                    (:q_id, 'Java', FALSE)
                """), {"q_id": q2_id})

            trans.commit()
            print("Database initialized successfully!")
        except Exception as e:
            trans.rollback()
            print(f"Error initializing database: {e}")
            raise

if __name__ == "__main__":
    init_db()
