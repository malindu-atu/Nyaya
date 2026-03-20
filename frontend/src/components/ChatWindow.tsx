'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import { SearchMode } from './ModeToggle';
import { User } from 'lucide-react';

export interface Message {
    id: string;
    role: 'user' | 'system';
    content: string;
    timestamp?: Date;
}

interface ChatWindowProps {
    messages: Message[];
    isTyping: boolean;
    onSendMessage: (content: string, mode: SearchMode) => void;
}

export default function ChatWindow({ messages, isTyping, onSendMessage }: ChatWindowProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    const handleSend = (content: string, mode: SearchMode) => {
        onSendMessage(content, mode);
    };

    return (
        <div className="flex-1 relative flex flex-col h-screen bg-grey-50 overflow-hidden font-sans">
            {/* Watermark Background */}
            <div className="absolute top-0 right-0 bottom-0 pointer-events-none z-0 opacity-[0.1] overflow-hidden flex justify-end items-end pb-12 pr-12 lg:pb-0 lg:pr-0 lg:items-center">
                <img src="/logolaw.png" alt="Nyaya Background" className="h-[70vh] md:h-[90vh] lg:h-[120vh] max-w-none lg:translate-x-[15%] lg:translate-y-[20%] translate-x-[20%] translate-y-[15%] object-contain select-none grayscale" />
            </div>

            {/* Navbar */}
            <div className="w-full absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 md:p-6">
                <div className="flex items-center gap-2.5">
                    <img src="/nyayalogo.png" alt="Nyaya Logo" className="h-8 md:h-10 w-auto" />
                    <span className="font-serif font-bold text-navy-900 text-lg md:text-xl tracking-tight">NYAYA.LK</span>
                </div>
                <button className="w-11 h-11 md:w-12 md:h-12 bg-navy-900 text-white rounded-full hover:bg-navy-800 transition shadow-sm flex items-center justify-center">
                    <User className="w-5 h-5 md:w-5 md:h-5 text-gold-500" />
                </button>
            </div>

            {/* Chat Content or Empty State */}
            <div className="flex-1 overflow-y-auto z-10 custom-scrollbar relative">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full px-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl md:text-[22px] text-gold-500 leading-relaxed font-normal">
                                Hi , What do you<br />
                                want to search in <span className="font-medium font-sans">Sri Lankan Cases</span> ?
                            </h2>
                        </div>
                        <div className="w-full max-w-3xl">
                            <InputBar onSend={handleSend} disabled={isTyping} />
                        </div>
                    </div>
                ) : (
                    <div className="p-4 md:p-8 pb-32">
                        <div className="max-w-3xl mx-auto flex flex-col gap-6">
                            <AnimatePresence>
                                {messages.map((msg) => (
                                    <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
                                ))}
                            </AnimatePresence>

                            {isTyping && (
                                <div className="self-start text-navy-400 text-sm ml-2 animate-pulse flex items-center gap-1">
                                    <span>Nyaya is thinking</span>
                                    <span className="animate-bounce">.</span>
                                    <span className="animate-bounce delay-75">.</span>
                                    <span className="animate-bounce delay-150">.</span>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed Input Area for active chat */}
            {messages.length > 0 && (
                <div className="w-full max-w-4xl mx-auto p-4 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-grey-50 via-grey-50 to-transparent pt-10 pb-6 z-20">
                    <InputBar onSend={handleSend} disabled={isTyping} />
                </div>
            )}
        </div>
    );
}
