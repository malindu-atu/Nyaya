import React from 'react';

interface ProgressBarProps {
    current: number;
    total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
    const percentage = Math.round((current / total) * 100);

    return (
        <div className="w-full flex items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-100">
            <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-navy-900 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="text-xs text-navy-900/60 font-medium whitespace-nowrap min-w-[12rem] text-right">
                Progress: {current} of {total} questions answered
            </span>
        </div>
    );
}
