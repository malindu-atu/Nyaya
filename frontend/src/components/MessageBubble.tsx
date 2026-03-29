'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';

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
            {!isUser && (
                <div className="text-xs font-bold text-gold-500 mb-1 uppercase tracking-wide">Nyaya AI</div>
            )}

            {isUser ? (
                <p className="leading-relaxed text-sm md:text-base">{content}</p>
            ) : (
                <div className="leading-relaxed text-sm md:text-base prose prose-sm max-w-none
                    prose-headings:text-navy-800 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
                    prose-strong:text-navy-900 prose-strong:font-semibold
                    prose-ul:my-2 prose-ul:pl-4
                    prose-li:my-0.5 prose-li:leading-relaxed
                    prose-p:my-1.5 prose-p:leading-relaxed
                    prose-hr:my-3 prose-hr:border-grey-200">
                    <ReactMarkdown
                        components={{
                            // Render citation lines (e.g. "SC/APPEAL/169/2019, p.8") as styled chips
                            p: ({ children }) => {
                                const text = String(children);
                                const isCitation = /^SC\/|^HC\/|^CA\/|^DC\//.test(text.trim());
                                if (isCitation) {
                                    return (
                                        <span className="inline-block bg-gold-50 border border-gold-200 text-gold-700 text-xs font-mono px-2 py-0.5 rounded mr-2 mb-1">
                                            {children}
                                        </span>
                                    );
                                }
                                return <p className="my-1.5">{children}</p>;
                            },
                            // Style bold text (Answer:, Summary:, etc.) as section headers
                            strong: ({ children }) => (
                                <strong className="text-navy-900 font-semibold">{children}</strong>
                            ),
                            // Style list items cleanly
                            li: ({ children }) => (
                                <li className="my-0.5">{children}</li>
                            ),
                            // Horizontal rule as subtle divider
                            hr: () => <hr className="my-3 border-grey-200" />,
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            )}
        </motion.div>
    );
}
