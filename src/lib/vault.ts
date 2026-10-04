import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import katex from 'katex';
import { KNOWN_WORLDS } from './constants';

const VAULT_PATH = process.env.VAULT_PATH || '/mnt/whale/07_NOTES_WORKING/void_player_wiki';

export interface NoteMetadata {
  slug: string;
  title: string;
  category: 'world-note' | 'session-report' | 'character' | 'guide';
  worlds: string[];
  tags: string[];
  authors: string[];
  date?: string;
  abstract?: string;
  filePath: string;
  updatedAt: string;
  rawContent: string;
  guildCharacterId?: string;
  image?: string;
  hasReport?: boolean;
}

export { KNOWN_WORLDS };

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractWorlds(frontmatter: any, content: string, title?: string, category?: string): string[] {
  // Rules and guide articles must never be linked to campaign worlds
  if (category === 'guide') {
    return [];
  }

  const found = new Set<string>();

  // 1. Authoritative check: From frontmatter
  const hasFrontmatterWorld = frontmatter.world !== undefined;
  const hasFrontmatterWorlds = frontmatter.worlds !== undefined;

  if (hasFrontmatterWorld || hasFrontmatterWorlds) {
    if (typeof frontmatter.world === 'string' && frontmatter.world.trim()) {
      found.add(frontmatter.world.trim());
    } else if (Array.isArray(frontmatter.world)) {
      frontmatter.world.forEach((w: string) => {
        if (typeof w === 'string' && w.trim()) found.add(w.trim());
      });
    }

    if (Array.isArray(frontmatter.worlds)) {
      frontmatter.worlds.forEach((w: string) => {
        if (typeof w === 'string' && w.trim()) found.add(w.trim());
      });
    } else if (typeof frontmatter.worlds === 'string' && frontmatter.worlds.trim()) {
      found.add(frontmatter.worlds.trim());
    }

    return Array.from(found);
  }

  // 2. Canonical world note fallback: if the note's title is one of the KNOWN_WORLDS
  if (title) {
    const matchedKnownWorld = KNOWN_WORLDS.find(w => w.toLowerCase() === title.toLowerCase());
    if (matchedKnownWorld) {
      return [matchedKnownWorld];
    }
  }

  // 3. Fallback for legacy notes lacking any frontmatter world definition
  // Check explicit wikilinks or tags
  for (const w of KNOWN_WORLDS) {
    const linkRegex = new RegExp(`\\[\\[${w}\\]\\]`, 'i');
    const tagRegex = new RegExp(`#${w.toLowerCase().replace(/\\s+/g, '-')}\\b`, 'i');
    if (linkRegex.test(content) || tagRegex.test(content)) {
      found.add(w);
    }
  }

  return Array.from(found);
}

