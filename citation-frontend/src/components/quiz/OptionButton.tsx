import React from 'react';

interface OptionButtonProps {
    text: string;
    isSelected: boolean;
    isCorrect?: boolean | null;
    onClick: () => void;
    disabled: boolean;
}

export default function OptionButton({ text, isSelected, isCorrect, onClick, disabled }: OptionButtonProps) {
    let bgColorClass = 'bg-gray-100 hover:bg-gray-200 text-gray-800';
    let borderClass = 'border-2 border-transparent';

    if (isSelected) {
        if (isCorrect === true) {
            bgColorClass = 'bg-green-100 text-green-800';
            borderClass = 'border-2 border-green-500';
        } else if (isCorrect === false) {
            bgColorClass = 'bg-red-100 text-red-800';
            borderClass = 'border-2 border-red-500';
        } else {
            bgColorClass = 'bg-gray-200 text-gray-900';
            borderClass = 'border-2 border-gray-400';
        }
    } else if (disabled && isCorrect === true) {
        bgColorClass = 'bg-green-50 text-green-800';
        borderClass = 'border-2 border-green-300';
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${bgColorClass} ${borderClass} mb-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-navy-900/10`}
        >
            <span className="font-medium text-[15px]">{text}</span>
        </button>
    );
}
