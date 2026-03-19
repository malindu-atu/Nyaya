/**
 * Nyaya API client — all backend calls go through Next.js API routes
 * so that credentials and CORS are handled server-side.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskResponse {
  question: string;
  answer: string;
  status: string;
  source_map: SourceItem[];
  precedent_chain: PrecedentItem[];
  groundedness_score: number;
  reflection_report: Record<string, unknown>;
  latency_seconds: number;
}

export interface SourceItem {
  pdf_name?: string;
  page?: number | string;
  text?: string;
  score?: number;
  [key: string]: unknown;
}

export interface PrecedentItem {
  case_name?: string;
  citation?: string;
  relevance?: string;
  [key: string]: unknown;
}

/**
 * Send a chat message to the Nyaya backend via the Next.js proxy.
 * @param question   - The user's current message
 * @param history    - Previous turns in the conversation
 * @param userId     - Optional stable user ID for history tracking
 */
export async function askNyaya(
  question: string,
  history: ChatTurn[] = [],
  userId?: string
): Promise<AskResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (userId) {
    headers['X-User-ID'] = userId;
  }

  const res = await fetch('/api/ask', {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, history }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err?.error ?? `Request failed with status ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch the list of quizzes (tries backend, falls back to mock data).
 */
export async function fetchQuizzes() {
  const res = await fetch('/api/quizzes');
  if (!res.ok) throw new Error('Failed to fetch quizzes');
  return res.json();
}
