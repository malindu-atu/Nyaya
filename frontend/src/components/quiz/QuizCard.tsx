import React from 'react';
import { Clock } from 'lucide-react';
import { Quiz } from '@/types/quiz';

interface QuizCardProps {
    quiz: Quiz;
    onClick: (quizId: string) => void;
}

export default function QuizCard({ quiz, onClick }: QuizCardProps) {
    const difficultyStyles = {
        Easy: {
            border: 'border-b-green-500',
            text: 'text-green-600',
        },
        Medium: {
            border: 'border-b-yellow-500',
            text: 'text-yellow-600',
        },
        Hard: {
            border: 'border-b-red-500',
            text: 'text-red-600',
        },
    };

    // Add a fallback (||) to ensure style is never undefined
    const style = difficultyStyles[quiz.difficulty] || difficultyStyles['Medium'] || {
        border: 'border-gray-200',
        text: 'text-gray-600',
        bg: 'bg-gray-100'
    };

    return (
        <div
            onClick={() => onClick(quiz.id)}
            className={`bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border-b-4 ${style.border} flex flex-col h-full`}
        >
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-serif text-xl font-bold text-navy-900 leading-tight pr-4">
                    {quiz.title}
                </h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-md bg-gray-50 bg-opacity-50 ${style.text}`}>
                    {quiz.difficulty}
                </span>
            </div>
            <p className="text-sm text-gray-600 mb-6 flex-grow line-clamp-3">
                {quiz.description}
            </p>
            <div className="flex items-center text-gray-400 text-sm font-medium">
                <Clock className="w-4 h-4 mr-2" />
                <span>{quiz.durationMinutes} minutes</span>
            </div>
        </div>
    );
}
