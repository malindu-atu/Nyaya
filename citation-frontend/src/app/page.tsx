'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import ChatWindow, { Message } from '@/components/ChatWindow';
import { SearchMode } from '@/components/ModeToggle';
import { askNyaya, ChatTurn, AskResponse } from '@/lib/api';

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  isPinned: boolean;
}

// Stable user ID — persisted in localStorage so history is tracked per browser.
function getUserId(): string {
  if (typeof window === 'undefined') return 'anon';
  let uid = localStorage.getItem('nyaya-user-id');
  if (!uid) {
    uid = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('nyaya-user-id', uid);
  }
  return uid;
}

/** Convert app messages to the backend history format (last 6 turns). */
function buildHistory(messages: Message[]): ChatTurn[] {
  return messages.slice(-6).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));
}

/** Format source citations into a readable footnote string. */
function formatSources(response: AskResponse): string {
  if (!response.source_map?.length) return '';
  const sources = response.source_map
    .slice(0, 3)
    .map((s, i) => {
      const name = s.pdf_name ?? 'Unknown source';
      const page = s.page != null ? `, p.${s.page}` : '';
      return `[${i + 1}] ${name}${page}`;
    })
    .join('\n');
  return `\n\n---\n**Sources:**\n${sources}`;
}

export default function Home() {
  const [sessions, setSessions] = React.useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = React.useState<string | null>(null);
  const [isTyping, setIsTyping] = React.useState(false);

  // Load sessions from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('nyaya-chat-sessions');
    if (saved) {
      try {
        setSessions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse sessions', e);
      }
    }
  }, []);

  // Persist sessions to localStorage on every change
  React.useEffect(() => {
    localStorage.setItem('nyaya-chat-sessions', JSON.stringify(sessions));
  }, [sessions]);

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [sidebarWidth, setSidebarWidth] = React.useState(288);
  const isResizing = React.useRef(false);

  const startResizing = React.useCallback(() => {
    isResizing.current = true;
  }, []);

  const stopResizing = React.useCallback(() => {
    isResizing.current = false;
  }, []);

  const resize = React.useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing.current) {
      setSidebarWidth(() => {
        const newWidth = mouseMoveEvent.clientX;
        if (newWidth < 200) return 200;
        if (newWidth > 480) return 480;
        return newWidth;
      });
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const handleNewChat = () => setActiveChatId(null);

  const handleSendMessage = async (content: string, mode: SearchMode) => {
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    let currentChatId = activeChatId;
    let historyMessages: Message[] = [];

    if (!currentChatId) {
      currentChatId = Date.now().toString();
      const title =
        content.split(' ').slice(0, 5).join(' ') +
        (content.split(' ').length > 5 ? '...' : '');

      const newSession: ChatSession = {
        id: currentChatId,
        title,
        messages: [newUserMsg],
        createdAt: Date.now(),
        isPinned: false,
      };

      setSessions((prev) => [newSession, ...prev]);
      setActiveChatId(currentChatId);
      historyMessages = [];
    } else {
      const existing = sessions.find((s) => s.id === currentChatId);
      historyMessages = existing ? existing.messages : [];
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentChatId ? { ...s, messages: [...s.messages, newUserMsg] } : s
        )
      );
    }

    setIsTyping(true);

    try {
      const history = buildHistory(historyMessages);
      const userId = getUserId();

      // Prefix with [graph-search] so the backend can route accordingly when graph mode is selected
      const questionWithMode = mode === 'graph' ? `[graph-search] ${content}` : content;

      const response = await askNyaya(questionWithMode, history, userId);
      const answerText = response.answer + formatSources(response);

      const systemMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: answerText,
        timestamp: new Date(),
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentChatId ? { ...s, messages: [...s.messages, systemMsg] } : s
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `⚠️ ${message}\n\nPlease ensure the Nyaya backend is running at the configured URL.`,
        timestamp: new Date(),
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentChatId ? { ...s, messages: [...s.messages, errorMsg] } : s
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const togglePin = (id: string) => {
    setSessions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isPinned: !item.isPinned } : item))
    );
  };

  const deleteItem = (id: string) => {
    setSessions((prev) => prev.filter((item) => item.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const renameItem = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const shareItem = (id: string) => {
    console.log('Sharing item:', id);
    alert('Share link copied to clipboard!');
  };

  const sortedHistory = [...sessions].sort((a, b) => {
    if (a.isPinned === b.isPinned) return b.createdAt - a.createdAt;
    return a.isPinned ? -1 : 1;
  });

  const activeSession = sessions.find((s) => s.id === activeChatId);

  return (
    <main className="flex h-screen overflow-hidden bg-grey-50">
      <Sidebar
        onNewChat={handleNewChat}
        history={sortedHistory}
        onPin={togglePin}
        onDelete={deleteItem}
        onRename={renameItem}
        onShare={shareItem}
        activeChatId={activeChatId}
        onSelectChat={(id) => setActiveChatId(id)}
        isOpen={isSidebarOpen}
        width={sidebarWidth}
        onToggle={toggleSidebar}
        onResizeStart={startResizing}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col h-full relative">
        {!isSidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="absolute top-4 left-4 z-50 p-2 bg-navy-900 text-white rounded-lg shadow-lg hover:bg-navy-800 transition-colors"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <ChatWindow
          messages={activeSession ? activeSession.messages : []}
          isTyping={isTyping}
          onSendMessage={handleSendMessage}
        />
      </div>
    </main>
  );
}
