'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

// Generate or retrieve user ID from localStorage
const getUserId = () => {
  if (typeof window === 'undefined') return null;
  
  let userId = localStorage.getItem('nyaya_user_id');
  if (!userId) {
    // Generate a simple UUID v4
    userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem('nyaya_user_id', userId);
  }
  return userId;
};

export default function QuizPage({ params }) {
  const{ id: quizId } = use(params);
  
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [userId, setUserId] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Set user ID
    setUserId(getUserId());
    
    // Fetch quiz data from API
    fetch(`http://127.0.0.1:8000/quizzes/${quizId}`)
      .then(res => res.json())
      .then(data => {
        setQuiz(data);
        // Start quiz attempt
        if (data.questions && data.questions.length > 0) {
          startAttempt(data.id);
        }
      })
      .catch(err => console.error('Error loading quiz:', err));
  }, [quizId]);

  const startAttempt = async (quizId) => {
    const userId = getUserId();
    if (!userId) return;
    
    try {
      const response = await fetch('http://127.0.0.1:8000/attempts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          quiz_id: quizId
        })
      });
      const data = await response.json();
      setAttemptId(data.attempt_id);
    } catch (err) {
      console.error('Error starting attempt:', err);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    if (showExplanation) return;
    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = async () => {
    if (selectedAnswer === null) return;
    
    const question = quiz.questions[currentQuestion];
    const selectedOption = question.options[selectedAnswer];
    const isCorrect = selectedOption === question.correct_option;
    
    if (isCorrect) {
      setScore(score + 1);
    }
    
    setShowExplanation(true);
    
    // Note: Options table in Supabase doesn't have IDs exposed easily
    // We'll skip individual answer recording for now and just track the final score
  };

  const handleNext = () => {
    if (currentQuestion + 1 < quiz.questions.length) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      completeAttempt();
      setShowResult(true);
    }
  };

  const completeAttempt = async () => {
    if (!attemptId) return;
    
    try {
      await fetch('http://127.0.0.1:8000/attempts/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: attemptId,
          score: score
        })
      });
    } catch (err) {
      console.error('Error completing attempt:', err);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setScore(0);
    setShowResult(false);
    setShowExplanation(false);
    if (quiz) {
      startAttempt(quiz.id);
    }
  };

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading quiz...</div>
      </div>
    );
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl text-gray-600 mb-4">
            This quiz has no questions yet
          </div>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (showResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Quiz Complete!</h2>
          <p className="text-2xl text-gray-600 mb-8">
            Your Score: <span className="font-bold text-indigo-600">{score}</span> out of{' '}
            <span className="font-bold">{quiz.questions.length}</span>
          </p>
          <div className="mb-8">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${(score / quiz.questions.length) * 100}%` }}
              ></div>
            </div>
            <p className="text-lg text-gray-600 mt-2">
              {Math.round((score / quiz.questions.length) * 100)}% Correct
            </p>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleRestart}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Retry Quiz
            </button>
            <button
              onClick={() => router.push('/history')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              View History
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{quiz.title}</h1>
                <p className="text-sm text-gray-600 mt-1">{quiz.description}</p>
              </div>
              <span className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-full">
                Question {currentQuestion + 1} of {quiz.questions.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Question */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">{question.question_text || question.question}</h2>
            <div className="space-y-3">
              {question.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = option === question.correct_option;
                
                let buttonClass = 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50';
                
                if (showExplanation) {
                  if (isCorrect) {
                    buttonClass = 'border-green-500 bg-green-50';
                  } else if (isSelected && !isCorrect) {
                    buttonClass = 'border-red-500 bg-red-50';
                  }
                } else if (isSelected) {
                  buttonClass = 'border-indigo-500 bg-indigo-50 shadow-md';
                }
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={showExplanation}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${buttonClass}`}
                  >
                    <div className="flex items-center">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        showExplanation && isCorrect
                          ? 'bg-green-500 text-white'
                          : showExplanation && isSelected && !isCorrect
                          ? 'bg-red-500 text-white'
                          : isSelected
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {showExplanation && isCorrect ? '✓' : 
                         showExplanation && isSelected && !isCorrect ? '✗' :
                         String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-gray-800">{option}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Explanation (if available) */}
          {showExplanation && question.explanation && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Explanation:</h3>
              <p className="text-blue-700">{question.explanation}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-800 font-semibold"
            >
              ← Exit Quiz
            </button>
            {!showExplanation ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
                className={`font-semibold py-3 px-8 rounded-lg transition-all ${
                  selectedAnswer === null
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                {currentQuestion + 1 === quiz.questions.length ? 'Finish' : 'Next Question'} →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
