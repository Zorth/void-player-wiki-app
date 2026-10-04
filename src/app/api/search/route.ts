import { NextRequest, NextResponse } from 'next/server';
import { getAllNotes, KNOWN_WORLDS, slugify } from '@/lib/vault';

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  const rawQuery = req.nextUrl.searchParams.get('q')?.trim() || '';
  const allNotes = getAllNotes();

  // 1. Build candidates list ensuring all KNOWN_WORLDS are included and point to /worlds/[slug]
  const worldSlugs = new Set<string>();
  const candidates: Array<{
    slug: string;
    title: string;
    category: string;
    worlds: string[];
    tags: string[];
    abstract?: string;
    url: string;
    isWorld?: boolean;
  }> = [];

  for (const n of allNotes) {
    const isKnownWorld = KNOWN_WORLDS.find(
      w => w.toLowerCase() === n.title.toLowerCase().trim() ||
           slugify(w) === n.slug ||
           slugify(w) === slugify(n.title)
    );

    if (isKnownWorld) {
      const worldSlug = slugify(isKnownWorld);
      worldSlugs.add(worldSlug);
      candidates.push({
        slug: n.slug,
        title: n.title,
        category: 'world-note',
        worlds: n.worlds.length > 0 ? n.worlds : [isKnownWorld],
        tags: n.tags,
        abstract: n.abstract || `Campaign world overview, lore, interactive map, and records for ${isKnownWorld}.`,
        url: `/worlds/${worldSlug}`,
        isWorld: true,
      });
    } else {
      candidates.push({
        slug: n.slug,
        title: n.title,
        category: n.category,
        worlds: n.worlds,
        tags: n.tags,
        abstract: n.abstract,
        url: `/notes/${n.slug}`,
      });
    }
  }

  // Add any KNOWN_WORLDS that don't have a matching note in the vault
  for (const kw of KNOWN_WORLDS) {
    const worldSlug = slugify(kw);
    if (!worldSlugs.has(worldSlug)) {
      candidates.push({
        slug: worldSlug,
        title: kw,
        category: 'world-note',
        worlds: [kw],
        tags: ['world', 'campaign-world'],
        abstract: `Campaign world overview, lore, interactive map, and records for ${kw}.`,
        url: `/worlds/${worldSlug}`,
        isWorld: true,
      });
    }
  }

  if (!rawQuery) {
    return NextResponse.json({
      results: candidates.slice(0, 15).map(n => ({
        slug: n.slug,
        title: n.title,
        category: n.category,
        worlds: n.worlds,
        tags: n.tags,
        abstract: n.abstract,
        url: n.url,
        isWorld: n.isWorld,
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

  const cleanQuery = queryText.toLowerCase().trim();

  // Filter and score candidates
  const scored: Array<{
    item: typeof candidates[0];
    score: number;
  }> = [];

  for (const n of candidates) {
    // 1. Tag filters: Note must match all specified #tag filters
    if (tagFilters.length > 0) {
      const noteTags = n.tags.map(t => t.toLowerCase());
      const matchesAllTags = tagFilters.every(filterTag =>
        noteTags.some(t => t === filterTag || t.startsWith(filterTag + '/') || t.includes(filterTag))
      );
      if (!matchesAllTags) continue;
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
      if (!matchesAllWorlds) continue;
    }

    // 3. Free text search terms: Note must match all remaining terms in title, worlds, tags, or abstract
    const titleLower = n.title.toLowerCase();
    const slugLower = n.slug.toLowerCase();
    const cleanSlug = slugify(n.title);
    const abstractLower = (n.abstract || '').toLowerCase();
    const worldsLower = n.worlds.map(w => w.toLowerCase());
    const tagsLower = n.tags.map(t => t.toLowerCase());

    if (textTerms.length > 0) {
      const matchesAllTerms = textTerms.every(term => {
        return (
          titleLower.includes(term) ||
          abstractLower.includes(term) ||
          worldsLower.some(w => w.includes(term)) ||
          tagsLower.some(t => t.includes(term))
        );
      });

      if (!matchesAllTerms) continue;
    }

    // Calculate relevance score
    let score = 0;

    // A. Title and query matching
    if (cleanQuery) {
      if (titleLower === cleanQuery || slugLower === cleanQuery || cleanSlug === cleanQuery) {
        score += 10000;
      } else if (titleLower.startsWith(cleanQuery)) {
        score += 5000;
      } else if (new RegExp(`(?:^|\\s)${escapeRegExp(cleanQuery)}(?:$|\\s|[.,;:!?-])`, 'i').test(titleLower)) {
        score += 3000;
      } else if (titleLower.includes(cleanQuery)) {
        score += 2000;
      }
    }

    // B. Campaign World bonus
    if (n.isWorld) {
      if (cleanQuery && (titleLower === cleanQuery || slugify(titleLower) === slugify(cleanQuery))) {
        score += 8000;
      } else if (cleanQuery && titleLower.startsWith(cleanQuery)) {
        score += 4000;
      } else if (cleanQuery && titleLower.includes(cleanQuery)) {
        score += 2000;
      } else {
        score += 300;
      }
    }

    // C. Individual term matches
    let termsInTitle = 0;
    for (const term of textTerms) {
      if (titleLower === term) {
        score += 1500;
        termsInTitle++;
      } else if (new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:$|\\s|[.,;:!?-])`, 'i').test(titleLower)) {
        score += 800;
        termsInTitle++;
      } else if (titleLower.includes(term)) {
        score += 400;
        termsInTitle++;
      }

      if (tagsLower.includes(term)) {
        score += 400;
      } else if (tagsLower.some(t => t.includes(term))) {
        score += 150;
      }

      if (new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:$|\\s|[.,;:!?-])`, 'i').test(abstractLower)) {
        score += 150;
      } else if (abstractLower.includes(term)) {
        score += 60;
      }

      // If matching via world metadata
      if (worldsLower.some(w => w.includes(term))) {
        score += 15;
      }
    }

    // All terms matched in title
    if (textTerms.length > 1 && termsInTitle === textTerms.length) {
      score += 1000;
    }

    // Category weighting
    if (n.category === 'world-note') {
      score += 200;
    } else if (n.category === 'character') {
      score += 50;
    } else if (n.category === 'session-report') {
      score -= 30;
    }

    scored.push({ item: n, score });
  }

  // Sort by score descending; break ties by title length (shorter first) and alphabetical
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.item.title.length !== b.item.title.length) return a.item.title.length - b.item.title.length;
    return a.item.title.localeCompare(b.item.title);
  });

  return NextResponse.json({
    results: scored.slice(0, 25).map(s => ({
      slug: s.item.slug,
      title: s.item.title,
      category: s.item.category,
      worlds: s.item.worlds,
      tags: s.item.tags,
      abstract: s.item.abstract,
      url: s.item.url,
      isWorld: s.item.isWorld,
    })),
  });
}
