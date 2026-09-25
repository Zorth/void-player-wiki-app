import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNoteBySlug, renderMarkdown, KNOWN_WORLDS, slugify } from '@/lib/vault';
import { getGuildCharacters, getGuildSessions, getGuildWorlds } from '@/lib/guild';
import { getSession } from '@/lib/auth';
import CommentsSection from '@/components/CommentsSection';
import BackButton from '@/components/BackButton';
import {
  Compass,
  Calendar,
  User,
  Edit,
  Tag,
  ArrowLeft,
  Clock,
  Shield,
  Award,
  ExternalLink,
  Coins,
  MessageSquare,
  Sparkles,
  FilePenLine,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NotePage({ params }: { params: { slug: string } }) {
  const noteSlug = decodeURIComponent(params?.slug || '');
  const note = getNoteBySlug(noteSlug);
  if (!note) {
    notFound();
  }

  const session = await getSession();
  const htmlContent = renderMarkdown(note.rawContent);

  // Fetch Guild API data
  const [guildChars, guildSessions, guildWorlds] = await Promise.all([
    getGuildCharacters(),
    getGuildSessions(),
    getGuildWorlds(),
  ]);

  // Check if character note
  const isCharacter = note.category === 'character' || note.tags.some(t => t === 'pc' || t.startsWith('pc/'));
  const matchedChar = isCharacter
    ? guildChars.find(
        c =>
          c.name.toLowerCase().trim() === note.title.toLowerCase().trim() ||
          slugify(c.name) === note.slug ||
          (note.rawContent && note.rawContent.includes(c._id))
      )
    : null;

  // Check if session note
  const isSession = note.category === 'session-report' || note.tags.includes('session');
  const matchedSession = isSession
    ? guildSessions.find(
        s =>
          (note.date && new Date(s.date).toISOString().split('T')[0] === note.date) ||
          (note.rawContent && note.rawContent.includes(s._id))
      )
    : null;

  // Check if world note
  const isWorld = note.tags.includes('world') || KNOWN_WORLDS.some(w => w.toLowerCase() === note.title.toLowerCase());
  const matchedWorld = isWorld
    ? guildWorlds.find(w => w.name.toLowerCase() === note.title.toLowerCase())
    : null;

  // Format updated date
  const updatedDateStr = new Date(note.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  let fallbackHref = '/';
  let backLabel = 'Back to Wiki';

  if (isCharacter || note.category === 'character') {
    fallbackHref = '/characters';
    backLabel = 'Back to Characters';
  } else if (isSession || note.category === 'session-report') {
    fallbackHref = '/sessions';
    backLabel = 'Back to Sessions';
  } else if (note.category === 'guide') {
    fallbackHref = '/rules';
    backLabel = 'Back to Rules';
  } else if (note.worlds.length === 1) {
    fallbackHref = `/worlds/${note.worlds[0].toLowerCase().replace(/\s+/g, '-')}`;
    backLabel = `Back to ${note.worlds[0]}`;
  } else if (note.worlds.length > 1) {
    fallbackHref = '/worlds';
    backLabel = 'Back to Worlds';
  }

  return (
    <article className="max-w-4xl mx-auto space-y-8">
      {/* Top Bar: Back & World Breadcrumbs */}
      <div className="flex items-center justify-between text-xs text-obsidian-textFaint">
        <BackButton fallbackHref={fallbackHref} label={backLabel} />

        {note.worlds.length > 0 && (
          <div className="flex items-center space-x-2">
            <span>World:</span>
            {note.worlds.map(w => (
              <Link
                key={w}
                href={`/worlds/${w.toLowerCase().replace(/\s+/g, '-')}`}
                className="inline-flex items-center text-obsidian-purpleLight hover:underline font-medium"
              >
                <Compass className="w-3 h-3 mr-1" />
                {w}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Note Header */}
      <header className="space-y-4 border-b border-obsidian-border pb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              {note.title}
            </h1>
            {isCharacter && matchedChar?.rank && (
              <div className="inline-flex items-center space-x-1.5 text-xs text-obsidian-purpleLight font-semibold uppercase tracking-wider">
                <Award className="w-3.5 h-3.5" />
                <span className="capitalize">{matchedChar.rank} Rank</span>
              </div>
            )}
          </div>

          {session?.canEdit && (
            <Link
              href={`/editor?slug=${encodeURIComponent(note.slug)}`}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border rounded-lg text-xs font-semibold text-white transition-colors shrink-0 shadow-sm"
            >
              <Edit className="w-3.5 h-3.5 text-obsidian-purpleLight" />
              <span>Edit Note</span>
            </Link>
          )}
        </div>

        {/* Metadata: Authors, Session Date vs Last Edited On */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-obsidian-textMuted">
          {note.authors.length > 0 ? (
            <div className="flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-obsidian-textFaint" />
              <span>Contributed by <strong className="text-white">{note.authors.join(', ')}</strong></span>
            </div>
          ) : isSession ? (
            <div className="flex items-center space-x-1.5 text-amber-300/90 font-medium">
              <FilePenLine className="w-3.5 h-3.5 text-amber-400" />
              <span>Awaiting Report Contributors</span>
            </div>
          ) : null}

          {isSession && note.date ? (
            <div className="flex items-center space-x-1.5 font-mono text-purple-300">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>Session Date: <strong>{note.date}</strong></span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-obsidian-textFaint" />
              <span>Last edited on {updatedDateStr}</span>
            </div>
          )}
        </div>
      </header>

      {/* Guild API Character Dossier Card (API data takes precedence) */}
      {isCharacter && matchedChar && (
        <section className="p-5 bg-gradient-to-r from-blue-950/20 via-obsidian-surface to-obsidian-surface border border-blue-800/40 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-obsidian-borderSubtle pb-2.5">
            <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-blue-300">
              <Shield className="w-3.5 h-3.5" />
              <span>Official Guild Character Record</span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-blue-900/40 text-blue-200 border border-blue-700/50 font-mono font-semibold">
              Lvl {matchedChar.lvl}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-obsidian-textFaint block">Player</span>
              <span className="font-semibold text-white">{matchedChar.player}</span>
            </div>
            <div>
              <span className="text-obsidian-textFaint block">Ancestry &amp; Class</span>
              <span className="font-semibold text-white">{matchedChar.ancestry} {matchedChar.class}</span>
            </div>
            <div>
              <span className="text-obsidian-textFaint block">Guild Rank</span>
              <span className="font-semibold text-obsidian-purpleLight capitalize">{matchedChar.rank || 'Apprentice'}</span>
            </div>
            <div>
              <span className="text-obsidian-textFaint block">System &amp; XP</span>
              <span className="font-semibold text-white">{matchedChar.system === 'PF' ? 'Pathfinder 2e' : 'D&D 2024'} ({matchedChar.xp || 0} XP)</span>
            </div>
          </div>
        </section>
      )}

      {/* Guild API Session Record Card */}
      {isSession && matchedSession && (
        <section className="p-5 bg-gradient-to-r from-purple-950/20 via-obsidian-surface to-obsidian-surface border border-purple-800/40 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-obsidian-borderSubtle pb-2.5">
            <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-purple-300">
              <Calendar className="w-3.5 h-3.5" />
              <span>Guild Expedition Record</span>
            </div>
            {matchedSession.system && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-purple-900/40 text-purple-200 border border-purple-700/50 font-mono font-semibold">
                {matchedSession.system}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {matchedSession.loot && matchedSession.loot.length > 0 && (
              <div>
                <span className="text-obsidian-textFaint block flex items-center space-x-1">
                  <Coins className="w-3 h-3 text-amber-400 inline" />
                  <span>Reported Loot</span>
                </span>
                <span className="font-medium text-white">
                  {matchedSession.loot.map(l => (l.name ? `${l.name} (${l.valueGP || 0} GP)` : `${l.valueGP || 0} GP`)).join(', ')}
                </span>
              </div>
            )}
            {matchedSession.discordThreadId && (
              <div>
                <span className="text-obsidian-textFaint block">Discord Discussion</span>
                <a
                  href={`https://discord.com/channels/878674783972261918/${matchedSession.discordThreadId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-obsidian-purpleLight hover:underline inline-flex items-center space-x-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>View Session Thread</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* World Note: Visual separation of Official Guild Data vs Community Lore */}
      {isWorld && (
        <section className="p-5 bg-obsidian-card/60 border border-obsidian-border rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-obsidian-borderSubtle pb-2">
            <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Compass className="w-3.5 h-3.5" />
              <span>Official Guild Archive Data</span>
            </div>
            <a
              href={`https://guild.tarragon.be/world/${encodeURIComponent(matchedWorld?.name || note.title)}/map`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-300 hover:underline inline-flex items-center space-x-1 font-semibold"
            >
              <span>Interactive Map</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {matchedWorld?.description && (
            <p className="text-xs text-obsidian-textMuted leading-relaxed">
              {matchedWorld.description.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}]/gu, '')}
            </p>
          )}
        </section>
      )}

      {/* Main Player Written Content */}
      <div className="space-y-4">
        {isWorld && (
          <div className="text-xs font-bold uppercase tracking-wider text-obsidian-textFaint border-b border-obsidian-borderSubtle pb-1">
            Community Lore &amp; Dossier
          </div>
        )}

        {isSession && !note.hasReport && (
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-amber-300 block">This session is awaiting a debrief report</span>
              <p className="text-amber-200/70">
                Only the automated expedition template is currently logged. No expedition members have filed a narrative or session notes yet.
              </p>
            </div>
            {session?.canEdit ? (
              <Link
                href={`/editor?slug=${encodeURIComponent(note.slug)}`}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-semibold text-white transition-colors shrink-0 shadow-sm"
              >
                <FilePenLine className="w-3.5 h-3.5" />
                <span>Write Report</span>
              </Link>
            ) : null}
          </div>
        )}

        <div
          className="prose max-w-none text-zinc-300 leading-relaxed font-sans"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* Tags footer */}
      {note.tags.length > 0 && (
        <div className="pt-6 border-t border-obsidian-borderSubtle flex flex-wrap items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-obsidian-textFaint mr-1" />
          {note.tags.map(t => (
            <Link
              key={t}
              href={`/tags/${encodeURIComponent(t)}`}
              className="px-2 py-0.5 rounded bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purple text-xs font-mono text-obsidian-textMuted hover:text-white transition-colors"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      {/* Comments Section */}
      <CommentsSection noteSlug={note.slug} />
    </article>
  );
}
