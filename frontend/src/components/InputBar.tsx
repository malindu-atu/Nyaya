'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface InputBarProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export default function InputBar({ onSend, disabled }: InputBarProps) {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !disabled) {
            onSend(input);
            setInput('');
        }
    };

    return (
        <div className="w-full relative transition-all">
            <form
                onSubmit={handleSubmit}
                className="relative flex items-center gap-2 bg-white rounded-2xl shadow-lg border border-grey-200 hover:border-gold-500/30 transition-colors p-2 pl-4"
            >
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