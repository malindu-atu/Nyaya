import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NYAYA_BACKEND_URL || 'http://localhost:8000';
const API_KEY = process.env.NYAYA_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (API_KEY) {
      headers['X-API-Key'] = API_KEY;
    }

    // Forward user identity header if present
    const userId = req.headers.get('X-User-ID');
    if (userId) {
      headers['X-User-ID'] = userId;
    }

    const backendRes = await fetch(`${BACKEND_URL}/ask-chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: body.question,
        history: body.history ?? [],
      }),
    });

    if (!backendRes.ok) {
      const error = await backendRes.text();
      return NextResponse.json(
        { error: `Backend error: ${error}` },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/ask] Error:', err);
    return NextResponse.json(
      { error: 'Failed to reach Nyaya backend. Is it running?' },
      { status: 502 }
    );
  }
}
