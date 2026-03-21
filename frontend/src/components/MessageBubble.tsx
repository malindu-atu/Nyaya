'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface MessageBubbleProps {
    role: 'user' | 'system';
    content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
    const isUser = role === 'user';

    return (
        <motion.div
            initial={{ opacity: 0, y: isUser ? 12 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.3,
                ease: "easeOut",
                delay: isUser ? 0 : 0.2
            }}
            className={twMerge(
                "max-w-[80%] rounded-xl p-4 shadow-sm mb-4",
                isUser
                    ? "bg-white text-navy-900 self-end ml-auto rounded-br-none border border-grey-200"
                    : "bg-transparent text-navy-800 self-start mr-auto pl-6"
            )}
        >
            {/* System might need a logo or icon next to it, but prompt check: "interface should function as a single clean chat experience" */}
            {/* "Message bubble smoothly animates upward and aligns to the right" for user. */}

            {!isUser && (
                <div className="text-xs font-bold text-gold-500 mb-1 uppercase tracking-wide">Nyaya AI</div>
            )}

            <p className="leading-relaxed text-sm md:text-base">
                {content}
            </p>
        </motion.div>
    );
}
