import { getAllNotes, getVaultTimestamp, KNOWN_WORLDS, NoteMetadata, slugify } from './vault';

export interface SearchDocument {
  slug: string;
  title: string;
  titleLower: string;
  category: NoteMetadata['category'];
  worlds: string[];
  worldsLower: string[];
  tags: string[];
  tagsLower: string[];
  aliases: string[];
  aliasesLower: string[];
  abstract?: string;
  abstractLower: string;
  cleanContent: string;
  cleanContentLower: string;
  headings: Array<{ level: number; text: string; textLower: string }>;
  url: string;
  isWorld: boolean;
}

export interface SearchResult {
  slug: string;
  title: string;
  category: string;
  worlds: string[];
  tags: string[];
  abstract?: string;
  url: string;
  isWorld?: boolean;
  matchType: 'title' | 'tag' | 'world' | 'content';
  matchedHeading?: string;
  snippet?: string;
  score: number;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function cleanMarkdownContent(md: string): string {
  if (!md) return '';
  return md
    // Strip code blocks and inline code
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ')
    // Strip image embeds and markdown images
    .replace(/!\[\[.*?\]\]/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    // Convert wikilinks: [[target|alias]] -> alias target
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => (alias ? `${alias} ${target}` : target))
    // Convert standard markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    // Strip block callout indicators
    .replace(/^[ \t]*>[ \t]*\[![^\]]*\][^\n]*/gm, ' ')
    .replace(/^[ \t]*>[ \t]?/gm, ' ')
    // Strip markdown headings markers
    .replace(/^[ \t]*#{1,6}\s+/gm, ' ')
    // Strip table divider lines
    .replace(/\|[-:\s|]+\|/g, ' ')
    .replace(/\|/g, ' ')
    // Strip bold, italics, strikethrough
    .replace(/[*_~]{1,3}/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadings(raw: string): Array<{ level: number; text: string; textLower: string }> {
  const headings: Array<{ level: number; text: string; textLower: string }> = [];
  if (!raw) return headings;

  const matches = raw.matchAll(/^(#{1,4})\s+(.+)$/gm);
  for (const m of matches) {
    const level = m[1].length;
    // Strip wikilink brackets from headings
    const text = m[2].replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$2').replace(/\[\[|\]\]/g, '').trim();
    if (text) {
      headings.push({
        level,
        text,
        textLower: text.toLowerCase(),
      });
    }
  }
  return headings;
}

let cachedCorpus: SearchDocument[] | null = null;
let cachedCorpusTimestamp = 0;

export function getSearchCorpus(): SearchDocument[] {
  const currentTimestamp = getVaultTimestamp();
  if (cachedCorpus && cachedCorpusTimestamp === currentTimestamp) {
    return cachedCorpus;
  }

  const allNotes = getAllNotes();
  const worldSlugs = new Set<string>();
  const corpus: SearchDocument[] = [];

  for (const n of allNotes) {
    const isKnownWorld = KNOWN_WORLDS.find(
      w => w.toLowerCase() === n.title.toLowerCase().trim() ||
           slugify(w) === n.slug ||
           slugify(w) === slugify(n.title)
    );

    const cleanAliases = (n.aliases || [])
      .filter(a => typeof a === 'string' && a.trim())
      .map(a => a.trim());

    const cleanContent = cleanMarkdownContent(n.rawContent);
    const headings = extractHeadings(n.rawContent);

    if (isKnownWorld) {
      const worldSlug = slugify(isKnownWorld);
      worldSlugs.add(worldSlug);
      corpus.push({
        slug: n.slug,
        title: n.title,
        titleLower: n.title.toLowerCase().trim(),
        category: 'world-note',
        worlds: n.worlds.length > 0 ? n.worlds : [isKnownWorld],
        worldsLower: (n.worlds.length > 0 ? n.worlds : [isKnownWorld]).map(w => w.toLowerCase()),
        tags: n.tags,
        tagsLower: n.tags.map(t => t.toLowerCase()),
        aliases: cleanAliases,
        aliasesLower: cleanAliases.map(a => a.toLowerCase()),
        abstract: n.abstract || `Campaign world overview, lore, interactive map, and records for ${isKnownWorld}.`,
        abstractLower: (n.abstract || `Campaign world overview, lore, interactive map, and records for ${isKnownWorld}.`).toLowerCase(),
        cleanContent,
        cleanContentLower: cleanContent.toLowerCase(),
        headings,
        url: `/worlds/${worldSlug}`,
        isWorld: true,
      });
    } else {
      corpus.push({
        slug: n.slug,
        title: n.title,
        titleLower: n.title.toLowerCase().trim(),
        category: n.category,
        worlds: n.worlds,
        worldsLower: n.worlds.map(w => w.toLowerCase()),
        tags: n.tags,
        tagsLower: n.tags.map(t => t.toLowerCase()),
        aliases: cleanAliases,
        aliasesLower: cleanAliases.map(a => a.toLowerCase()),
        abstract: n.abstract,
        abstractLower: (n.abstract || '').toLowerCase(),
        cleanContent,
        cleanContentLower: cleanContent.toLowerCase(),
        headings,
        url: `/notes/${n.slug}`,
        isWorld: false,
      });
    }
  }

  // Ensure all known worlds are represented even if no dedicated markdown note exists
  for (const kw of KNOWN_WORLDS) {
    const worldSlug = slugify(kw);
    if (!worldSlugs.has(worldSlug)) {
      corpus.push({
        slug: worldSlug,
        title: kw,
        titleLower: kw.toLowerCase(),
        category: 'world-note',
        worlds: [kw],
        worldsLower: [kw.toLowerCase()],
        tags: ['world', 'campaign-world'],
        tagsLower: ['world', 'campaign-world'],
        aliases: [],
        aliasesLower: [],
        abstract: `Campaign world overview, lore, interactive map, and records for ${kw}.`,
        abstractLower: `campaign world overview, lore, interactive map, and records for ${kw.toLowerCase()}.`,
        cleanContent: `Campaign world overview, lore, interactive map, and records for ${kw}.`,
        cleanContentLower: `campaign world overview, lore, interactive map, and records for ${kw.toLowerCase()}.`,
        headings: [],
        url: `/worlds/${worldSlug}`,
        isWorld: true,
      });
    }
  }

  cachedCorpus = corpus;
  cachedCorpusTimestamp = currentTimestamp;
  return cachedCorpus;
}

export function highlightTerms(snippet: string, terms: string[]): string {
  if (!terms.length) return escapeHtml(snippet);
  const validTerms = Array.from(new Set(terms.filter(t => t && t.trim().length > 1)))
    .sort((a, b) => b.length - a.length);
  if (!validTerms.length) return escapeHtml(snippet);

  const safeSnippet = escapeHtml(snippet);
  const pattern = validTerms.map(t => escapeRegExp(escapeHtml(t))).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  return safeSnippet.replace(regex, '<mark class="bg-purple-900/60 text-purple-200 px-0.5 rounded font-medium">$1</mark>');
}

export function extractSnippet(text: string, terms: string[], fullPhrase: string, maxLength: number = 140): string {
  if (!text) return '';
  const lowerText = text.toLowerCase();

  // Try finding the full phrase first
  let matchIdx = fullPhrase ? lowerText.indexOf(fullPhrase) : -1;
  let matchLen = fullPhrase ? fullPhrase.length : 0;

  // Otherwise find the earliest matching term
  if (matchIdx === -1) {
    for (const term of terms) {
      const idx = lowerText.indexOf(term);
      if (idx !== -1 && (matchIdx === -1 || idx < matchIdx)) {
        matchIdx = idx;
        matchLen = term.length;
      }
    }
  }

  if (matchIdx === -1) {
    return text.length > maxLength ? escapeHtml(text.slice(0, maxLength).trim()) + '...' : escapeHtml(text);
  }

  const half = Math.floor(maxLength / 2);
  let start = Math.max(0, matchIdx - half);
  let end = Math.min(text.length, matchIdx + matchLen + half);

  // Snap to word boundaries
  if (start > 0) {
    const spaceIdx = text.indexOf(' ', start);
    if (spaceIdx !== -1 && spaceIdx < matchIdx) {
      start = spaceIdx + 1;
    }
  }
  if (end < text.length) {
    const spaceIdx = text.lastIndexOf(' ', end);
    if (spaceIdx !== -1 && spaceIdx > matchIdx + matchLen) {
      end = spaceIdx;
    }
  }

  let rawSnippet = text.slice(start, end).trim();
  if (start > 0) rawSnippet = '...' + rawSnippet;
  if (end < text.length) rawSnippet = rawSnippet + '...';

  return highlightTerms(rawSnippet, terms.concat(fullPhrase ? [fullPhrase] : []));
}

function checkProximity(text: string, terms: string[], windowSize: number = 120): boolean {
  if (terms.length < 2) return false;
  let firstIdx = -1;
  let lastIdx = -1;

  for (const t of terms) {
    const idx = text.indexOf(t);
    if (idx === -1) return false;
    if (firstIdx === -1 || idx < firstIdx) firstIdx = idx;
    if (lastIdx === -1 || idx > lastIdx) lastIdx = idx;
  }

  return lastIdx - firstIdx <= windowSize;
}

export function searchVault(rawQuery: string): SearchResult[] {
  const corpus = getSearchCorpus();
  const trimmed = rawQuery.trim();

  // Default empty state: return top campaign worlds and major overview notes
  if (!trimmed) {
    return corpus.slice(0, 15).map(doc => ({
      slug: doc.slug,
      title: doc.title,
      category: doc.category,
      worlds: doc.worlds,
      tags: doc.tags,
      abstract: doc.abstract,
      url: doc.url,
      isWorld: doc.isWorld,
      matchType: 'title',
      score: doc.isWorld ? 1000 : 100,
    }));
  }

  // Parse out #tag and @world filters
  const tagFilters: string[] = [];
  const worldFilters: string[] = [];
  let queryText = trimmed;

  // 1. Quoted tag filters: #"some tag"
  queryText = queryText.replace(/#["']([^"']+)["']/g, (_, tag) => {
    tagFilters.push(tag.toLowerCase().trim().replace(/^#/, ''));
    return '';
  });

  // 2. Unquoted tag filters: #tag
  queryText = queryText.replace(/#([a-zA-Z0-9_\/-]+)/g, (_, tag) => {
    tagFilters.push(tag.toLowerCase().trim());
    return '';
  });

  // 3. Quoted world filters: @"the void"
  queryText = queryText.replace(/@["']([^"']+)["']/g, (_, world) => {
    worldFilters.push(world.toLowerCase().trim().replace(/^@/, ''));
    return '';
  });

  // 4. Unquoted world filters: @world
  queryText = queryText.replace(/@([a-zA-Z0-9_\/-]+)/g, (_, world) => {
    worldFilters.push(world.toLowerCase().trim());
    return '';
  });

  const cleanQuery = queryText.toLowerCase().trim();
  const textTerms = cleanQuery.split(/\s+/).filter(Boolean);

  const results: SearchResult[] = [];

  for (const doc of corpus) {
    // 1. Tag filters: Document must match all specified #tag filters
    if (tagFilters.length > 0) {
      const matchesAllTags = tagFilters.every(filterTag =>
        doc.tagsLower.some(t => t === filterTag || t.startsWith(filterTag + '/') || t.includes(filterTag))
      );
      if (!matchesAllTags) continue;
    }

    // 2. World filters: Document must match all specified @world filters
    if (worldFilters.length > 0) {
      const matchesAllWorlds = worldFilters.every(filterWorld => {
        const cleanFilter = filterWorld.replace(/[-_]/g, ' ');
        return doc.worldsLower.some(w => {
          const cleanWorld = w.replace(/[-_]/g, ' ');
          return cleanWorld === cleanFilter || cleanWorld.includes(cleanFilter) || cleanFilter.includes(cleanWorld);
        });
      });
      if (!matchesAllWorlds) continue;
    }

    // 3. If query only had filters (no text search terms)
    if (textTerms.length === 0) {
      results.push({
        slug: doc.slug,
        title: doc.title,
        category: doc.category,
        worlds: doc.worlds,
        tags: doc.tags,
        abstract: doc.abstract,
        url: doc.url,
        isWorld: doc.isWorld,
        matchType: tagFilters.length > 0 ? 'tag' : 'world',
        score: (doc.isWorld ? 500 : 100),
      });
      continue;
    }

    // 4. Free text matching across Title, Aliases, Headings, Tags, Abstract, and Body Content
    let score = 0;
    let isTitleMatch = false;
    let isHeadingMatch = false;
    let isContentMatch = false;
    let bestMatchedHeading: string | undefined = undefined;

    // A. Whole phrase title / alias matches
    if (cleanQuery) {
      if (doc.titleLower === cleanQuery || doc.slug === cleanQuery) {
        score += 25000;
        isTitleMatch = true;
      } else if (doc.aliasesLower.includes(cleanQuery)) {
        score += 20000;
        isTitleMatch = true;
      } else if (doc.titleLower.startsWith(cleanQuery)) {
        score += 12000;
        isTitleMatch = true;
      } else if (new RegExp(`(?:^|\\s)${escapeRegExp(cleanQuery)}(?:$|\\s|[.,;:!?-])`).test(doc.titleLower)) {
        score += 8000;
        isTitleMatch = true;
      } else if (doc.titleLower.includes(cleanQuery)) {
        score += 5000;
        isTitleMatch = true;
      } else if (doc.aliasesLower.some(a => a.includes(cleanQuery))) {
        score += 4000;
        isTitleMatch = true;
      }
    }

    // B. Heading matches
    for (const h of doc.headings) {
      if (cleanQuery && h.textLower.includes(cleanQuery)) {
        score += 3500;
        isHeadingMatch = true;
        if (!bestMatchedHeading) bestMatchedHeading = h.text;
      }
    }

    // C. Term-by-term matching
    let termsInTitle = 0;
    let termsInContent = 0;
    let termsInTags = 0;
    let termsInHeadings = 0;

    for (const term of textTerms) {
      const termRegex = new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:$|\\s|[.,;:!?-])`);

      // Title & Aliases
      if (doc.titleLower === term) {
        score += 3000;
        termsInTitle++;
      } else if (termRegex.test(doc.titleLower)) {
        score += 1500;
        termsInTitle++;
      } else if (doc.titleLower.includes(term)) {
        score += 800;
        termsInTitle++;
      } else if (doc.aliasesLower.some(a => a.includes(term))) {
        score += 700;
        termsInTitle++;
      }

      // Headings
      const matchedH = doc.headings.find(h => h.textLower.includes(term));
      if (matchedH) {
        score += 600;
        termsInHeadings++;
        if (!bestMatchedHeading) bestMatchedHeading = matchedH.text;
      }

      // Tags
      if (doc.tagsLower.includes(term)) {
        score += 600;
        termsInTags++;
      } else if (doc.tagsLower.some(t => t.includes(term))) {
        score += 250;
        termsInTags++;
      }

      // Abstract
      if (doc.abstractLower.includes(term)) {
        score += 200;
      }

      // Content (body text)
      if (doc.cleanContentLower.includes(term)) {
        termsInContent++;
        const occurrences = (doc.cleanContentLower.match(new RegExp(escapeRegExp(term), 'g')) || []).length;
        score += Math.min(occurrences * 30, 250);
      }
    }

    if (termsInTitle > 0) isTitleMatch = true;
    if (termsInHeadings > 0) isHeadingMatch = true;
    if (termsInContent > 0) isContentMatch = true;

    // D. Multi-term bonuses
    if (textTerms.length > 1 && termsInTitle === textTerms.length) {
      score += 4000;
    }

    // Whole phrase in content
    if (cleanQuery && doc.cleanContentLower.includes(cleanQuery)) {
      score += 1200;
      isContentMatch = true;
    }

    // Proximity bonus in content
    if (textTerms.length > 1 && termsInContent >= 2) {
      if (checkProximity(doc.cleanContentLower, textTerms, 120)) {
        score += 500;
      }
    }

    // Early position bonus (first 300 chars of body)
    if (cleanQuery && doc.cleanContentLower.slice(0, 300).includes(cleanQuery)) {
      score += 250;
    }

    // Every search term must appear somewhere in the document (title, aliases, tags, abstract, headings, or content)
    const matchesAllTerms = textTerms.every(term => {
      return (
        doc.titleLower.includes(term) ||
        doc.aliasesLower.some(a => a.includes(term)) ||
        doc.tagsLower.some(t => t.includes(term)) ||
        doc.abstractLower.includes(term) ||
        doc.headings.some(h => h.textLower.includes(term)) ||
        doc.cleanContentLower.includes(term)
      );
    });

    if (!matchesAllTerms) continue;

    // E. Category & World weighting
    if (doc.isWorld) {
      score += 2500;
    }
    if (doc.category === 'world-note') {
      score += 200;
    } else if (doc.category === 'character') {
      score += 100;
    } else if (doc.category === 'session-report') {
      score -= 100;
    }

    // Determine primary match type
    let matchType: SearchResult['matchType'] = 'content';
    if (isTitleMatch) {
      matchType = 'title';
    } else if (tagFilters.length > 0 || termsInTags === textTerms.length) {
      matchType = 'tag';
    } else if (worldFilters.length > 0) {
      matchType = 'world';
    }

    // Context snippet for content matches or when abstract is missing
    let snippet: string | undefined = undefined;
    if (matchType === 'content' || !doc.abstract || isHeadingMatch) {
      snippet = extractSnippet(doc.cleanContent, textTerms, cleanQuery, 140);
    }

    results.push({
      slug: doc.slug,
      title: doc.title,
      category: doc.category,
      worlds: doc.worlds,
      tags: doc.tags,
      abstract: doc.abstract,
      url: doc.url,
      isWorld: doc.isWorld,
      matchType,
      matchedHeading: bestMatchedHeading,
      snippet,
      score,
    });
  }

  // Sort descending by score; tie-break by shorter title and alphabetical order
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.title.length !== b.title.length) return a.title.length - b.title.length;
    return a.title.localeCompare(b.title);
  });

  return results.slice(0, 25);
}
