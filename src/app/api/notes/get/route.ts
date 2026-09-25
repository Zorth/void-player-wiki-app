import { NextRequest, NextResponse } from 'next/server';
import { getNoteBySlug } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const note = getNoteBySlug(slug);
  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  return NextResponse.json({ note });
}
