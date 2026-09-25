import { NextRequest, NextResponse } from 'next/server';
import { getLoginUrl } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get('returnTo') || '/';
  const url = getLoginUrl(returnTo);
  return NextResponse.redirect(url);
}
