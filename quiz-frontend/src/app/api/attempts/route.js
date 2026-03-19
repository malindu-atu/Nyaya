import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NYAYA_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;
    if (action === 'start') {
      const res = await fetch(`${BACKEND_URL}/attempts/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: payload.user_id, quiz_id: payload.quiz_id }),
      });
      return NextResponse.json(await res.json());
    }
    if (action === 'complete') {
      const res = await fetch(`${BACKEND_URL}/attempts/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt_id: payload.attempt_id, score: payload.score }),
      });
      return NextResponse.json(await res.json());
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[/api/attempts POST]', err.message);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    const res = await fetch(`${BACKEND_URL}/attempts/${userId}`, { cache: 'no-store' });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error('[/api/attempts GET]', err.message);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
