import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/auth/backend';
import { clearAuthCookies, readRefreshToken } from '@/lib/auth/session';

export async function POST(): Promise<NextResponse> {
  const refresh = await readRefreshToken();
  if (refresh) {
    await backendFetch('/v1/auth/logout', {
      method: 'POST',
      json: { refresh_token: refresh },
    });
  }
  await clearAuthCookies();
  return NextResponse.json({ success: true, data: { message: 'Đăng xuất thành công' } });
}
