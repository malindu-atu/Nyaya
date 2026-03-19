'use client';

import React, { useState } from 'react';
import { Send, SlidersHorizontal } from 'lucide-react';
import ModeToggle, { SearchMode } from './ModeToggle';

interface InputBarProps {
    onSend: (message: string, mode: SearchMode) => void;
    disabled?: boolean;
}

export default function InputBar({ onSend, disabled }: InputBarProps) {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<SearchMode>('vector');
    const [showModeToggle, setShowModeToggle] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !disabled) {
            onSend(input, mode);
            setInput('');
            setShowModeToggle(false);
        }
    };

    return (
        <div className="w-full relative transition-all">
            {showModeToggle && (
                <div className="absolute -top-[72px] left-0">
                    <ModeToggle mode={mode} onChange={setMode} />
                </div>
            )}
            <form
                onSubmit={handleSubmit}
                className="relative flex items-center gap-2 bg-white rounded-2xl shadow-lg border border-grey-200 hover:border-gold-500/30 transition-colors p-2 pl-4"
            >
                <div className="text-navy-900 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setShowModeToggle((prev) => !prev)}
                        className={`p-2 rounded-xl transition-colors ${showModeToggle ? 'bg-grey-100 text-navy-900' : 'text-navy-900/50 hover:bg-grey-50 hover:text-navy-900'
                            }`}
                        aria-label="Toggle search mode"
                    >
                        <SlidersHorizontal className="w-5 h-5" />
                    </button>
                </div>

                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything legal..."
                    disabled={disabled}
                    className="flex-1 bg-transparent border-none outline-none text-navy-900 placeholder:text-navy-900/40 py-2 h-12"
                />

                <button
                    type="submit"
                    disabled={!input.trim() || disabled}
                    className="p-3 bg-navy-900 text-gold-500 rounded-xl hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-gold-500/20 group"
                >
                    <Send className="w-5 h-5 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
            </form>
            <div className="text-center mt-4">
                <p className="text-[10px] text-[#A3A3A3]">
                    This is for informational purposes only, not legal advice. Consult a qualified attorney for legal matters.
                </p>
            </div>
        </div>
    );
}
