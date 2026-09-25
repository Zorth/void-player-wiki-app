import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, APP_URL } from '@/lib/auth';

export async function GET(req: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/', APP_URL));
}
