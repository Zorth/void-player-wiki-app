import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getNotesByWorld, getSessionReports, getAllNotes, KNOWN_WORLDS, renderMarkdown, slugify, formatInlineMarkdown } from '@/lib/vault';
import { formatAuthors } from '@/lib/constants';
import { getGuildWorlds, getGuildSessions, getGuildQuests } from '@/lib/guild';
import { getSession } from '@/lib/auth';
import CommentsSection from '@/components/CommentsSection';
import { Compass, ExternalLink, Calendar, MapPin, Users, Flag, BookOpen, ScrollText, Edit, User, Clock, Scroll } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function WorldPage({ params }: { params: { world: string } }) {
  const worldSlug = decodeURIComponent(params?.world || '').toLowerCase();
  
  if (worldSlug === 'general-lore') {
    redirect('/rules');
  }

  // Find matching world name
  const matchedWorld = KNOWN_WORLDS.find(w => w.toLowerCase().replace(/\s+/g, '-') === worldSlug);

  if (!matchedWorld) {
    notFound();
  }

  const worldName = matchedWorld;

  const [session, guildWorlds, guildSessions, guildQuests] = await Promise.all([
    getSession(),
    getGuildWorlds(),
    getGuildSessions(),
    getGuildQuests(),
  ]);

  // Find the primary world note article in the vault (e.g. World Notes/Zenith.md)
  const allNotes = getAllNotes();
  const worldNote = allNotes.find(
    n => n.title.toLowerCase().trim() === worldName.toLowerCase().trim() ||
         slugify(n.title) === worldSlug ||
         n.slug === worldSlug
  );

  const notes = getNotesByWorld(worldName);
  const worldSessions = getSessionReports(worldName);

  const questBySessionDate = new Map<string, string>();
  for (const gs of guildSessions) {
    if (gs.date && gs.questId) {
      const q = guildQuests.find(quest => quest._id === gs.questId);
      if (q) {
        const dStr = new Date(gs.date).toISOString().split('T')[0];
        questBySessionDate.set(dStr, q.name);
      }
    }
  }

  const guildData = guildWorlds.find(w => w.name.toLowerCase() === worldName.toLowerCase());

  // World page and interactive map URL hosted on guild.tarragon.be (always capitalized world name)
  const guildWorldUrl = `https://guild.tarragon.be/world/${encodeURIComponent(worldName)}`;
  const mapUrl = `https://guild.tarragon.be/world/${encodeURIComponent(worldName)}/map`;
  const hasMap = true;

  // Clean description: replace obsolete external map URLs with official guild map, strip emojis
  const cleanDescription = guildData?.description
    ? guildData.description
        .replace(/https?:\/\/[^\s)]*sythian\.zorth\.eu[^\s)]*/gi, mapUrl)
        .replace(/http:\/\/vtt\.tarragon\.be\/?/gi, mapUrl)
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}]/gu, '')
        .trim()
    : null;

  const descriptionHtml = cleanDescription ? renderMarkdown(cleanDescription) : null;
  const worldNoteHtml = worldNote?.rawContent ? renderMarkdown(worldNote.rawContent) : null;

  // Categorize notes dynamically (exclude the world note itself from subcategory lists)
  const locations = notes.filter(n => n.slug !== worldNote?.slug && n.tags.some(t => t.includes('location') || t.includes('settlement')));
  const factions = notes.filter(n => n.slug !== worldNote?.slug && n.tags.some(t => t.includes('faction') || t.includes('organization')));
  const npcs = notes.filter(n => n.slug !== worldNote?.slug && n.tags.some(t => t.includes('npc') || t.includes('character')) && n.category !== 'character');
  const otherNotes = notes.filter(n => n.slug !== worldNote?.slug && !locations.includes(n) && !factions.includes(n) && !npcs.includes(n) && n.category !== 'session-report');

  return (
    <div className="space-y-10">
      {/* World Header */}
      <section className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 sm:p-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 text-xs text-obsidian-purpleLight font-semibold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              <span>World Overview</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {worldName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {worldNote && session?.canEdit && (
              <Link
                href={`/editor?slug=${encodeURIComponent(worldNote.slug)}`}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-obsidian-card hover:bg-obsidian-hover text-obsidian-textMuted hover:text-white border border-obsidian-border rounded-xl text-xs font-semibold transition-colors shadow-sm"
              >
                <Edit className="w-3.5 h-3.5 text-obsidian-purpleLight" />
                <span>Edit Article</span>
              </Link>
            )}

            {worldName !== 'General Lore' && (
              <a
                href={guildWorldUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-obsidian-card hover:bg-obsidian-hover text-obsidian-textMuted hover:text-white border border-obsidian-border rounded-xl text-xs font-semibold transition-colors"
              >
                <span>Guild Hub</span>
                <ExternalLink className="w-3.5 h-3.5 text-obsidian-purpleLight" />
              </a>
            )}

            {hasMap && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
              >
                <span>View Interactive Map</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Guild Description if available */}
        {descriptionHtml && (
          <div
            className="prose prose-invert max-w-none text-sm text-zinc-300 border-l-2 border-obsidian-purple pl-4 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        )}

        {/* Guild Factions list only if reputation is public */}
        {guildData?.reputationVisible && (guildData?.factionGroups && guildData.factionGroups.length > 0 ? (
          <div className="space-y-3 pt-4 border-t border-obsidian-borderSubtle">
            <h4 className="text-xs uppercase font-semibold text-obsidian-textFaint tracking-wider">
              Major Faction Coalitions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {guildData.factionGroups.map(fg => (
                <div key={fg.name} className="p-3 bg-obsidian-card border border-obsidian-borderSubtle rounded-lg">
                  <div className="font-semibold text-sm text-white mb-1.5">{fg.name}</div>
                  <div className="flex flex-wrap gap-1">
                    {fg.factions.map(f => (
                      <span key={f} className="text-[11px] px-2 py-0.5 rounded bg-obsidian-surface text-obsidian-textMuted border border-obsidian-border">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : guildData?.factions && guildData.factions.length > 0 ? (
          <div className="space-y-2 pt-4 border-t border-obsidian-borderSubtle">
            <h4 className="text-xs uppercase font-semibold text-obsidian-textFaint tracking-wider">
              Factions & Groups
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {guildData.factions.map(f => (
                <span key={f} className="text-xs px-2.5 py-1 rounded-md bg-obsidian-card text-obsidian-textMuted border border-obsidian-border">
                  {f}
                </span>
              ))}
            </div>
          </div>
        ) : null)}
      </section>

      {/* Dynamic World Content Sections */}

      {/* 1. Locations */}
      {locations.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-obsidian-purpleLight" />
            <h2 className="text-lg font-bold text-white">Locations & Settlements ({locations.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations.map(n => (
              <NoteCard key={n.slug} note={n} />
            ))}
          </div>
        </section>
      )}

      {/* 2. Factions & Organizations */}
      {factions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <Flag className="w-4 h-4 text-obsidian-purpleLight" />
            <h2 className="text-lg font-bold text-white">Factions & Organizations ({factions.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {factions.map(n => (
              <NoteCard key={n.slug} note={n} />
            ))}
          </div>
        </section>
      )}

      {/* 3. NPCs & Figures */}
      {npcs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-obsidian-purpleLight" />
            <h2 className="text-lg font-bold text-white">Notable Figures & NPCs ({npcs.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {npcs.map(n => (
              <NoteCard key={n.slug} note={n} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Lore & Other Articles */}
      {otherNotes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-obsidian-purpleLight" />
            <h2 className="text-lg font-bold text-white">World Lore & History ({otherNotes.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {otherNotes.map(n => (
              <NoteCard key={n.slug} note={n} />
            ))}
          </div>
        </section>
      )}

      {/* 5. Session Reports in this World */}
      <section className="space-y-3 pt-6 border-t border-obsidian-border">
        <div className="flex items-center space-x-2">
          <ScrollText className="w-4 h-4 text-obsidian-purpleLight" />
          <h2 className="text-lg font-bold text-white">Session Reports in {worldName} ({worldSessions.length})</h2>
        </div>

        {worldSessions.length === 0 ? (
          <p className="text-sm text-obsidian-textFaint">No session reports recorded in {worldName} yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {worldSessions.map(s => (
              <Link
                key={s.slug}
                href={`/notes/${s.slug}`}
                className="p-4 rounded-xl bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder hover:bg-obsidian-card transition-all"
              >
                <div className="flex items-center space-x-2 text-xs text-obsidian-textFaint mb-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{s.date || 'Unknown Date'}</span>
                </div>
                <div className="font-semibold text-white hover:text-obsidian-purpleLight transition-colors">
                  {s.title}
                </div>
                {s.date && questBySessionDate.has(s.date) && (
                  <div className="mt-1 flex items-center space-x-1.5 text-xs text-emerald-300 font-medium">
                    <Scroll className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{questBySessionDate.get(s.date)}</span>
                  </div>
                )}
                {s.abstract && (
                  <div
                    className="text-xs text-obsidian-textMuted mt-1 line-clamp-2 [&_a]:text-obsidian-purpleLight [&_a]:hover:underline [&_strong]:text-zinc-200"
                    dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(s.abstract) }}
                  />
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 6. Player-Written World Article / Dossier */}
      {worldNote && worldNoteHtml && (
        <section className="space-y-4 pt-6 border-t border-obsidian-border">
          <div className="flex items-center justify-between border-b border-obsidian-borderSubtle pb-2">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-obsidian-purpleLight" />
              <h2 className="text-lg font-bold text-white">World Lore &amp; Dossier</h2>
            </div>
            {worldNote.authors.length > 0 && (
              <span className="text-xs text-obsidian-textFaint">
                Contributed by <strong className="text-white">{formatAuthors(worldNote.authors)}</strong>
              </span>
            )}
          </div>

          <div
            className="prose max-w-none text-zinc-300 leading-relaxed font-sans bg-obsidian-surface/60 border border-obsidian-border rounded-2xl p-6 sm:p-8"
            dangerouslySetInnerHTML={{ __html: worldNoteHtml }}
          />
        </section>
      )}

      {/* 7. Community Discussion / Comments */}
      {worldNote && (
        <section className="pt-6 border-t border-obsidian-border">
          <CommentsSection noteSlug={worldNote.slug} initialUser={session} />
        </section>
      )}
    </div>
  );
}

function NoteCard({ note }: { note: any }) {
  return (
    <Link
      href={`/notes/${note.slug}`}
      className="p-4 rounded-xl bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder hover:bg-obsidian-card transition-all flex flex-col justify-between"
    >
      <div>
        <h3 className="font-semibold text-sm text-white hover:text-obsidian-purpleLight transition-colors">
          {note.title}
        </h3>
        {note.abstract ? (
          <p className="text-xs text-obsidian-textMuted mt-1.5 line-clamp-2">
            {note.abstract}
          </p>
        ) : (
          <p className="text-xs text-obsidian-textFaint mt-1.5 line-clamp-2">
            {note.rawContent.slice(0, 100).replace(/[#*`[\]>]/g, '')}...
          </p>
        )}
      </div>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-obsidian-borderSubtle">
          {note.tags.slice(0, 3).map((t: string) => (
            <span key={t} className="text-[10px] text-obsidian-textFaint">
              #{t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