function extractTags(frontmatter: any, content: string): string[] {
  const tags = new Set<string>();

  if (Array.isArray(frontmatter.tags)) {
    frontmatter.tags.forEach((t: string) => {
      const clean = String(t).replace(/^#/, '').toLowerCase().trim();
      if (clean) tags.add(clean);
    });
  } else if (typeof frontmatter.tags === 'string') {
    frontmatter.tags.split(',').forEach((t: string) => {
      const clean = t.replace(/^#/, '').toLowerCase().trim();
      if (clean) tags.add(clean);
    });
  }

  // Strip code blocks and inline code
  let cleanContent = content.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, '');
  // Strip wikilinks and embeds (to prevent [[Note#Heading|Alias]] from generating '#Heading' tags)
  cleanContent = cleanContent.replace(/!*\[\[[^\]]+\]\]/g, '');
  // Strip markdown links
  cleanContent = cleanContent.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Extract standalone inline tags #something
  const lines = cleanContent.split('\n');
  for (const line of lines) {
    if (/^\s*#+\s/.test(line)) continue; // Ignore markdown headings # Heading
    const matches = line.match(/(?:^|\s)#([a-zA-Z][a-zA-Z0-9_\/-]*)(?=$|\s|[.,;:!?\)\]])/g);
    if (matches) {
      for (const m of matches) {
        const raw = m.trim().replace(/^#/, '').toLowerCase();
        // Ignore hex color codes and Discord channel names
        if (!/^[0-9a-f]{3,8}$/i.test(raw) && raw !== 'ouroboros_inn' && raw !== 'lfg' && raw !== 'session_reports') {
          tags.add(raw);
        }
      }
    }
  }

  return Array.from(tags).filter(t => t.length > 0 && t !== 'meta' && t !== 'lore' && !KNOWN_WORLDS.map(w => w.toLowerCase()).includes(t));
}

function extractAuthors(frontmatter: any): string[] {
  if (Array.isArray(frontmatter.authors)) {
    return frontmatter.authors.map(String);
  }
  if (frontmatter.author && typeof frontmatter.author === 'string') {
    return [frontmatter.author];
  }
  if (Array.isArray(frontmatter.author)) {
    return frontmatter.author.map(String);
  }
  return [];
}

interface VaultIndex {
  notes: NoteMetadata[];
  bySlug: Map<string, NoteMetadata>;
  byWorld: Map<string, NoteMetadata[]>;
  byTag: Map<string, NoteMetadata[]>;
  titleToSlugMap: Map<string, string>;
  allTags: Array<{ tag: string; count: number }>;
  sessionReports: {
    all: NoteMetadata[];
    withReport: NoteMetadata[];
    byWorld: Map<string, NoteMetadata[]>;
    byWorldWithReport: Map<string, NoteMetadata[]>;
  };
  attachments: Map<string, string>;
  timestamp: number;
}

let cachedIndex: VaultIndex | null = null;
const VAULT_CACHE_TTL = 30 * 1000; // 30s TTL for background freshness

export function invalidateVaultCache(): void {
  cachedIndex = null;
}

function buildVaultIndex(): VaultIndex {
  const notes: NoteMetadata[] = [];
  const attachments = new Map<string, string>();

  // 1. Index attachments into memory
  const searchDirs = [
    path.join(VAULT_PATH, '_META', '_attachments'),
    path.join(VAULT_PATH, '_attachments'),
    path.join(VAULT_PATH, 'attachments'),
    path.join(VAULT_PATH, 'Player Characters'),
    path.join(VAULT_PATH, 'World Notes'),
    VAULT_PATH,
  ];

  for (const attDir of searchDirs) {
    if (fs.existsSync(attDir)) {
      try {
        const files = fs.readdirSync(attDir);
        for (const f of files) {
          if (f.endsWith('.md')) continue;
          const cleanFile = path.basename(f, path.extname(f)).toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanFile && !attachments.has(cleanFile)) {
            attachments.set(cleanFile, f);
          }
          const fLower = f.toLowerCase();
          if (!attachments.has(fLower)) {
            attachments.set(fLower, f);
          }
        }
      } catch {}
    }
  }

  // 2. Scan and parse notes
  if (fs.existsSync(VAULT_PATH)) {
    const categories: Array<{ dir: string; cat: NoteMetadata['category'] }> = [
      { dir: 'World Notes', cat: 'world-note' },
      { dir: 'Session Reports', cat: 'session-report' },
      { dir: 'Player Characters', cat: 'character' },
      { dir: '_META', cat: 'guide' },
      { dir: '.', cat: 'guide' },
    ];

    for (const { dir, cat } of categories) {
      const fullDir = path.join(VAULT_PATH, dir);
      if (!fs.existsSync(fullDir)) continue;

      const files = fs.readdirSync(fullDir);
      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        if (dir === '.' && (f.startsWith('.') || f.startsWith('all_') || f.startsWith('linked_'))) continue;
        const fullPath = path.join(fullDir, f);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) continue;
        const fileContent = fs.readFileSync(fullPath, 'utf-8');

        const parsed = matter(fileContent);
        const baseName = f.replace(/\.md$/, '');
        const slug = slugify(baseName);

        // Determine Title
        let title = parsed.data.title;
        if (!title || typeof title !== 'string' || !title.trim()) {
          const h1Match = parsed.content.match(/^#\s+(.+)$/m);
          title = h1Match ? h1Match[1].trim() : baseName;
        }

        // Determine Date for Session Reports
        let date = parsed.data.date;
        if (!date && cat === 'session-report') {
          const dateMatch = baseName.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) date = dateMatch[1];
        }
        if (date instanceof Date) {
          date = date.toISOString().split('T')[0];
        }

        // Determine Abstract
        const absMatch = parsed.content.match(/>\s*\[!abstract\]\s*\n((?:>.*\n?)+)/i);
        let abstract = '';
        if (absMatch) {
          const text = absMatch[1].replace(/>/g, '').replace(/\n/g, ' ').trim();
          if (!/^session report for the expedition in/i.test(text)) {
            abstract = text;
          }
        }

        const worlds = extractWorlds(parsed.data, parsed.content, title, cat);
        const tags = extractTags(parsed.data, parsed.content);
        const authors = extractAuthors(parsed.data);

        const guildCharacterId = parsed.data.guildCharacterId ? String(parsed.data.guildCharacterId).trim() : undefined;

        let image: string | undefined = undefined;
        if (parsed.data.image && typeof parsed.data.image === 'string' && parsed.data.image.toLowerCase() !== 'null') {
          image = parsed.data.image.trim();
        } else {
          const imgMatch = parsed.content.match(/!\[\[([^\]]+\.(?:png|jpe?g|webp|gif|svg))(?:\s*\|.*?)?\]\]/i);
          if (imgMatch) {
            image = imgMatch[1].trim();
          } else {
            const mdImgMatch = parsed.content.match(/!\[.*?\]\(([^)\s]+\.(?:png|jpe?g|webp|gif|svg))\)/i);
            if (mdImgMatch) {
              image = mdImgMatch[1].trim();
            }
          }
        }

        let hasReport = true;
        if (cat === 'session-report' || tags.includes('session')) {
          let hasSubstance = false;
          if (authors.length > 0) {
            hasSubstance = true;
          } else if (abstract && abstract.trim().length > 0) {
            hasSubstance = true;
          } else {
            let body = parsed.content.replace(/^#\s+[^\n]*\n*/, '');
            body = body.replace(/>[^\n]*\n?/g, '');
            body = body.replace(/##\s+\[\[pc\|Player Character\]\]s[\s\S]*?(?=\n##|$)/i, '');
            body = body.replace(/##\s+Player Characters[\s\S]*?(?=\n##|$)/i, '');
            body = body.replace(/##\s*Notes\s*([\s\S]*)/i, (_, notes) => {
              return notes.replace(/^[\s-*]+$/gm, '').trim();
            });
            const cleanBody = body.replace(/#[^\n]*/g, '').replace(/^[\s-*]+$/gm, '').trim();
            hasSubstance = cleanBody.length > 20;
          }
          hasReport = hasSubstance;
        }

        let finalTitle = title;
        if (cat === 'session-report' || tags.includes('session')) {
          const sessionDateStr = date ? String(date).trim() : '';
          const sessionWorld = worlds.length > 0 ? worlds[0].toUpperCase() : '';
          if (sessionDateStr && sessionWorld) {
            finalTitle = `${sessionDateStr} ${sessionWorld}`;
          } else if (sessionDateStr) {
            finalTitle = sessionDateStr;
          }
        }

        notes.push({
          slug,
          title: finalTitle,
          category: cat,
          worlds,
          tags,
          authors,
          date: date ? String(date) : undefined,
          abstract: abstract || undefined,
          filePath: path.relative(VAULT_PATH, fullPath),
          updatedAt: stat.mtime.toISOString(),
          rawContent: parsed.content,
          guildCharacterId,
          image,
          hasReport,
        });
      }
    }
  }

  // 3. Precompute maps
  const bySlug = new Map<string, NoteMetadata>();
  const byWorld = new Map<string, NoteMetadata[]>();
  const byTag = new Map<string, NoteMetadata[]>();
  const titleToSlugMap = new Map<string, string>();
  const tagCounts = new Map<string, number>();

  for (const n of notes) {
    const slugLower = n.slug.toLowerCase();
    const slugClean = slugify(slugLower);
    const normTarget = slugClean.replace(/^_+/, '').replace(/_/g, '-');
    const titleLower = n.title.toLowerCase().trim();
    const titleClean = slugify(titleLower).replace(/^_+/, '').replace(/_/g, '-');
    const baseLower = path.basename(n.filePath, '.md').toLowerCase().trim();

    // Map all slug variants to n for instant O(1) resolution
    if (!bySlug.has(slugLower)) bySlug.set(slugLower, n);
    if (!bySlug.has(slugClean)) bySlug.set(slugClean, n);
    if (!bySlug.has(normTarget)) bySlug.set(normTarget, n);
    if (!bySlug.has(titleLower)) bySlug.set(titleLower, n);
    if (!bySlug.has(titleClean)) bySlug.set(titleClean, n);
    if (!bySlug.has(baseLower)) bySlug.set(baseLower, n);

    // Title map for wikilink resolution
    if (!titleToSlugMap.has(titleLower)) titleToSlugMap.set(titleLower, n.slug);
    if (!titleToSlugMap.has(baseLower)) titleToSlugMap.set(baseLower, n.slug);

    // World index
    for (const w of n.worlds) {
      const wKey = w.toLowerCase().trim();
      let list = byWorld.get(wKey);
      if (!list) {
        list = [];
        byWorld.set(wKey, list);
      }
      list.push(n);
    }

    // Tag index
    for (const t of n.tags) {
      const cleanTag = t.toLowerCase().trim();
      if (!cleanTag) continue;
      tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);

      let list = byTag.get(cleanTag);
      if (!list) {
        list = [];
        byTag.set(cleanTag, list);
      }
      list.push(n);

      // Support tag hierarchy: pc/wizard matches pc
      if (cleanTag.includes('/')) {
        const parentTag = cleanTag.split('/')[0];
        let pList = byTag.get(parentTag);
        if (!pList) {
          pList = [];
          byTag.set(parentTag, pList);
        }
        if (!pList.includes(n)) {
          pList.push(n);
        }
      }
    }
  }

  // Pre-sort tags
  const allTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  // Pre-sort and group session reports
  const allSessions = notes
    .filter(n => n.category === 'session-report')
    .sort((a, b) => {
      const da = a.date || '0000-00-00';
      const db = b.date || '0000-00-00';
      return db.localeCompare(da);
    });

  const withReport = allSessions.filter(n => n.hasReport);
  const sessionByWorld = new Map<string, NoteMetadata[]>();
  const sessionByWorldWithReport = new Map<string, NoteMetadata[]>();

  for (const s of allSessions) {
    for (const w of s.worlds) {
      const wKey = w.toLowerCase().trim();
      let list = sessionByWorld.get(wKey);
      if (!list) {
        list = [];
        sessionByWorld.set(wKey, list);
      }
      list.push(s);

      if (s.hasReport) {
        let rList = sessionByWorldWithReport.get(wKey);
        if (!rList) {
          rList = [];
          sessionByWorldWithReport.set(wKey, rList);
        }
        rList.push(s);
      }
    }
  }

  return {
    notes,
    bySlug,
    byWorld,
    byTag,
    titleToSlugMap,
    allTags,
    sessionReports: {
      all: allSessions,
      withReport,
      byWorld: sessionByWorld,
      byWorldWithReport: sessionByWorldWithReport,
    },
    attachments,
    timestamp: Date.now(),
  };
}

