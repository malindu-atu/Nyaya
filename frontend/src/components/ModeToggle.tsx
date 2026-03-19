'use client';

import React from 'react';
import { motion } from 'framer-motion';

export type SearchMode = "vector" | "graph";

interface ModeToggleProps {
    mode: SearchMode;
    onChange: (mode: SearchMode) => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-grey-200 p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300 w-max">
            <div className="relative flex items-center bg-grey-50 rounded-xl p-1 w-[240px]">
                {/* Animated Pill */}
                <motion.div
                    className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[10px] shadow-sm border border-grey-200"
                    initial={false}
                    animate={{
                        left: mode === 'vector' ? '4px' : 'calc(50%)'
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />

                <button
                    type="button"
                    onClick={() => onChange('vector')}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium transition-colors duration-200 ${mode === 'vector' ? 'text-navy-900' : 'text-navy-900/50 hover:text-navy-900/70'
                        }`}
                >
                    Vector
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${mode === 'vector' ? 'bg-grey-200 text-navy-900' : 'bg-grey-200/50 text-navy-900/40'
                        }`}>
                        50
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => onChange('graph')}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium transition-colors duration-200 ${mode === 'graph' ? 'text-navy-900' : 'text-navy-900/50 hover:text-navy-900/70'
                        }`}
                >
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${mode === 'graph' ? 'bg-grey-200 text-navy-900' : 'bg-grey-200/50 text-navy-900/40'
                        }`}>
                        50
                    </span>
                    Graph
                </button>
            </div>
        </div>
    );
}
