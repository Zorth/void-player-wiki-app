import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { runGuildSync, getLastSyncInfo } from '@/lib/sync';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest, session: any): boolean {
  // Allow internal container cron tasks
  const cronHeader = req.headers.get('x-internal-cron');
  if (cronHeader === 'true') return true;

  // Allow admin user sessions
  if (session && session.isAdmin) return true;

  return false;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!isAuthorized(req, session)) {
    return NextResponse.json({ error: 'Unauthorized: Admin required' }, { status: 403 });
  }

  const lastSync = getLastSyncInfo();
  return NextResponse.json({ lastSync });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!isAuthorized(req, session)) {
    return NextResponse.json({ error: 'Unauthorized: Admin required' }, { status: 403 });
  }

  const result = await runGuildSync();
  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Sync failed' }, { status: 500 });
  }

  return NextResponse.json({ result });
}
