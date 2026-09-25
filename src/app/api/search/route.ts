import { NextRequest, NextResponse } from 'next/server';
import { getAllNotes } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const rawQuery = req.nextUrl.searchParams.get('q')?.trim() || '';
  const allNotes = getAllNotes();

  if (!rawQuery) {
    return NextResponse.json({
      results: allNotes.slice(0, 15).map(n => ({
        slug: n.slug,
        title: n.title,
        category: n.category,
        worlds: n.worlds,
        tags: n.tags,
        abstract: n.abstract,
      })),
    });
  }

  // Parse out #tag and @world filters (support quoted tokens like @"the void" or @"world name")
  const tagFilters: string[] = [];
  const worldFilters: string[] = [];

  let queryText = rawQuery;

  // 1. Quoted tag filters: #"some tag" or #'some tag'
  queryText = queryText.replace(/#["']([^"']+)["']/g, (_, tag) => {
    tagFilters.push(tag.toLowerCase().trim().replace(/^#/, ''));
    return '';
  });

  // 2. Unquoted tag filters: #tag
  queryText = queryText.replace(/#([a-zA-Z0-9_\/-]+)/g, (_, tag) => {
    tagFilters.push(tag.toLowerCase().trim());
    return '';
  });

  // 3. Quoted world filters: @"the void" or @'the void'
  queryText = queryText.replace(/@["']([^"']+)["']/g, (_, world) => {
    worldFilters.push(world.toLowerCase().trim().replace(/^@/, ''));
    return '';
  });

  // 4. Unquoted world filters: @world (support hyphens/underscores/letters)
  queryText = queryText.replace(/@([a-zA-Z0-9_\/-]+)/g, (_, world) => {
    worldFilters.push(world.toLowerCase().trim());
    return '';
  });

  const textTerms = queryText
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const filtered = allNotes.filter(n => {
    // 1. Tag filters: Note must match all specified #tag filters
    if (tagFilters.length > 0) {
      const noteTags = n.tags.map(t => t.toLowerCase());
      const matchesAllTags = tagFilters.every(filterTag =>
        noteTags.some(t => t === filterTag || t.startsWith(filterTag + '/') || t.includes(filterTag))
      );
      if (!matchesAllTags) return false;
    }

    // 2. World filters: Note must match all specified @world filters
    if (worldFilters.length > 0) {
      const noteWorlds = n.worlds.map(w => w.toLowerCase());
      const matchesAllWorlds = worldFilters.every(filterWorld => {
        const cleanFilter = filterWorld.replace(/[-_]/g, ' ');
        return noteWorlds.some(w => {
          const cleanWorld = w.toLowerCase().replace(/[-_]/g, ' ');
          return cleanWorld === cleanFilter || cleanWorld.includes(cleanFilter) || cleanFilter.includes(cleanWorld);
        });
      });
      if (!matchesAllWorlds) return false;
    }

    // 3. Free text search terms: Note must match all remaining terms in title, worlds, tags, or abstract
    if (textTerms.length > 0) {
      const titleLower = n.title.toLowerCase();
      const abstractLower = (n.abstract || '').toLowerCase();
      const worldsLower = n.worlds.map(w => w.toLowerCase());
      const tagsLower = n.tags.map(t => t.toLowerCase());

      const matchesAllTerms = textTerms.every(term => {
        return (
          titleLower.includes(term) ||
          abstractLower.includes(term) ||
          worldsLower.some(w => w.includes(term)) ||
          tagsLower.some(t => t.includes(term))
        );
      });

      if (!matchesAllTerms) return false;
    }

    return true;
  });

  return NextResponse.json({
    results: filtered.slice(0, 20).map(n => ({
      slug: n.slug,
      title: n.title,
      category: n.category,
      worlds: n.worlds,
      tags: n.tags,
      abstract: n.abstract,
    })),
  });
}
