import React from 'react';
import { Question } from '@/types/quiz';
import OptionButton from './OptionButton';
import { CheckCircle2, XCircle } from 'lucide-react';

interface QuestionCardProps {
    quizTitle: string;
    questionNumber: number;
    question: Question;
    selectedOptionId: string | null;
    onSelectOption: (optionId: string) => void;
}

export default function QuestionCard({ quizTitle, questionNumber, question, selectedOptionId, onSelectOption }: QuestionCardProps) {
    const isAnswered = selectedOptionId !== null;
    const selectedOption = question.options.find(o => o.id === selectedOptionId);
    const isCorrect = selectedOption?.isCorrect === true;

    return (
        <div className="w-full max-w-3xl mx-auto flex flex-col min-h-[60vh]">
            <div className="text-center mb-8">
                <h2 className="text-navy-900 font-serif text-2xl font-semibold tracking-tight">{quizTitle}</h2>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex-1 flex flex-col">
                <p className="text-sm font-bold text-navy-900/60 mb-3 uppercase tracking-wider">Question {questionNumber}</p>
                <h3 className="text-xl font-bold text-navy-900 mb-8 leading-snug">
                    {question.text}
                </h3>

                <div className="space-y-3 mb-6">
                    {question.options.map((option) => (
                        <OptionButton
                            key={option.id}
                            text={option.text}
                            isSelected={selectedOptionId === option.id}
                            isCorrect={isAnswered ? option.isCorrect : null}
                            onClick={() => onSelectOption(option.id)}
                            disabled={isAnswered}
                        />
                    ))}
                </div>

                {isAnswered && (
                    <div className={`mt-auto p-4 rounded-xl border flex items-start gap-4 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="mt-0.5 shrink-0">
                            {isCorrect ? (
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            ) : (
                                <XCircle className="w-6 h-6 text-red-600" />
                            )}
                        </div>
                        <div>
                            <p className={`font-semibold mb-1 ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                                {isCorrect ? 'Correct!' : 'Incorrect'}
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                                <span className="font-semibold mr-1">Explanation:</span>
                                {question.explanation}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
