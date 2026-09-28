import Link from 'next/link';
import { getSessionReports, KNOWN_WORLDS, formatInlineMarkdown } from '@/lib/vault';
import { getGuildSessions, getGuildCharacters, getGuildQuests } from '@/lib/guild';
import { Calendar, Compass, Users, Coins, MessageSquare, PlusCircle, FilePenLine, CheckCircle2, Scroll } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: { world?: string };
}) {
  const worldFilter = searchParams.world || 'All';
  const sessions = getSessionReports(worldFilter);
  const guildSessions = await getGuildSessions();
  const guildChars = await getGuildCharacters();
  const guildQuests = await getGuildQuests();

  const charMap = new Map(guildChars.map(c => [c._id, c.name]));

  // Match guild sessions & quests to local sessions by date string
  const guildSessionByDate = new Map<string, any>();
  const questBySessionDate = new Map<string, string>();
  for (const gs of guildSessions) {
    if (gs.date) {
      const dStr = new Date(gs.date).toISOString().split('T')[0];
      guildSessionByDate.set(dStr, gs);
      if (gs.questId) {
        const q = guildQuests.find(quest => quest._id === gs.questId);
        if (q) {
          questBySessionDate.set(dStr, q.name);
        }
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-obsidian-border pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Campaign Session Reports</h1>
          <p className="text-sm text-obsidian-textMuted mt-1">
            Chronological archive of all recorded adventure logs, quest outcomes, and character deeds.
          </p>
        </div>

        <Link
          href="/editor?category=session-report"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-obsidian-purple hover:bg-obsidian-purpleHover text-white rounded-lg text-sm font-semibold shadow-md transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Write Session Report</span>
        </Link>
      </div>

      {/* World Filter Bar */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
        <span className="text-xs uppercase font-semibold text-obsidian-textFaint mr-2 shrink-0">
          Filter by World:
        </span>
        {['All', ...KNOWN_WORLDS].map(w => {
          const isActive = worldFilter.toLowerCase() === w.toLowerCase();
          const href = w === 'All' ? '/sessions' : `/sessions?world=${encodeURIComponent(w)}`;
          return (
            <Link
              key={w}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-obsidian-purple text-white shadow-sm'
                  : 'bg-obsidian-surface border border-obsidian-border text-obsidian-textMuted hover:text-white hover:bg-obsidian-card'
              }`}
            >
              {w}
            </Link>
          );
        })}
      </div>

      {/* Sessions Timeline List */}
      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-16 bg-obsidian-surface border border-obsidian-border rounded-xl">
            <p className="text-base text-obsidian-textMuted">No session reports found for this filter.</p>
          </div>
        ) : (
          sessions.map(s => {
            const gs = s.date ? guildSessionByDate.get(s.date) : null;
            const attendees: string[] = [];
            if (gs?.characters) {
              gs.characters.forEach((cid: string) => {
                const cname = charMap.get(cid);
                if (cname) attendees.push(cname);
              });
            }

            const hasReport = s.hasReport ?? false;

            return (
              <div
                key={s.slug}
                className={`p-6 rounded-2xl transition-all shadow-sm group ${
                  hasReport
                    ? 'bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder'
                    : 'bg-obsidian-surface/40 border border-dashed border-obsidian-border/80 hover:border-obsidian-purpleBorder/80 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    {/* Date & World & Status Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex items-center space-x-1.5 text-obsidian-purpleLight font-mono font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{s.date || 'Undated'}</span>
                      </div>
                      {s.worlds.map(w => (
                        <span key={w} className="inline-flex items-center px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 text-[11px]">
                          <Compass className="w-3 h-3 mr-1" />
                          {w}
                        </span>
                      ))}
                      {gs?.loot && gs.loot.length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40 text-[11px]">
                          <Coins className="w-3 h-3 mr-1" />
                          Loot Logged
                        </span>
                      )}
                      {hasReport ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 text-[11px] font-medium">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Report Logged
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 text-[11px] font-medium">
                          <FilePenLine className="w-3 h-3 mr-1" />
                          Awaiting Report
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <Link href={`/notes/${s.slug}`}>
                      <h2 className="text-xl font-bold text-white group-hover:text-obsidian-purpleLight transition-colors">
                        {s.title}
                      </h2>
                    </Link>

                    {/* Quest Subtitle */}
                    {s.date && questBySessionDate.has(s.date) && (
                      <div className="flex items-center space-x-1.5 text-xs text-emerald-300 font-medium">
                        <Scroll className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{questBySessionDate.get(s.date)}</span>
                      </div>
                    )}

                    {/* Abstract or Prompt */}
                    {s.abstract ? (
                      <div
                        className="text-sm text-zinc-300 leading-relaxed max-w-4xl [&_a]:text-obsidian-purpleLight [&_a]:hover:underline [&_strong]:text-white"
                        dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(s.abstract) }}
                      />
                    ) : !hasReport ? (
                      <p className="text-xs text-obsidian-textFaint italic">
                        No debrief or mission report has been filed yet for this session.
                      </p>
                    ) : null}

                    {/* Attending Characters if synced */}
                    {attendees.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2">
                        <Users className="w-3.5 h-3.5 text-obsidian-textFaint mr-1 shrink-0" />
                        {attendees.map(a => (
                          <span key={a} className="text-xs px-2 py-0.5 rounded bg-obsidian-card text-obsidian-textMuted border border-obsidian-borderSubtle">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Read button & Authors */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-obsidian-borderSubtle">
                    {hasReport ? (
                      <Link
                        href={`/notes/${s.slug}`}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border rounded-xl text-xs font-semibold text-white transition-colors"
                      >
                        <span>Read Full Report</span>
                      </Link>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/editor?slug=${encodeURIComponent(s.slug)}`}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-obsidian-purple hover:bg-obsidian-purpleHover text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                        >
                          <FilePenLine className="w-3.5 h-3.5" />
                          <span>Write Report</span>
                        </Link>
                        <Link
                          href={`/notes/${s.slug}`}
                          className="inline-flex items-center space-x-1.5 px-3 py-2 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border rounded-xl text-xs font-semibold text-obsidian-textMuted hover:text-white transition-colors"
                        >
                          <span>View Note</span>
                        </Link>
                      </div>
                    )}
                    {s.authors.length > 0 && (
                      <span className="text-[11px] text-obsidian-textFaint">
                        By {s.authors.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