function getVaultIndex(): VaultIndex {
  const now = Date.now();
  if (cachedIndex && now - cachedIndex.timestamp < VAULT_CACHE_TTL) {
    return cachedIndex;
  }
  cachedIndex = buildVaultIndex();
  return cachedIndex;
}

export function getAllNotes(): NoteMetadata[] {
  return getVaultIndex().notes;
}

export function getNoteBySlug(slug: string): NoteMetadata | null {
  const index = getVaultIndex();
  const clean = decodeURIComponent(slug).toLowerCase().trim();
  const slugClean = slugify(clean);
  const normTarget = slugClean.replace(/^_+/, '').replace(/_/g, '-');
  return (
    index.bySlug.get(clean) ||
    index.bySlug.get(slugClean) ||
    index.bySlug.get(normTarget) ||
    null
  );
}

export function getNotesByWorld(world: string): NoteMetadata[] {
  const index = getVaultIndex();
  return index.byWorld.get(world.toLowerCase().trim()) || [];
}

export function getSessionReports(worldFilter?: string, requireReport: boolean = false): NoteMetadata[] {
  const index = getVaultIndex();
  const w = worldFilter && worldFilter.toLowerCase() !== 'all' ? worldFilter.toLowerCase().trim() : null;
  if (!w) {
    return requireReport ? index.sessionReports.withReport : index.sessionReports.all;
  }
  const map = requireReport ? index.sessionReports.byWorldWithReport : index.sessionReports.byWorld;
  return map.get(w) || [];
}

