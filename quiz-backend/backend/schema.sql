-- Nyaya Quiz - Supabase Database Schema
-- This file documents the current database structure
-- Use this as reference when making changes to your Supabase database

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- QUIZZES TABLE
-- Stores quiz metadata (title, description)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quizzes2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quizzes2_created_at ON quizzes2(created_at DESC);

-- ============================================================================
-- QUESTIONS TABLE
-- Stores individual questions linked to quizzes
-- ============================================================================
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes2(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

-- ============================================================================
-- OPTIONS TABLE
-- Stores multiple choice options for each question
-- ============================================================================
CREATE TABLE IF NOT EXISTS options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_options_question_id ON options(question_id);
CREATE INDEX IF NOT EXISTS idx_options_is_correct ON options(is_correct);

-- ============================================================================
-- QUIZ ATTEMPTS TABLE
-- Tracks when users complete quizzes
-- ============================================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes2(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at ON quiz_attempts(created_at DESC);

-- ============================================================================
-- USER ANSWERS TABLE
-- Stores individual answers for each question attempt
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    option_id UUID REFERENCES options(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_answers_attempt_id ON user_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_question_id ON user_answers(question_id);

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Example: Insert a quiz
-- INSERT INTO quizzes2 (title, description) 
-- VALUES ('General Knowledge', 'Test your general knowledge with these questions');

-- Example: Insert a question
-- INSERT INTO questions (quiz_id, question_text)
-- VALUES ('your-quiz-id-here', 'What is the capital of France?');

-- Example: Insert options
-- INSERT INTO options (question_id, option_text, is_correct)
-- VALUES 
--   ('your-question-id-here', 'London', FALSE),
--   ('your-question-id-here', 'Paris', TRUE),
--   ('your-question-id-here', 'Berlin', FALSE),
--   ('your-question-id-here', 'Madrid', FALSE);

-- ============================================================================
-- USEFUL QUERIES
-- ============================================================================

-- Get all quizzes with question counts
-- SELECT 
--     q.id, 
--     q.title, 
--     q.description, 
--     COUNT(qs.id) as question_count
-- FROM quizzes2 q
-- LEFT JOIN questions qs ON q.id = qs.quiz_id
-- GROUP BY q.id, q.title, q.description
-- ORDER BY q.created_at DESC;

-- Get a quiz with all questions and options
-- SELECT 
--     q.id as quiz_id,
--     q.title,
--     qs.id as question_id,
--     qs.question_text,
--     o.id as option_id,
--     o.option_text,
--     o.is_correct
-- FROM quizzes2 q
-- JOIN questions qs ON q.id = qs.quiz_id
-- JOIN options o ON qs.id = o.question_id
-- WHERE q.id = 'your-quiz-id-here'
-- ORDER BY qs.id, o.option_text;

-- Get user's quiz history with scores
-- SELECT 
--     qa.id,
--     qa.created_at,
--     q.title as quiz_title,
--     qa.score,
--     COUNT(qs.id) as total_questions
-- FROM quiz_attempts qa
-- JOIN quizzes2 q ON qa.quiz_id = q.id
-- JOIN questions qs ON q.id = qs.quiz_id
-- WHERE qa.user_id = 'your-user-id-here'
-- GROUP BY qa.id, qa.created_at, q.title, qa.score
-- ORDER BY qa.created_at DESC;
