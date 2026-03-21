import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NYAYA_BACKEND_URL || 'http://localhost:8000';
const API_KEY = process.env.NYAYA_API_KEY || '';

function transform(backendQuiz: any) {
  const questions = (backendQuiz.questions || []).map((q: any) => {
    const options = (q.options || []).map((optText: string, idx: number) => ({
      id: `${q.id}_o${idx}`,
      text: optText,
      isCorrect: optText === q.correct_option,
    }));
    return {
      id: String(q.id),
      text: q.question_text || '',
      explanation: q.explanation || '',
      options,
    };
  });

  const count = questions.length;
  const difficulty =
    backendQuiz.difficulty || (count <= 5 ? 'Easy' : count <= 10 ? 'Medium' : 'Hard');

  return {
    id: String(backendQuiz.id),
    title: backendQuiz.title || 'Untitled Quiz',
    description: backendQuiz.description || '',
    difficulty,
    durationMinutes: backendQuiz.durationMinutes || Math.max(count * 2, 5),
    questions,
  };
}

export async function GET(req: NextRequest) {
  try {
    const headers: Record<string, string> = {};
    if (API_KEY) headers['X-API-Key'] = API_KEY;

    const res = await fetch(`${BACKEND_URL}/quizzes`, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data.map(transform));
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Backend unreachable' },
      { status: 502 }
    );
  }
}