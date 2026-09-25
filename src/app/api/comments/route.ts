import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCommentsForNote, addComment, deleteComment } from '@/lib/db';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }
  const comments = getCommentsForNote(slug);
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to comment' }, { status: 401 });
  }

  const body = await req.json();
  const { slug, content } = body;

  if (!slug || !content || !content.trim()) {
    return NextResponse.json({ error: 'Content and slug are required' }, { status: 400 });
  }

  const comment = addComment(
    slug,
    session.userId,
    session.name,
    session.picture || null,
    session.nickname || null,
    content.trim()
  );

  return NextResponse.json({ success: true, comment });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing comment ID' }, { status: 400 });
  }

  const deleted = deleteComment(Number(id), session.userId, session.isAdmin);
  if (!deleted) {
    return NextResponse.json({ error: 'Forbidden or not found' }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