export function getNotesByTag(tag: string): NoteMetadata[] {
  const index = getVaultIndex();
  const target = tag.toLowerCase().replace(/^#/, '').trim();
  return index.byTag.get(target) || [];
}

export function getAllTags(): Array<{ tag: string; count: number }> {
  return getVaultIndex().allTags;
}

export function saveNote(
  category: NoteMetadata['category'],
  title: string,
  content: string,
  worlds: string[],
  tags: string[],
  authors: string[],
  existingFilePath?: string,
  date?: string,
  image?: string,
  guildCharacterId?: string
): { slug: string; filePath: string } {
  let targetFolder = 'World Notes';
  if (category === 'session-report' || tags.includes('session')) targetFolder = 'Session Reports';
  else if (category === 'character' || tags.includes('pc')) targetFolder = 'Player Characters';
  else if (category === 'guide' || tags.includes('meta')) targetFolder = '_META';

  let canonicalTitle = title.trim();
  if (category === 'session-report' || tags.includes('session')) {
    const sDate = (date || existingFilePath?.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '').trim();
    const sWorld = (worlds.length > 0 ? worlds[0] : '').toUpperCase().trim();
    if (sDate && sWorld) {
      canonicalTitle = `${sDate} ${sWorld}`;
    } else if (sDate) {
      canonicalTitle = sDate;
    }
  }

  const slug = slugify(canonicalTitle);
  const fileName = `${canonicalTitle.replace(/[\\/:*?"<>|]/g, '')}.md`;
  const fullPath = existingFilePath ? path.join(VAULT_PATH, existingFilePath) : path.join(VAULT_PATH, targetFolder, fileName);

  let existingData: any = {};
  if (fs.existsSync(fullPath)) {
    try {
      const existingParsed = matter(fs.readFileSync(fullPath, 'utf-8'));
      existingData = existingParsed.data || {};
    } catch {}
  }

  // Combine and deduplicate authors across all edits
  const combinedAuthors = Array.from(new Set([
    ...(Array.isArray(existingData.authors) ? existingData.authors.map(String) : []),
    ...(existingData.author ? [String(existingData.author)] : []),
    ...authors
  ])).filter(Boolean);

  const isGuide = category === 'guide' || tags.includes('meta');
  const finalWorlds = isGuide ? [] : worlds;

  const frontmatterData: any = {
    ...existingData,
    title: canonicalTitle,
    draft: false,
    worlds: finalWorlds,
    tags,
    authors: combinedAuthors,
  };

  if (image !== undefined) {
    if (image.trim()) {
      frontmatterData.image = image.trim();
    } else {
      delete frontmatterData.image;
    }
  }

  if (guildCharacterId) {
    frontmatterData.guildCharacterId = guildCharacterId;
  }

  if (date) {
    frontmatterData.date = date;
  } else if (existingData.date && (category === 'session-report' || tags.includes('session'))) {
    frontmatterData.date = existingData.date;
  }

  const fileString = matter.stringify(content, frontmatterData);
  fs.writeFileSync(fullPath, fileString, 'utf-8');

  try {
    fs.chownSync(fullPath, 1000, 1000);
    fs.chmodSync(fullPath, 0o775);
  } catch {}

  invalidateVaultCache();

  return { slug, filePath: path.relative(VAULT_PATH, fullPath) };
}

// Return precomputed fast lookup map for all note titles -> slugs
export function getTitleToSlugMap(): Map<string, string> {
  return getVaultIndex().titleToSlugMap;
}

// Obsidian Callout Themes (Strictly zero emojis)
const CALLOUT_THEMES: Record<string, { border: string; bg: string; title: string; defaultTitle: string }> = {
  note: { border: 'border-blue-500', bg: 'bg-blue-950/20', title: 'text-blue-400', defaultTitle: 'NOTE' },
  info: { border: 'border-sky-500', bg: 'bg-sky-950/20', title: 'text-sky-400', defaultTitle: 'INFO' },
  todo: { border: 'border-sky-500', bg: 'bg-sky-950/20', title: 'text-sky-400', defaultTitle: 'TODO' },
  abstract: { border: 'border-cyan-500', bg: 'bg-cyan-950/20', title: 'text-cyan-400', defaultTitle: 'ABSTRACT' },
  summary: { border: 'border-cyan-500', bg: 'bg-cyan-950/20', title: 'text-cyan-400', defaultTitle: 'SUMMARY' },
  tldr: { border: 'border-cyan-500', bg: 'bg-cyan-950/20', title: 'text-cyan-400', defaultTitle: 'TL;DR' },
  tip: { border: 'border-emerald-500', bg: 'bg-emerald-950/20', title: 'text-emerald-400', defaultTitle: 'TIP' },
  hint: { border: 'border-emerald-500', bg: 'bg-emerald-950/20', title: 'text-emerald-400', defaultTitle: 'HINT' },
  important: { border: 'border-teal-500', bg: 'bg-teal-950/20', title: 'text-teal-400', defaultTitle: 'IMPORTANT' },
  success: { border: 'border-green-500', bg: 'bg-green-950/20', title: 'text-green-400', defaultTitle: 'SUCCESS' },
  check: { border: 'border-green-500', bg: 'bg-green-950/20', title: 'text-green-400', defaultTitle: 'CHECK' },
  done: { border: 'border-green-500', bg: 'bg-green-950/20', title: 'text-green-400', defaultTitle: 'DONE' },
  question: { border: 'border-amber-500', bg: 'bg-amber-950/20', title: 'text-amber-400', defaultTitle: 'QUESTION' },
  help: { border: 'border-amber-500', bg: 'bg-amber-950/20', title: 'text-amber-400', defaultTitle: 'HELP' },
  faq: { border: 'border-amber-500', bg: 'bg-amber-950/20', title: 'text-amber-400', defaultTitle: 'FAQ' },
  warning: { border: 'border-orange-500', bg: 'bg-orange-950/20', title: 'text-orange-400', defaultTitle: 'WARNING' },
  caution: { border: 'border-orange-500', bg: 'bg-orange-950/20', title: 'text-orange-400', defaultTitle: 'CAUTION' },
  attention: { border: 'border-orange-500', bg: 'bg-orange-950/20', title: 'text-orange-400', defaultTitle: 'ATTENTION' },
  failure: { border: 'border-rose-500', bg: 'bg-rose-950/20', title: 'text-rose-400', defaultTitle: 'FAILURE' },
  fail: { border: 'border-rose-500', bg: 'bg-rose-950/20', title: 'text-rose-400', defaultTitle: 'FAIL' },
  missing: { border: 'border-rose-500', bg: 'bg-rose-950/20', title: 'text-rose-400', defaultTitle: 'MISSING' },
  danger: { border: 'border-red-500', bg: 'bg-red-950/20', title: 'text-red-400', defaultTitle: 'DANGER' },
  error: { border: 'border-red-500', bg: 'bg-red-950/20', title: 'text-red-400', defaultTitle: 'ERROR' },
  bug: { border: 'border-red-500', bg: 'bg-red-950/20', title: 'text-red-400', defaultTitle: 'BUG' },
  example: { border: 'border-purple-500', bg: 'bg-purple-950/20', title: 'text-purple-400', defaultTitle: 'EXAMPLE' },
  quote: { border: 'border-zinc-500', bg: 'bg-zinc-900/40', title: 'text-zinc-400', defaultTitle: 'QUOTE' },
  cite: { border: 'border-zinc-500', bg: 'bg-zinc-900/40', title: 'text-zinc-400', defaultTitle: 'CITE' },
};

// Custom Markdown rendering with wikilinks, image embeds, and Obsidian callouts
export function renderMarkdown(content: string, titleMap?: Map<string, string>): string {
  if (!titleMap) titleMap = getTitleToSlugMap();

  let text = content;

  // Protect code blocks and inline code from transformations
  const codeSpans: string[] = [];
  text = text.replace(/(```[\s\S]*?```|``[\s\S]*?``|`[^`\n]+`)/g, match => {
    const token = `%%CODE_SPAN_${codeSpans.length}%%`;
    codeSpans.push(match);
    return token;
  });

  // Protect and render LaTeX Math (block $$...$$ and inline $...$)
  const mathSpans: string[] = [];

  // Block math: $$ ... $$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const token = `%%MATH_SPAN_${mathSpans.length}%%`;
    let rendered = '';
    try {
      rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      rendered = `<div class="katex-error text-rose-400 font-mono text-xs my-2">${math}</div>`;
    }
    mathSpans.push(rendered);
    return token;
  });

  // Inline math: $ ... $ (avoiding $$)
  text = text.replace(/(?<!\$)\$(?!\$)((?:\\.|[^$\\\n])+?)(?<!\$)\$(?!\$)/g, (_, math) => {
    const token = `%%MATH_SPAN_${mathSpans.length}%%`;
    let rendered = '';
    try {
      rendered = katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      rendered = `<span class="katex-error text-rose-400 font-mono text-xs">${math}</span>`;
    }
    mathSpans.push(rendered);
    return token;
  });

  // 1. Transform Obsidian Image Embeds: ![[image.png]] or ![[image.png|width]]
  text = text.replace(/!\[\[(.*?)\]\]/g, (match, raw) => {
    const parts = raw.split('|');
    const filename = parts[0].trim();
    const width = parts[1] ? `width="${parts[1].trim()}"` : '';
    return `<div class="my-6 flex flex-col items-center">
      <img src="/api/attachments/${encodeURIComponent(filename)}" alt="${filename}" ${width} class="rounded-lg border border-obsidian-border max-w-full shadow-lg" loading="lazy" />
      <span class="text-xs text-obsidian-textFaint mt-1.5">${filename}</span>
    </div>`;
  });

  // 2. Transform Wikilinks: [[Target]] or [[Target|Alias]]
  text = text.replace(/\[\[(.*?)\]\]/g, (match, raw) => {
    const parts = raw.split('|');
    const target = parts[0].trim();
    const alias = parts[1] ? parts[1].trim() : target;

    // Check if it's a known world
    const matchedWorld = KNOWN_WORLDS.find(w => w.toLowerCase() === target.toLowerCase());
    if (matchedWorld) {
      return `<a href="/worlds/${matchedWorld.toLowerCase().replace(/\\s+/g, '-')}" class="wiki-link text-obsidian-purpleLight hover:underline font-medium">${alias}</a>`;
    }

    // Check in titleMap
    const slug = titleMap!.get(target.toLowerCase());
    if (slug) {
      return `<a href="/notes/${slug}" class="wiki-link text-obsidian-purpleLight hover:underline font-medium">${alias}</a>`;
    }

    // Unresolved link
    return `<span class="text-zinc-400 border-b border-dotted border-zinc-600 cursor-help" title="Unlinked: ${target}">${alias}</span>`;
  });

  // Configure marked for GitHub Flavored Markdown
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  // 3. Transform Obsidian Callouts:
  // > [!type|metadata][+-] Title
  // > Body...
  const calloutRegex = /^[ \t]*(?:-\s*)?>[ \t]*\[!([a-zA-Z0-9_-]+)(?:\|[^\]]*)?\]([+-])?[ \t]*([^\n]*)(?:\n((?:[ \t]*>.*(?:\n|$))*))?/gim;
  text = text.replace(calloutRegex, (match, type, collapse, title, body) => {
    const typeKey = (type || '').toLowerCase();
    const theme = CALLOUT_THEMES[typeKey] || {
      border: 'border-purple-500',
      bg: 'bg-purple-950/20',
      title: 'text-purple-300',
      defaultTitle: typeKey.toUpperCase(),
    };

    const displayTitle = (title || '').trim() || theme.defaultTitle;
    let cleanBody = (body || '').replace(/^[ \t]*>[ \t]?/gm, '').trim();
    cleanBody = cleanBody.replace(/%%CODE_SPAN_(\d+)%%/g, (_, idx) => codeSpans[Number(idx)]);
    cleanBody = cleanBody.replace(/%%MATH_SPAN_(\d+)%%/g, (_, idx) => mathSpans[Number(idx)]);
    const bodyHtml = cleanBody ? (marked.parse(cleanBody) as string) : '';

    if (collapse === '-') {
      return `\n\n<details class="callout my-4 p-4 rounded-r-lg border-l-4 ${theme.border} ${theme.bg}">
  <summary class="font-semibold text-sm tracking-wide uppercase cursor-pointer select-none ${theme.title}">${displayTitle}</summary>
  ${bodyHtml ? `<div class="callout-body mt-2 text-zinc-300 text-sm leading-relaxed prose prose-invert max-w-none [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">${bodyHtml}</div>` : ''}
</details>\n\n`;
    } else if (collapse === '+') {
      return `\n\n<details open class="callout my-4 p-4 rounded-r-lg border-l-4 ${theme.border} ${theme.bg}">
  <summary class="font-semibold text-sm tracking-wide uppercase cursor-pointer select-none ${theme.title}">${displayTitle}</summary>
  ${bodyHtml ? `<div class="callout-body mt-2 text-zinc-300 text-sm leading-relaxed prose prose-invert max-w-none [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">${bodyHtml}</div>` : ''}
</details>\n\n`;
    } else {
      return `\n\n<div class="callout my-4 p-4 rounded-r-lg border-l-4 ${theme.border} ${theme.bg}">
  <div class="callout-title font-semibold text-sm tracking-wide uppercase mb-1.5 ${theme.title}">${displayTitle}</div>
  ${bodyHtml ? `<div class="callout-body text-zinc-300 text-sm leading-relaxed prose prose-invert max-w-none [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">${bodyHtml}</div>` : ''}
</div>\n\n`;
    }
  });

  // Restore remaining code spans before final markdown parsing
  text = text.replace(/%%CODE_SPAN_(\d+)%%/g, (_, idx) => codeSpans[Number(idx)]);

  let parsedHtml = marked.parse(text) as string;

  // Restore LaTeX math spans
  parsedHtml = parsedHtml.replace(/%%MATH_SPAN_(\d+)%%/g, (_, idx) => mathSpans[Number(idx)]);

  return parsedHtml;
}

export function getCharacterAvatar(characterName: string, localNote?: NoteMetadata): string | null {
  if (localNote?.image) {
    let img = localNote.image.replace(/^!*\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
    if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('/')) {
      return img;
    }
    return `/api/attachments/${encodeURIComponent(img)}`;
  }

  const cleanTarget = characterName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanTarget) return null;

  const index = getVaultIndex();
  const directMatch = index.attachments.get(cleanTarget);
  if (directMatch) {
    return `/api/attachments/${encodeURIComponent(directMatch)}`;
  }

  // Fast prefix / partial match in memory
  for (const [key, filename] of index.attachments.entries()) {
    if (key.length >= 3 && (key.startsWith(cleanTarget) || cleanTarget.startsWith(key))) {
      return `/api/attachments/${encodeURIComponent(filename)}`;
    }
  }

  return null;
}

export function formatInlineMarkdown(content: string, titleMap?: Map<string, string>): string {
  if (!content) return '';
  if (!titleMap) titleMap = getTitleToSlugMap();

  let text = content;

  // 1. Transform Wikilinks: [[Target]] or [[Target|Alias]]
  text = text.replace(/\[\[(.*?)\]\]/g, (match, raw) => {
    const parts = raw.split('|');
    const target = parts[0].trim();
    const alias = parts[1] ? parts[1].trim() : target;

    // Check if it's a known world
    const matchedWorld = KNOWN_WORLDS.find(w => w.toLowerCase() === target.toLowerCase());
    if (matchedWorld) {
      return `<a href="/worlds/${matchedWorld.toLowerCase().replace(/\s+/g, '-')}" class="wiki-link text-obsidian-purpleLight hover:underline font-medium">${alias}</a>`;
    }

    // Check in titleMap
    const slug = titleMap!.get(target.toLowerCase());
    if (slug) {
      return `<a href="/notes/${slug}" class="wiki-link text-obsidian-purpleLight hover:underline font-medium">${alias}</a>`;
    }

    // Unresolved link
    return `<span class="text-zinc-400 border-b border-dotted border-zinc-600 cursor-help" title="Unlinked: ${target}">${alias}</span>`;
  });

  // Strip block callouts if any leaked in
  text = text.replace(/^[ \t]*(?:-\s*)?>[ \t]*\[![^\]]*\][^\n]*/gm, '');
  text = text.replace(/^[ \t]*>[ \t]?/gm, '');

  try {
    const parsed = marked.parseInline(text) as string;
    return parsed;
  } catch {
    return text;
  }
}

