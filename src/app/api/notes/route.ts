import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveNote } from '@/lib/vault';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.canEdit) {
    return NextResponse.json({ error: 'Unauthorized: Edit permission required' }, { status: 403 });
  }

  const body = await req.json();
  const { category, title, content, worlds, tags, authors, existingFilePath, date, image, guildCharacterId } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  // Ensure author array automatically includes current user
  const currentUser = session.name || session.nickname || session.email || 'Unknown Author';
  const authorList = Array.isArray(authors) ? [...authors] : [];
  if (!authorList.includes(currentUser)) {
    authorList.push(currentUser);
  }

  try {
    const result = saveNote(
      category || 'world-note',
      title.trim(),
      content || '',
      Array.isArray(worlds) ? worlds : [],
      Array.isArray(tags) ? tags : [],
      authorList,
      existingFilePath,
      date,
      image,
      guildCharacterId
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Save note error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
