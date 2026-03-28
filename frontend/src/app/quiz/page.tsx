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

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function saveQuizResult(
  userId: string,
  quizTitle: string,
  correctAnswers: number,
  totalQuestions: number,
  durationSeconds: number
) {
  const scorePercent = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;

  // 1. Read the user's current stats row
  const { data: existing, error: fetchError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = row not found, which we handle below
    console.error('[saveQuizResult] fetch error:', fetchError);
  }

  const prev = existing ?? {
    total_quizzes_taken: 0,
    average_score: 0,
    accuracy_rate: 0,
    highest_score: 0,
    lowest_score: 0,
    time_spent_per_quiz_seconds: 0,
    total_quizzing_time_seconds: 0,
  };

  const prevTotal: number = Number(prev.total_quizzes_taken) || 0;
  const newTotal = prevTotal + 1;

  // Running weighted average for score and accuracy
  const newAvgScore = parseFloat(
    (((Number(prev.average_score) || 0) * prevTotal + scorePercent) / newTotal).toFixed(2)
  );
  const newAccuracy = parseFloat(
    (((Number(prev.accuracy_rate) || 0) * prevTotal + scorePercent) / newTotal).toFixed(2)
  );
  const newHighest = Math.max(Number(prev.highest_score) || 0, scorePercent);
  // If prevTotal is 0 the user has no prior quizzes — lowest_score starts at this score
  const prevLowest = Number(prev.lowest_score) || 0;
  const newLowest = prevTotal === 0 ? scorePercent : Math.min(prevLowest, scorePercent);
  const newTotalTime = (Number(prev.total_quizzing_time_seconds) || 0) + durationSeconds;
  const newTimePerQuiz = Math.round(newTotalTime / newTotal);

  const statsPayload = {
    total_quizzes_taken: newTotal,
    average_score: newAvgScore,
    accuracy_rate: newAccuracy,
    highest_score: newHighest,
    lowest_score: newLowest,
    time_spent_per_quiz_seconds: newTimePerQuiz,
    total_quizzing_time_seconds: newTotalTime,
  };

  // 2. Update or insert user_stats
  if (existing) {
    // Row exists — use UPDATE (avoids upsert RLS conflicts)
    const { error } = await supabase
      .from('user_stats')
      .update(statsPayload)
      .eq('id', userId);
    if (error) console.error('[saveQuizResult] stats UPDATE error:', error);
  } else {
    // No row yet — INSERT
    const { error } = await supabase
      .from('user_stats')
      .insert({ id: userId, ...statsPayload });
    if (error) console.error('[saveQuizResult] stats INSERT error:', error);
  }

  // 3. Insert into quiz_history
  const { error: historyError } = await supabase.from('quiz_history').insert({
    user_id: userId,
    quiz_name: quizTitle,
    score: scorePercent,
    total_questions: totalQuestions,
    time_taken_seconds: durationSeconds,
  });

  if (historyError) {
    console.error('[saveQuizResult] history INSERT error:', historyError);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function QuizSystemPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);           // raw correct count for ResultCard
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);

  // Refs to read reliable values inside async callbacks (avoids stale closures)
  const correctCountRef = useRef<number>(0);
  const quizStartTimeRef = useRef<number>(Date.now());
  const userIdRef = useRef<string | null>(null);
  const isSavingRef = useRef<boolean>(false);  // prevent double-save on fast clicks

  // Fetch quizzes on mount
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  // Resolve current user once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data?.user?.id ?? null;
    });
  }, []);

  const activeQuiz = quizzes.find(q => q.id === activeQuizId);
  const question = activeQuiz?.questions[currentQuestion];

  const handleStartQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    correctCountRef.current = 0;
    quizStartTimeRef.current = Date.now();
    isSavingRef.current = false;
  };

  const handleSelectOption = (optionId: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(optionId);
    const option = question?.options.find(o => o.id === optionId);
    if (option?.isCorrect) {
      setScore(prev => prev + 1);
      setCorrectCount(prev => prev + 1);
      correctCountRef.current += 1;   // sync ref immediately — state update is async
    } else {
      setWrongCount(prev => prev + 1);
    }
  };

  const handleNextQuestion = async () => {
    if (!activeQuiz) return;

    const isLastQuestion = currentQuestion >= activeQuiz.questions.length - 1;

    if (!isLastQuestion) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      return;
    }

    // ── Last question: finish the quiz ──────────────────────────────────
    if (isSavingRef.current) return;   // guard against double-tap
    isSavingRef.current = true;

    setQuizCompleted(true);

    const durationSeconds = Math.round((Date.now() - quizStartTimeRef.current) / 1000);
    // Read from ref — guaranteed correct even with async React state lag
    const finalCorrect = correctCountRef.current;

    if (userIdRef.current) {
      await saveQuizResult(
        userIdRef.current,
        activeQuiz.title,
        finalCorrect,
        activeQuiz.questions.length,
        durationSeconds
      );
    } else {
      console.warn('[QuizPage] No userId — user may not be logged in, stats not saved.');
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
      <img
        src="/logolaw.png"
        alt="Nyaya Background"
        className="h-[70vh] md:h-[90vh] lg:h-[120vh] max-w-none lg:translate-x-[15%] lg:translate-y-[20%] translate-x-[20%] translate-y-[15%] object-contain select-none grayscale"
      />
    </div>
  );

  // ── View: Quiz List ──────────────────────────────────────────────────────
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

  // ── View: Result ─────────────────────────────────────────────────────────
  if (quizCompleted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 pb-20 relative font-sans">
        <div className="absolute top-24 md:top-28 left-8 z-10">
          <button
            onClick={backToList}
            className="flex items-center text-sm font-medium text-navy-900/60 hover:text-navy-900 transition-colors"
          >
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

  // ── View: Active Question ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col p-6 md:p-12 pb-24 relative overflow-hidden font-sans">
      <Watermark />
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col relative z-10 pt-4 mt-4">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={backToList}
            className="flex items-center px-4 py-2 bg-white rounded-full text-sm font-medium text-navy-900 hover:bg-gray-100 transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div className="w-24 border border-transparent" />
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
            <div className="w-1/3 text-left" />
            <div className="w-1/3 flex justify-center" />
            <div className="w-1/3 flex justify-end">
              <button
                onClick={handleNextQuestion}
                disabled={!selectedAnswer}
                className={`flex items-center px-8 py-3 rounded-xl font-medium transition-all ${
                  selectedAnswer
                    ? 'bg-navy-900 text-white hover:bg-navy-800 shadow-md'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {currentQuestion < activeQuiz.questions.length - 1 ? 'Next' : 'Finish'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
          <ProgressBar
            current={selectedAnswer ? currentQuestion + 1 : currentQuestion}
            total={activeQuiz.questions.length}
          />
        </div>
      </div>
    </div>
  );
}
