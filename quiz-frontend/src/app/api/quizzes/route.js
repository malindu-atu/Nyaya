import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NYAYA_BACKEND_URL || 'http://127.0.0.1:8000';

function transform(backendQuiz) {
  const questions = (backendQuiz.questions || []).map((q) => {
    const options = (q.options || []).map((optText, idx) => ({
      id: `${q.id}_o${idx}`,
      text: optText,
      isCorrect: optText === q.correct_option,
    }));
    return {
      id: String(q.id),
      text: q.question_text || q.question || '',
      explanation: q.explanation || '',
      options,
    };
  });
  const count = questions.length;
  const difficulty = backendQuiz.difficulty || (count <= 5 ? 'Easy' : count <= 10 ? 'Medium' : 'Hard');
  return {
    id: String(backendQuiz.id),
    title: backendQuiz.title || 'Untitled Quiz',
    description: backendQuiz.description || '',
    difficulty,
    durationMinutes: backendQuiz.durationMinutes || Math.max(count * 2, 5),
    questions,
  };
}

export async function GET() {
  try {
    console.log(`[/api/quizzes] Fetching from: ${BACKEND_URL}/quizzes`);
    const res = await fetch(`${BACKEND_URL}/quizzes`, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[/api/quizzes] Backend returned ${res.status}:`, text);
      return NextResponse.json({ error: `Backend error: ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    console.log(`[/api/quizzes] Success — ${data.length} quizzes`);
    return NextResponse.json(data.map(transform));
  } catch (err) {
    console.error('[/api/quizzes] Fetch failed:', err.message);
    return NextResponse.json({ error: `Backend unreachable at ${BACKEND_URL}` }, { status: 502 });
  }
}
