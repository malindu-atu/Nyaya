"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Quiz } from '@/types/quiz';
import QuizCard from '@/components/quiz/QuizCard';
import QuestionCard from '@/components/quiz/QuestionCard';
import ProgressBar from '@/components/quiz/ProgressBar';
import ResultCard from '@/components/quiz/ResultCard';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { fetchQuizzes } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Calls /api/attempts to start a tracked attempt; returns the attempt_id or null. */
async function startAttempt(userId: string, quizId: string): Promise<string | null> {
  try {
    const res = await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', user_id: userId, quiz_id: quizId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.attempt_id ?? null;
  } catch {
    return null;
  }
}

/** Calls /api/attempts to mark the attempt as complete. */
async function completeAttempt(attemptId: string, score: number): Promise<void> {
  try {
    await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', attempt_id: attemptId, score }),
    });
  } catch {
    // non-fatal
  }
}

/**
 * Upserts user_stats in Supabase after a quiz is finished.
 * Calculates running averages and totals from existing stats + this attempt.
 */
async function updateUserStats(
  userId: string,
  scorePercent: number,
  durationSeconds: number
): Promise<void> {
  try {
    // 1. Fetch current stats
    const { data: existing } = await supabase
      .from('user_stats')
      .select('*')
      .eq('id', userId)
      .single();

    const prev = existing ?? {
      total_quizzes_taken: 0,
      average_score: 0,
      accuracy_rate: 0,
      highest_score: 0,
      lowest_score: 0,
      time_spent_per_quiz_seconds: 0,
      total_quizzing_time_seconds: 0,
    };

    const prevTotal = prev.total_quizzes_taken ?? 0;
    const newTotal = prevTotal + 1;

    // Running average: (old_avg * old_count + new_value) / new_count
    const newAvgScore = parseFloat(
      (((Number(prev.average_score) ?? 0) * prevTotal + scorePercent) / newTotal).toFixed(2)
    );
    const newAccuracy = parseFloat(
      (((Number(prev.accuracy_rate) ?? 0) * prevTotal + scorePercent) / newTotal).toFixed(2)
    );
    const newHighest = Math.max(prev.highest_score ?? 0, scorePercent);
    // lowest_score is 0 for brand-new rows, so treat 0 as "not yet set" when
    // the user has never completed a quiz before (prevTotal === 0).
    const newLowest =
      prevTotal === 0
        ? scorePercent
        : Math.min(prev.lowest_score ?? scorePercent, scorePercent);
    const newTotalTime = (prev.total_quizzing_time_seconds ?? 0) + durationSeconds;
    const newTimePerQuiz = Math.round(newTotalTime / newTotal);

    const statsPayload = {
      id: userId,
      total_quizzes_taken: newTotal,
      average_score: newAvgScore,
      accuracy_rate: newAccuracy,
      highest_score: newHighest,
      lowest_score: newLowest,
      time_spent_per_quiz_seconds: newTimePerQuiz,
      total_quizzing_time_seconds: newTotalTime,
    };

    // 2. Upsert (insert if row doesn't exist yet, update if it does)
    await supabase.from('user_stats').upsert(statsPayload, { onConflict: 'id' });
  } catch (err) {
    console.error('[updateUserStats] Failed:', err);
  }
}

/**
 * Inserts one row into quiz_history in Supabase.
 */
