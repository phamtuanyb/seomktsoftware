import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/auth/backend';
import { setAuthCookies } from '@/lib/auth/session';

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json();
  const res = await backendFetch('/v1/auth/register', { method: 'POST', json: body });
  const data = await res.json();

  if (!res.ok || !data?.success) {
    return NextResponse.json(data, { status: res.status });
  }

  await setAuthCookies(data.data.tokens);
  return NextResponse.json({ success: true, data: { user: data.data.user } }, { status: 201 });
}
