import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { toggleCommentReaction } from '@/lib/db';

const ALLOWED_REACTIONS = ['upvote', 'heart', 'laugh'];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to react to comments' }, { status: 401 });
  }

  const body = await req.json();
  const { commentId, reaction } = body;

  if (!commentId || !reaction || !ALLOWED_REACTIONS.includes(reaction)) {
    return NextResponse.json({ error: 'Invalid comment ID or reaction' }, { status: 400 });
  }

  const result = toggleCommentReaction(Number(commentId), session.userId, reaction);
  return NextResponse.json({ success: true, ...result, reaction, commentId });
}