async function insertQuizHistory(
  userId: string,
  quizTitle: string,
  scorePercent: number,
  totalQuestions: number,
  correctCount: number,
  durationSeconds: number
): Promise<void> {
  try {
    await supabase.from('quiz_history').insert({
      user_id: userId,
      quiz_title: quizTitle,
      score: scorePercent,
      total_questions: totalQuestions,
      correct_answers: correctCount,
      time_taken_seconds: durationSeconds,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[insertQuizHistory] Failed:', err);
  }
}

// ─── component ───────────────────────────────────────────────────────────────

export default function QuizSystemPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);

  // ── analytics tracking refs ─────────────────────────────────────────────
  const attemptIdRef = useRef<string | null>(null);
  const quizStartTimeRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Fetch quizzes
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setFetchError(null);
        const data = await fetchQuizzes();
        setQuizzes(data);
      } catch (err) {
        setFetchError('Could not load quizzes. Please try again.');
        console.error('Failed to fetch quizzes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Resolve Supabase user once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data?.user?.id ?? null;
    });
  }, []);

  const activeQuiz = quizzes.find(q => q.id === activeQuizId);
  const question = activeQuiz?.questions[currentQuestion];

  const handleStartQuiz = async (quizId: string) => {
    setActiveQuizId(quizId);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    setQuizCompleted(false);

    // Record start time
    quizStartTimeRef.current = Date.now();

    // Start a tracked attempt if we have a user
    if (userIdRef.current) {
      const id = await startAttempt(userIdRef.current, quizId);
      attemptIdRef.current = id;
    }
  };

  const handleSelectOption = (optionId: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(optionId);
    const option = question?.options.find(o => o.id === optionId);
    if (option?.isCorrect) {
      setScore(prev => prev + 1);
      setCorrectCount(prev => prev + 1);
    } else {
      setWrongCount(prev => prev + 1);
    }
  };

  const handleNextQuestion = async () => {
    if (!activeQuiz) return;
    if (currentQuestion < activeQuiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      // ── Quiz finished ──────────────────────────────────────────────────
      setQuizCompleted(true);

      const totalQuestions = activeQuiz.questions.length;
      // finalCorrect = correctCount + 1 if the last answer was correct
      // (score state hasn't flushed yet for this tick, so compute from raw)
      const option = question?.options.find(o => o.id === selectedAnswer);
      const lastCorrect = option?.isCorrect ? 1 : 0;
      const finalCorrect = correctCount + lastCorrect;
      const scorePercent = totalQuestions > 0
        ? Math.round((finalCorrect / totalQuestions) * 100)
        : 0;

      const durationSeconds = quizStartTimeRef.current
        ? Math.round((Date.now() - quizStartTimeRef.current) / 1000)
        : 0;

      // Fire-and-forget analytics saves (non-blocking)
      if (attemptIdRef.current) {
        completeAttempt(attemptIdRef.current, scorePercent);
      }

      if (userIdRef.current) {
        updateUserStats(userIdRef.current, scorePercent, durationSeconds);
        insertQuizHistory(
          userIdRef.current,
          activeQuiz.title,
          scorePercent,
          totalQuestions,
          finalCorrect,
          durationSeconds
        );
      }
    }
  };

  const resetQuiz = () => {
    if (activeQuizId) handleStartQuiz(activeQuizId);
  };

  const backToList = () => {
    setActiveQuizId(null);
    setQuizCompleted(false);
  };

  const Watermark = () => (
    <div className="absolute top-0 right-0 bottom-0 pointer-events-none z-0 opacity-[0.1] overflow-hidden flex justify-end items-end pb-12 pr-12 lg:pb-0 lg:pr-0 lg:items-center">
      <img src="/logolaw.png" alt="Nyaya Background" className="h-[70vh] md:h-[90vh] lg:h-[120vh] max-w-none lg:translate-x-[15%] lg:translate-y-[20%] translate-x-[20%] translate-y-[15%] object-contain select-none grayscale" />
    </div>
  );

  // View: Quiz List
  if (!activeQuizId || !activeQuiz) {
    return (
      <div className="min-h-screen bg-white p-6 md:p-12 pb-24 relative overflow-hidden font-sans">
        <Watermark />
        <div className="max-w-6xl mx-auto relative z-10 pt-4 mt-4">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-sm">
                <ArrowLeft className="w-5 h-5 text-navy-900" />
              </Link>
              <h1 className="text-4xl font-serif font-bold text-navy-900">Revision Quizzes</h1>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoading ? (
              <div className="col-span-full py-12 flex justify-center text-navy-900/60 font-medium">
                Loading quizzes...
              </div>
            ) : fetchError ? (
              <div className="col-span-full py-12 flex flex-col items-center gap-4">
                <p className="text-red-500 font-medium">{fetchError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition text-sm"
                >
                  Retry
                </button>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="col-span-full py-12 flex justify-center text-navy-900/60 font-medium">
                No quizzes found.
              </div>
            ) : (
              quizzes.map(quiz => (
                <QuizCard key={quiz.id} quiz={quiz} onClick={handleStartQuiz} />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // View: Result
  if (quizCompleted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 pb-20 relative font-sans">
        <div className="absolute top-24 md:top-28 left-8 z-10">
          <button onClick={backToList} className="flex items-center text-sm font-medium text-navy-900/60 hover:text-navy-900 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Quizzes
          </button>
        </div>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-serif text-teal-700/80 tracking-wide">{activeQuiz.title}</h2>
        </div>
        <ResultCard
          score={score}
          totalQuestions={activeQuiz.questions.length}
          correctCount={correctCount}
          wrongCount={wrongCount}
          onRetake={resetQuiz}
          onBackToList={backToList}
        />
      </div>
    );
  }

  // View: Active Question
  return (
    <div className="min-h-screen bg-white flex flex-col p-6 md:p-12 pb-24 relative overflow-hidden font-sans">
      <Watermark />
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col relative z-10 pt-4 mt-4">
        <div className="flex items-center justify-between mb-8">
          <button onClick={backToList} className="flex items-center px-4 py-2 bg-white rounded-full text-sm font-medium text-navy-900 hover:bg-gray-100 transition shadow-sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div className="w-24 border border-transparent"></div>
        </div>

        {question && (
          <div className="flex-1 flex flex-col justify-center">
            <QuestionCard
              quizTitle={activeQuiz.title}
              questionNumber={currentQuestion + 1}
              question={question}
              selectedOptionId={selectedAnswer}
              onSelectOption={handleSelectOption}
            />
          </div>
        )}

        <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="w-1/3 text-left"></div>
            <div className="w-1/3 flex justify-center"></div>
            <div className="w-1/3 flex justify-end">
              <button
                onClick={handleNextQuestion}
                disabled={!selectedAnswer}
                className={`flex items-center px-8 py-3 rounded-xl font-medium transition-all ${selectedAnswer ? 'bg-navy-900 text-white hover:bg-navy-800 shadow-md' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                {currentQuestion < activeQuiz.questions.length - 1 ? 'Next' : 'Finish'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
          <ProgressBar current={selectedAnswer ? currentQuestion + 1 : currentQuestion} total={activeQuiz.questions.length} />
        </div>
      </div>
    </div>
  );
}
