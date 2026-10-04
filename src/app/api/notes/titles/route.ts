import { NextResponse } from 'next/server';
import { getAllNotes } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allNotes = getAllNotes();
    // Return only lightweight metadata needed for instant client-side autocomplete & fuzzy matching
    const titles = allNotes.map(n => ({
      title: n.title,
      slug: n.slug,
      category: n.category,
      worlds: n.worlds,
      tags: n.tags,
      abstract: n.abstract ? n.abstract.slice(0, 100) : undefined,
    }));

    return NextResponse.json({ notes: titles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
