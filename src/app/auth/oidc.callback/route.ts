import { NextRequest, NextResponse } from 'next/server';
import { handleOidcCallback, createSessionCookie, APP_URL } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=missing_code', APP_URL));
  }

  try {
    const { session, returnTo } = await handleOidcCallback(code, state || undefined);
    await createSessionCookie(session);
    return NextResponse.redirect(new URL(returnTo, APP_URL));
  } catch (err: any) {
    console.error('OIDC callback error:', err);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(err.message)}`, APP_URL));
  }
}
