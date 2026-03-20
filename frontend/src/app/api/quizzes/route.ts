import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NYAYA_BACKEND_URL || 'http://localhost:8000';
const API_KEY = process.env.NYAYA_API_KEY || '';

// Fallback mock quizzes (used if backend has no /quizzes endpoint yet)
const MOCK_QUIZZES = [
  {
    id: 'q1',
    title: 'Evolution of the Executive Presidency',
    description:
      'Traces how presidential powers expanded and were later restricted through major constitutional amendments.',
    difficulty: 'Medium',
    durationMinutes: 12,
    questions: [
      {
        id: 'q1_1',
        text: 'The Executive Presidency in Sri Lanka was introduced under which Constitution?',
        options: [
          { id: 'o1', text: 'Soulbury Constitution (1947)', isCorrect: false },
          { id: 'o2', text: 'First Republican Constitution (1972)', isCorrect: false },
          { id: 'o3', text: 'Second Republican Constitution (1978)', isCorrect: true },
          { id: 'o4', text: '19th Amendment (2015)', isCorrect: false },
        ],
        explanation:
          'The 1978 Constitution introduced the Executive Presidency, concentrating significant power in the hands of the President.',
      },
      {
        id: 'q1_2',
        text: 'Which amendment significantly reduced the powers of the Executive Presidency?',
        options: [
          { id: 'o1', text: '13th Amendment', isCorrect: false },
          { id: 'o2', text: '18th Amendment', isCorrect: false },
          { id: 'o3', text: '19th Amendment', isCorrect: true },
          { id: 'o4', text: '20th Amendment', isCorrect: false },
        ],
        explanation:
          'The 19th Amendment (2015) curtailed presidential powers by restoring the two-term limit and establishing independent commissions.',
      },
    ],
  },
  {
    id: 'q2',
    title: 'Fundamental Rights in Sri Lanka',
    description:
      'Test your knowledge on the fundamental rights guaranteed by the Constitution of Sri Lanka.',
    difficulty: 'Easy',
    durationMinutes: 10,
    questions: [
      {
        id: 'q2_1',
        text: 'Under which chapter of the 1978 Constitution are Fundamental Rights enshrined?',
        options: [
          { id: 'o1', text: 'Chapter I', isCorrect: false },
          { id: 'o2', text: 'Chapter III', isCorrect: true },
          { id: 'o3', text: 'Chapter VI', isCorrect: false },
          { id: 'o4', text: 'Chapter X', isCorrect: false },
        ],
        explanation:
          'Chapter III of the 1978 Constitution specifically deals with Fundamental Rights.',
      },
    ],
  },
  {
    id: 'q3',
    title: 'Land Law & Property Rights',
    description:
      'Complex scenarios involving land ownership, prescription, and partitioning in Sri Lanka.',
    difficulty: 'Hard',
    durationMinutes: 20,
    questions: [
      {
        id: 'q3_1',
        text: 'In Sri Lanka, what is the statutory period for acquiring prescriptive title to private land?',
        options: [
          { id: 'o1', text: '5 years', isCorrect: false },
          { id: 'o2', text: '10 years', isCorrect: true },
          { id: 'o3', text: '15 years', isCorrect: false },
          { id: 'o4', text: '20 years', isCorrect: false },
        ],
        explanation:
          'Under the Prescription Ordinance, uninterrupted and adverse possession for 10 years is required to establish prescriptive title.',
      },
    ],
  },
];

export async function GET(req: NextRequest) {
  try {
    const headers: Record<string, string> = {};
    if (API_KEY) headers['X-API-Key'] = API_KEY;

    const backendRes = await fetch(`${BACKEND_URL}/quizzes`, { headers });

    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data);
    }

    // Backend doesn't have /quizzes yet — return mock data
    return NextResponse.json(MOCK_QUIZZES);
  } catch {
    // Backend unreachable — return mock data gracefully
    return NextResponse.json(MOCK_QUIZZES);
  }
}
