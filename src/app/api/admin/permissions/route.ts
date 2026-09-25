import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllUserPermissions, setUserEditPermission } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin required' }, { status: 403 });
  }

  const users = getAllUserPermissions();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin required' }, { status: 403 });
  }

  const body = await req.json();
  const { userId, canEdit, noteName } = body;

  if (!userId || typeof canEdit !== 'boolean') {
    return NextResponse.json({ error: 'Missing userId or canEdit boolean' }, { status: 400 });
  }

  setUserEditPermission(userId.trim(), canEdit, noteName);
  return NextResponse.json({ success: true });
}
