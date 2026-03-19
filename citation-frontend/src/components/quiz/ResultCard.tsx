import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface ResultCardProps {
    score: number;
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    onRetake: () => void;
    onBackToList: () => void;
}

export default function ResultCard({ score, totalQuestions, correctCount, wrongCount, onRetake, onBackToList }: ResultCardProps) {
    const percentage = Math.round((score / totalQuestions) * 100);
    const isPassed = percentage >= 60;

    return (
        <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center animate-in zoom-in-95 duration-500">
            <div className="flex justify-center mb-8">
                {isPassed ? (
                    <CheckCircle className="w-24 h-24 text-green-500" strokeWidth={1.5} />
                ) : (
                    <XCircle className="w-24 h-24 text-red-500" strokeWidth={1.5} />
                )}
            </div>

            <h2 className="text-4xl font-serif font-bold text-navy-900 mb-3">Quiz Completed!</h2>
            <p className="text-gray-500 text-lg mb-10">You have successfully finished the quiz.</p>

            <div className="grid grid-cols-3 gap-6 mb-12">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex flex-col justify-center">
                    <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider mb-2">Score</p>
                    <p className="text-4xl font-bold text-navy-900">{percentage}%</p>
                </div>
                <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex flex-col justify-center">
                    <p className="text-sm text-green-700 font-semibold uppercase tracking-wider mb-2">Correct</p>
                    <p className="text-4xl font-bold text-green-600">{correctCount}</p>
                </div>
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col justify-center">
                    <p className="text-sm text-red-700 font-semibold uppercase tracking-wider mb-2">Incorrect</p>
                    <p className="text-4xl font-bold text-red-600">{wrongCount}</p>
                </div>
            </div>

            <div className="flex gap-4 justify-center">
                <button
                    onClick={onRetake}
                    className="px-8 py-3.5 bg-navy-900 hover:bg-navy-800 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md"
                >
                    Retake Quiz
                </button>
                <button
                    onClick={onBackToList}
                    className="px-8 py-3.5 bg-white border-2 border-gray-200 hover:border-gray-300 text-navy-900 font-medium rounded-xl transition-all shadow-sm hover:shadow-md hover:bg-gray-50"
                >
                    Back to Quiz List
                </button>
            </div>
        </div>
    );
}
