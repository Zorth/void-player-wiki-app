import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getNoteBySlug, renderMarkdown, KNOWN_WORLDS, slugify, getCharacterAvatar } from '@/lib/vault';
import { formatPlayerName } from '@/lib/constants';
import { getGuildCharacters, getGuildSessions, getGuildWorlds, getGuildQuests } from '@/lib/guild';
import { getSession } from '@/lib/auth';
import { formatDate } from '@/lib/date';
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
  Scroll,
  CheckCircle2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NotePage({ params }: { params: { slug: string } }) {
  const noteSlug = decodeURIComponent(params?.slug || '');
  const note = getNoteBySlug(noteSlug);
  if (!note) {
    notFound();
  }

  const session = await getSession();

  // If this article is for one of the primary campaign worlds, redirect to the unified world page
  const matchedKnownWorld = KNOWN_WORLDS.find(
    w => w.toLowerCase() === note.title.toLowerCase() ||
         slugify(w) === note.slug ||
         w.toLowerCase().replace(/\s+/g, '-') === note.slug
  );
  if (matchedKnownWorld) {
    redirect(`/worlds/${matchedKnownWorld.toLowerCase().replace(/\s+/g, '-')}`);
  }

  // Fetch Guild API data
  const [guildChars, guildSessions, guildWorlds, guildQuests] = await Promise.all([
    getGuildCharacters(),
    getGuildSessions(),
    getGuildWorlds(),
    getGuildQuests(),
  ]);

  // Check if character note (by Guild API character match, category, guildCharacterId, or tags)
  const matchedChar = guildChars.find(
    c =>
      (note.guildCharacterId && c._id === note.guildCharacterId) ||
      c.name.toLowerCase().trim() === note.title.toLowerCase().trim() ||
      slugify(c.name) === note.slug ||
      slugify(c.name).replace(/-/g, '') === note.slug.replace(/-/g, '') ||
      (note.rawContent && note.rawContent.includes(c._id))
  ) || null;

  // Player Characters are from Guild API or specifically tagged/categorized as PC
  const isPC =
    Boolean(matchedChar) ||
    Boolean(note.guildCharacterId) ||
    note.tags.some(t => t === 'pc' || t.startsWith('pc/')) ||
    (note.category === 'character' && !note.tags.includes('npc'));

  const isCharacter =
    isPC ||
    note.tags.some(t => t === 'character' || t === 'characters' || t === 'npc');

  const characterAvatar = isCharacter
    ? getCharacterAvatar(matchedChar?.name || note.title, note)
    : (note.image ? getCharacterAvatar(note.title, note) : null);

  // Check if session note
  const isSession = note.category === 'session-report' || note.tags.includes('session');
  const matchedSession = isSession
    ? guildSessions.find(
        s =>
          (note.date && new Date(s.date).toISOString().split('T')[0] === note.date) ||
          (note.rawContent && note.rawContent.includes(s._id))
      )
    : null;

  // Check if quest linked to the session
  const matchedQuest = isSession && matchedSession
    ? guildQuests.find(
        q =>
          (matchedSession.questId && q._id === matchedSession.questId) ||
          (q.completedSessionId && q.completedSessionId === matchedSession._id) ||
          (note.rawContent && note.rawContent.includes(q._id))
      ) || (matchedSession.questId ? guildQuests.find(q => q._id === matchedSession.questId) : null)
    : null;

  // For session reports: extract attendees, abstract, and notes
  let sessionPcs: Array<{ name: string; slug?: string; lvl?: number; ancestry?: string; class?: string; player?: string; avatarUrl?: string | null }> = [];
  let abstractHtml = '';
  let notesHtml = '';
  let hasAbstract = false;
  let hasNotes = false;

  if (isSession) {
    // 1. Gather characters: from Guild API first
    const attendeeNames = new Set<string>();
    const pcs: typeof sessionPcs = [];

    if (matchedSession?.characters && matchedSession.characters.length > 0) {
      for (const charId of matchedSession.characters) {
        const gc = guildChars.find(c => c._id === charId);
        if (gc) {
          attendeeNames.add(gc.name.toLowerCase().trim());
          const cSlug = slugify(gc.name);
          const cNote = getNoteBySlug(cSlug);
          const avatar = getCharacterAvatar(gc.name, cNote || undefined);
          pcs.push({
            name: gc.name,
            slug: cNote ? cNote.slug : undefined,
            lvl: gc.lvl,
            ancestry: gc.ancestry,
            class: gc.class,
            player: gc.player,
            avatarUrl: avatar,
          });
        }
      }
    }

    // 2. Also inspect raw markdown for any attendee links: ## [[pc|Player Character]]s or ## Player Characters
    const pcSectionMatch = note.rawContent.match(/##\s+(?:\[\[pc\|Player Character\]\]s|Player Characters)[\s\S]*?(?=\n##|$)/i);
    if (pcSectionMatch) {
      const pcSectionText = pcSectionMatch[0];
      const linkMatches = pcSectionText.matchAll(/\[\[(.*?)\]\]/g);
      for (const match of linkMatches) {
        const rawLink = match[1];
        const parts = rawLink.split('|');
        const target = parts[0].trim();
        const alias = parts[1]?.trim() || target;
        if (target.toLowerCase() === 'pc') continue; // Skip [[pc|Player Character]]s header link itself

        if (!attendeeNames.has(target.toLowerCase()) && !attendeeNames.has(alias.toLowerCase())) {
          attendeeNames.add(target.toLowerCase());
          const gc = guildChars.find(c => c.name.toLowerCase().trim() === target.toLowerCase() || c.name.toLowerCase().trim() === alias.toLowerCase());
          const cSlug = slugify(target);
          const cNote = getNoteBySlug(cSlug);
          const avatar = getCharacterAvatar(target, cNote || undefined);
          pcs.push({
            name: alias || target,
            slug: cNote ? cNote.slug : undefined,
            lvl: gc?.lvl,
            ancestry: gc?.ancestry,
            class: gc?.class,
            player: gc?.player,
            avatarUrl: avatar,
          });
        }
      }
    }
    sessionPcs = pcs;

    // 3. Extract Abstract
    const absCalloutMatch = note.rawContent.match(/>\s*\[!abstract\][^\n]*\n((?:[ \t]*>.*(?:\n|$))*)/i);
    let rawAbstract = '';
    if (absCalloutMatch) {
      rawAbstract = absCalloutMatch[1].replace(/^[ \t]*>[ \t]?/gm, '').trim();
    } else if (note.abstract) {
      rawAbstract = note.abstract.trim();
    }
    if (rawAbstract && !/^session report for the expedition in/i.test(rawAbstract)) {
      abstractHtml = renderMarkdown(rawAbstract);
      hasAbstract = true;
    }

    // 4. Extract Notes: remove title, callout abstract, and PC section
    let rawBody = note.rawContent;
    // Strip leading H1 title
    rawBody = rawBody.replace(/^#\s+[^\n]*\n*/, '');
    // Strip abstract callout
    rawBody = rawBody.replace(/>\s*\[!abstract\][^\n]*\n((?:[ \t]*>.*(?:\n|$))*)/gi, '');
    // Strip PC section
    rawBody = rawBody.replace(/##\s+(?:\[\[pc\|Player Character\]\]s|Player Characters)[\s\S]*?(?=\n##|$)/gi, '');
    // Strip ## Notes header if present
    rawBody = rawBody.replace(/##\s*Notes\s*\n*/i, '');
    // Check if notes have substance (not just empty bullets or whitespace)
    const cleanNotesCheck = rawBody.replace(/^[\s-*]+$/gm, '').trim();
    if (cleanNotesCheck.length > 0) {
      notesHtml = renderMarkdown(rawBody.trim());
      hasNotes = true;
    }
  }

  // For character articles: strip redundant abstract callout and duplicate image embed from the body (the official guild dossier card covers it)
  let bodyContent = note.rawContent;
  if (isCharacter) {
    bodyContent = bodyContent.replace(/>\s*\[!abstract\][^\n]*\n((?:[ \t]*>.*(?:\n|$))*)/gi, '').trim();
    if (note.image) {
      const escapedImg = note.image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      bodyContent = bodyContent.replace(new RegExp(`!\\[\\[${escapedImg}(?:\\|[^\\]]*)?\\]\\]\\n*`, 'gi'), '').trim();
    }
  }
  const htmlContent = renderMarkdown(bodyContent);

  // Rank is only applicable to Player Characters: "none" = "apprentice"
  const rawRank = isPC
    ? matchedChar?.rank || (note.tags.find(t => t.startsWith('pc/'))?.replace('pc/', '')) || (note as any).rank
    : null;
  const charRank = isPC ? (rawRank && rawRank.toLowerCase() !== 'none' ? rawRank : 'Apprentice') : null;

  // Check if world note
  const isWorld = note.tags.includes('world') || KNOWN_WORLDS.some(w => w.toLowerCase() === note.title.toLowerCase());
  const matchedWorld = isWorld
    ? guildWorlds.find(w => w.name.toLowerCase() === note.title.toLowerCase())
    : null;

  // Format updated date (CE(S)T 24-hour context)
  const updatedDateStr = formatDate(note.updatedAt);

  let fallbackHref = '/';
  let backLabel = 'Back to Wiki';

  if (isPC) {
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
            {isSession && matchedQuest && (
              <div className="flex items-center space-x-2 text-sm sm:text-base font-medium text-emerald-300">
                <Scroll className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{matchedQuest.name}</span>
                {matchedQuest.level && (
                  <span className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-800/40 font-mono">
                    Lvl {matchedQuest.level}
                  </span>
                )}
              </div>
            )}
            {isPC && charRank && (
              <div className="inline-flex items-center space-x-1.5 text-xs text-obsidian-purpleLight font-semibold uppercase tracking-wider">
                <Award className="w-3.5 h-3.5" />
                <span className="capitalize">{charRank} Rank</span>
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

      {/* Character Profile & Official Guild Record (Side-by-Side) */}
      {isCharacter && (
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Character Profile Picture (outside the callout card) */}
          {characterAvatar && (
            <div className="shrink-0">
              <img
                src={characterAvatar}
                alt={matchedChar?.name || note.title}
                className="max-h-56 max-w-[200px] sm:max-w-[240px] w-auto h-auto object-contain border border-obsidian-border shadow-md bg-obsidian-card"
              />
            </div>
          )}

          {/* Guild API Character Dossier Card (Callout) - only for Player Characters */}
          {isPC && (matchedChar || !characterAvatar) && (
            <section className="flex-1 w-full min-w-0 p-5 bg-gradient-to-r from-blue-950/20 via-obsidian-surface to-obsidian-surface border border-blue-800/40 rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-obsidian-borderSubtle pb-2.5">
                <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-blue-300">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Official Guild Character Record</span>
                </div>
                {matchedChar && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-blue-900/40 text-blue-200 border border-blue-700/50 font-mono font-semibold">
                    Lvl {matchedChar.lvl}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-obsidian-textFaint block">Player</span>
                  <span className="font-semibold text-white">
                    {matchedChar ? formatPlayerName(matchedChar.player) : (formatPlayerName(note.authors[0]) || 'Unknown')}
                  </span>
                </div>
                <div>
                  <span className="text-obsidian-textFaint block">Ancestry &amp; Class</span>
                  <span className="font-semibold text-white">
                    {matchedChar ? `${matchedChar.ancestry} ${matchedChar.class}` : 'Adventurer'}
                  </span>
                </div>
                <div>
                  <span className="text-obsidian-textFaint block">Guild Rank</span>
                  <span className="font-semibold text-obsidian-purpleLight capitalize">{charRank}</span>
                </div>
                <div>
                  <span className="text-obsidian-textFaint block">System &amp; XP</span>
                  <span className="font-semibold text-white">
                    {matchedChar ? `${matchedChar.system === 'PF' ? 'Pathfinder 2e' : 'D&D 2024'} (${matchedChar.xp || 0} XP)` : 'D&D 2024'}
                  </span>
                </div>
              </div>
            </section>
          )}
        </div>
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
            {matchedQuest && (
              <div>
                <span className="text-obsidian-textFaint block flex items-center space-x-1">
                  <Scroll className="w-3 h-3 text-emerald-400 inline" />
                  <span>Linked Quest</span>
                </span>
                <span className="font-semibold text-white">
                  {matchedQuest.name}
                </span>
                {matchedQuest.level && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 font-mono">
                    Lvl {matchedQuest.level}
                  </span>
                )}
              </div>
            )}
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

          {/* Expanded Quest Briefing Details */}
          {matchedQuest && (
            <div className="pt-3 border-t border-obsidian-borderSubtle space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-emerald-300 flex items-center space-x-1">
                    <Scroll className="w-3.5 h-3.5" />
                    <span>Quest Briefing: {matchedQuest.name}</span>
                  </span>
                  {matchedQuest.isCompleted && (
                    <span className="inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-700/50 font-mono">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Completed</span>
                    </span>
                  )}
                </div>
                {matchedQuest.questgiver && (
                  <span className="text-[11px] text-obsidian-textFaint">
                    Questgiver: <strong className="text-zinc-200">{matchedQuest.questgiver}</strong>
                  </span>
                )}
              </div>

              {matchedQuest.description && (
                <p className="text-xs text-zinc-300 leading-relaxed bg-obsidian-card/50 p-3 rounded-xl border border-obsidian-borderSubtle whitespace-pre-line">
                  {matchedQuest.description}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-obsidian-textMuted">
                {matchedQuest.reward && (
                  <span>
                    Reward: <strong className="text-amber-300/90">{matchedQuest.reward}</strong>
                  </span>
                )}
                {matchedQuest.tags && matchedQuest.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    {matchedQuest.tags.map(t => (
                      <span key={t} className="px-1.5 py-0.2 rounded bg-obsidian-surface text-[10px] text-obsidian-textFaint border border-obsidian-borderSubtle font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Session Report Structured Template */}
      {isSession ? (
        <div className="space-y-6">
          {/* Awaiting Report Alert */}
          {!note.hasReport && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-amber-300 block">This session is awaiting a debrief report</span>
                <p className="text-amber-200/70">
                  Only the automated expedition template is currently logged. No expedition members have filed an abstract or session notes yet.
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

          {/* 1. Attending Player Characters */}
          {sessionPcs.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-obsidian-textFaint">
                <User className="w-3.5 h-3.5 text-obsidian-purpleLight" />
                <span>Attending Player Characters ({sessionPcs.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessionPcs.map(pc => (
                  <div
                    key={pc.name}
                    className="p-3 bg-obsidian-surface border border-obsidian-border rounded-xl flex items-center space-x-3 hover:border-obsidian-purpleBorder transition-all"
                  >
                    {pc.avatarUrl ? (
                      <img
                        src={pc.avatarUrl}
                        alt={pc.name}
                        className="w-10 h-10 rounded-lg object-cover border border-obsidian-border shrink-0 bg-obsidian-card"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-obsidian-purpleFaint to-obsidian-card border border-obsidian-border flex items-center justify-center shrink-0 text-obsidian-purpleLight font-bold text-sm font-serif">
                        {pc.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-white truncate">
                          {pc.slug ? (
                            <Link href={`/notes/${pc.slug}`} className="hover:text-obsidian-purpleLight transition-colors">
                              {pc.name}
                            </Link>
                          ) : (
                            pc.name
                          )}
                        </span>
                        {pc.lvl !== undefined && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.2 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 font-mono font-semibold">
                            Lvl {pc.lvl}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-obsidian-textFaint truncate">
                        {pc.ancestry && pc.class ? `${pc.ancestry} ${pc.class}` : pc.player ? `Played by ${formatPlayerName(pc.player)}` : 'Adventurer'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. Abstract (Blue Styled Box) */}
          <section className="p-5 rounded-2xl bg-blue-950/25 border border-blue-800/50 shadow-sm space-y-2">
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-blue-300">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Abstract</span>
            </div>
            {hasAbstract ? (
              <div
                className="prose max-w-none text-blue-100/90 leading-relaxed font-sans text-sm [&>p:first-child]:mt-0 [&>p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: abstractHtml }}
              />
            ) : (
              <p className="text-xs text-blue-300/60 italic">
                No abstract recorded for this session yet.
              </p>
            )}
          </section>

          {/* 3. Notes Section */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-obsidian-textFaint">
              <FilePenLine className="w-3.5 h-3.5 text-obsidian-purpleLight" />
              <span>Notes</span>
            </div>
            {hasNotes ? (
              <div className="p-6 bg-obsidian-surface border border-obsidian-border rounded-2xl shadow-sm">
                <div
                  className="prose max-w-none text-zinc-300 leading-relaxed font-sans"
                  dangerouslySetInnerHTML={{ __html: notesHtml }}
                />
              </div>
            ) : (
              <div className="p-6 bg-obsidian-surface/60 border border-obsidian-border rounded-2xl text-center py-8">
                <p className="text-xs text-obsidian-textFaint italic">
                  No detailed notes or campaign logs recorded yet.
                </p>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* Standard Article Content (for World notes, Characters, Guides, etc.) */
        <div className="space-y-4">
          <div
            className="prose max-w-none text-zinc-300 leading-relaxed font-sans"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      )}

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
