import React, { useState, useRef, useEffect } from 'react';
import { Menu, Plus, HelpCircle, Pin, Trash2, MoreHorizontal, Share2, Edit2, Check, X, PanelLeftClose, Sun, Moon } from 'lucide-react';
import { ChatSession } from '@/app/page';
import Link from 'next/link';

interface SidebarProps {
    onNewChat: () => void;
    history: ChatSession[];
    onPin: (id: string) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newTitle: string) => void;
    onShare: (id: string) => void;
    activeChatId: string | null;
    onSelectChat: (id: string) => void;
    isOpen: boolean;
    width: number;
    onToggle: () => void;
    onResizeStart: () => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

export default function Sidebar({
    onNewChat,
    history,
    onPin,
    onDelete,
    onRename,
    onShare,
    activeChatId,
    onSelectChat,
    isOpen,
    width,
    onToggle,
    onResizeStart,
    theme,
    onToggleTheme
}: SidebarProps) {
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // UseEffect to focus input when editing starts
    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingId]);

    const handleStartRename = (item: ChatSession) => {
        setEditingId(item.id);
        setEditTitle(item.title);
        setActiveMenuId(null);
    };

    const handleSaveRename = () => {
        if (editingId && editTitle.trim()) {
            onRename(editingId, editTitle.trim());
            setEditingId(null);
        } else {
            setEditingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="h-screen bg-navy-900 flex flex-col text-white shadow-2xl z-20 font-sans relative flex-shrink-0 transition-colors duration-300"
            style={{ width: width }}
        >
            {/* Header / Menu */}
            <div className="p-6 flex items-center justify-between">
                <button onClick={onToggle} className="p-2 hover:bg-navy-800 rounded-lg transition-colors text-white/70 hover:text-white" title="Close Sidebar">
                    <PanelLeftClose className="w-6 h-6" />
                </button>

                {/* Theme Toggle */}
            
            </div>

            {/* Main Actions */}
            <div className="px-4 space-y-2 mb-6">
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-navy-800 hover:bg-navy-800/80 rounded-xl transition-all border border-navy-800 hover:border-gold-500/30 group"
                >
                    <Plus className="w-5 h-5 text-gold-500 group-hover:text-gold-400" />
                    <span className="font-medium text-sm truncate">New Chat</span>
                </button>

                <Link href="/quiz" className="w-full flex items-center gap-3 px-4 py-3 hover:bg-navy-800 rounded-xl transition-colors text-white/80 hover:text-white">
                    <HelpCircle className="w-5 h-5" />
                    <span className="font-medium text-sm truncate">Quiz Me</span>
                </Link>
            </div>

            {/* History Section */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar pb-20">
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 px-2">History</h3>
                {history.length === 0 && (
                    <p className="text-white/30 text-xs px-2 italic">No recent history</p>
                )}
                {history.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => onSelectChat(item.id)}
                        className={`group flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm transition-all relative cursor-pointer
              ${activeChatId === item.id
                                ? 'bg-navy-800 text-white border-l-2 border-gold-500 rounded-l-none'
                                : item.isPinned
                                    ? 'bg-navy-800/50 text-gold-400'
                                    : 'text-white/70 hover:bg-navy-800/50 hover:text-white'}
            `}
                    >
                        {editingId === item.id ? (
                            <div className="flex items-center gap-2 w-full">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="bg-navy-900 text-white border border-gold-500 rounded px-2 py-1 text-xs w-full outline-none"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); }}
                                />
                                <button onClick={handleSaveRename} className="p-1 hover:text-green-400"><Check size={14} /></button>
                                <button onClick={() => setEditingId(null)} className="p-1 hover:text-red-400"><X size={14} /></button>
                            </div>
                        ) : (
                            <>
                                <span className="flex-1 text-left truncate pr-8 select-none" title={item.title}>
                                    {item.title}
                                </span>

                                {/* 3-Dot Menu Trigger */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                    }}
                                    className={`absolute right-2 p-1 rounded hover:bg-navy-900 transition-opacity ${activeMenuId === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                >
                                    <MoreHorizontal className="w-4 h-4 text-white/50 hover:text-white" />
                                </button>

                                {/* Dropdown Menu */}
                                {activeMenuId === item.id && (
                                    <div ref={menuRef} className="absolute right-0 top-full mt-1 w-32 bg-navy-800 border border-navy-700/50 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col py-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onPin(item.id); setActiveMenuId(null); }}
                                            className="px-3 py-2 text-left text-xs hover:bg-navy-700 flex items-center gap-2 text-white/80 hover:text-gold-400"
                                        >
                                            <Pin size={12} className={item.isPinned ? "fill-gold-400 text-gold-400" : ""} />
                                            {item.isPinned ? "Unpin" : "Pin"}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStartRename(item); }}
                                            className="px-3 py-2 text-left text-xs hover:bg-navy-700 flex items-center gap-2 text-white/80 hover:text-blue-400"
                                        >
                                            <Edit2 size={12} />
                                            Rename
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onShare(item.id); setActiveMenuId(null); }}
                                            className="px-3 py-2 text-left text-xs hover:bg-navy-700 flex items-center gap-2 text-white/80 hover:text-green-400"
                                        >
                                            <Share2 size={12} />
                                            Share
                                        </button>
                                        <div className="h-px bg-navy-700 mx-2 my-1"></div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); setActiveMenuId(null); }}
                                            className="px-3 py-2 text-left text-xs hover:bg-red-900/20 flex items-center gap-2 text-red-400 hover:text-red-300"
                                        >
                                            <Trash2 size={12} />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>



            {/* Drag Handle */}
            <div
                onMouseDown={onResizeStart}
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gold-500/50 transition-colors z-30"
            />
        </div>
    );
}
