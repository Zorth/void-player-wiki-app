import Link from 'next/link';
import { getGuildCharacters, GuildCharacter } from '@/lib/guild';
import { getAllNotes, slugify, getCharacterAvatar, NoteMetadata } from '@/lib/vault';
import { formatPlayerName } from '@/lib/constants';
import { Users, BookOpen, PlusCircle, Shield, Award, Skull } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CharactersPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const statusFilter = (searchParams?.status || 'all').toLowerCase();
  const characters = await getGuildCharacters();
  const allNotes = getAllNotes();

  // Index local character notes by multiple keys for reliable matching:
  // 1. guildCharacterId
  // 2. Exact title (lowercase)
  // 3. Slug
  const charByGuildId = new Map<string, NoteMetadata>();
  const charByTitle = new Map<string, NoteMetadata>();
  const sessionByGuildId = new Map<string, NoteMetadata>();

  for (const n of allNotes) {
    if (n.category === 'character') {
      if (n.guildCharacterId) {
        charByGuildId.set(n.guildCharacterId, n);
      }
      charByTitle.set(n.title.toLowerCase().trim(), n);
      charByTitle.set(slugify(n.title), n);
    } else if (n.category === 'session-report' || n.tags.includes('session')) {
      if (n.guildSessionId) {
        sessionByGuildId.set(n.guildSessionId, n);
      }
    }
  }

  // Sort characters by Level descending, then name
  const sorted = [...characters].sort((a, b) => b.lvl - a.lvl || a.name.localeCompare(b.name));
  const livingCharacters = sorted.filter(c => !c.isDead);
  const deadCharacters = sorted.filter(c => Boolean(c.isDead));

  const renderCharacterCard = (c: GuildCharacter) => {
    // Robust matching: guildCharacterId -> exact title -> slug -> prefix match (e.g. Klavik -> Klavik Irelok)
    const localNote =
      charByGuildId.get(c._id) ||
      charByTitle.get(c.name.toLowerCase().trim()) ||
      charByTitle.get(slugify(c.name)) ||
      allNotes.find(
        n =>
          n.category === 'character' &&
          (n.title.toLowerCase().startsWith(c.name.toLowerCase()) ||
            c.name.toLowerCase().startsWith(n.title.toLowerCase()))
      );

    const isDead = Boolean(c.isDead || localNote?.isDead);
    const deathSession = c.diedAtSessionId ? sessionByGuildId.get(c.diedAtSessionId) : null;
    const avatarUrl = getCharacterAvatar(c.name, localNote);

    return (
      <div
        key={c._id}
        className={`p-5 rounded-2xl transition-all shadow-sm flex flex-col justify-between ${
          isDead
            ? 'bg-gradient-to-b from-rose-950/20 via-obsidian-surface to-obsidian-surface border border-rose-900/40 hover:border-rose-700/60'
            : 'bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder'
        }`}
      >
        <div className="space-y-4">
          <div className="flex items-start space-x-3.5">
            {/* Character Portrait */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={c.name}
                className={`w-14 h-14 rounded-xl object-cover border shrink-0 shadow-md bg-obsidian-card ${
                  isDead ? 'border-rose-900/40' : 'border-obsidian-border'
                }`}
              />
            ) : (
              <div
                className={`w-14 h-14 rounded-xl border flex items-center justify-center shrink-0 font-bold text-lg font-serif shadow-sm ${
                  isDead
                    ? 'bg-gradient-to-br from-rose-950/40 to-obsidian-card border-rose-900/40 text-rose-300'
                    : 'bg-gradient-to-br from-obsidian-purpleFaint to-obsidian-card border-obsidian-border text-obsidian-purpleLight'
                }`}
              >
                {c.name.charAt(0)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold text-base sm:text-lg text-white truncate">
                  {localNote ? (
                    <Link
                      href={`/notes/${localNote.slug}`}
                      className={`transition-colors ${isDead ? 'hover:text-rose-300' : 'hover:text-obsidian-purpleLight'}`}
                    >
                      {c.name}
                    </Link>
                  ) : (
                    c.name
                  )}
                </h2>

                {isDead ? (
                  <span className="shrink-0 px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60 text-xs font-mono font-semibold flex items-center gap-1">
                    <Skull className="w-3 h-3 text-rose-400" />
                    Lvl {c.diedAtLevel || c.lvl}
                  </span>
                ) : (
                  <span className="shrink-0 px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 text-xs font-mono font-semibold">
                    Lvl {c.lvl}
                  </span>
                )}
              </div>

              <p className="text-xs text-obsidian-textFaint mt-0.5 truncate">
                Played by <span className="text-obsidian-textMuted font-medium">{formatPlayerName(c.player)}</span>
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-zinc-300 pt-1 border-t border-obsidian-borderSubtle">
            <div className="flex items-center justify-between">
              <span className="text-obsidian-textFaint">Class:</span>
              <span className="font-medium text-white text-right truncate ml-2">
                {c.ancestry} {c.class}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-obsidian-textFaint">Rank:</span>
              <span className="capitalize font-medium text-obsidian-purpleLight">
                {c.rank && c.rank.toLowerCase() !== 'none' ? c.rank : 'Apprentice'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-obsidian-textFaint">System:</span>
              <span className="text-obsidian-textMuted">
                {c.system === 'PF' ? 'Pathfinder 2e' : 'D&D 2024'}
              </span>
            </div>

            {isDead && (
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <Skull className="w-3 h-3" />
                  Status:
                </span>
                <span className="font-semibold text-rose-300">
                  Deceased{c.diedAtLevel ? ` (Lvl ${c.diedAtLevel})` : ''}
                </span>
              </div>
            )}

            {isDead && deathSession && (
              <div className="flex items-center justify-between pt-0.5 text-[11px]">
                <span className="text-obsidian-textFaint">Fell In:</span>
                <Link
                  href={`/notes/${deathSession.slug}`}
                  className="font-medium text-rose-300 hover:text-white underline truncate ml-2 max-w-[170px]"
                  title={deathSession.title}
                >
                  {deathSession.title}
                </Link>
              </div>
            )}
          </div>
        </div>

        {localNote ? (
          <div className="mt-5 pt-3 border-t border-obsidian-borderSubtle flex items-center justify-between">
            <Link
              href={`/notes/${localNote.slug}`}
              className={`inline-flex items-center space-x-1.5 text-xs font-semibold hover:underline ${
                isDead ? 'text-rose-300 hover:text-rose-200' : 'text-obsidian-purpleLight'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{isDead ? 'Read Memorial Dossier →' : 'Read Character Dossier →'}</span>
            </Link>
          </div>
        ) : (
          <div className="mt-5 pt-3 border-t border-obsidian-borderSubtle flex items-center justify-between">
            <span className="text-[11px] text-obsidian-textFaint">No Dossier Yet</span>
            <Link
              href={`/editor?category=character&title=${encodeURIComponent(c.name)}&guildCharacterId=${encodeURIComponent(c._id)}`}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border text-xs font-semibold text-obsidian-purpleLight hover:text-white transition-colors"
            >
              <PlusCircle className="w-3 h-3" />
              <span>{isDead ? 'Create Memorial' : 'Create Dossier'}</span>
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-obsidian-border pb-6">
        <div className="inline-flex items-center space-x-1.5 text-xs text-obsidian-purpleLight font-semibold uppercase tracking-wider mb-1">
          <Users className="w-3.5 h-3.5" />
          <span>Guild of The Void</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Characters Roster</h1>
            <p className="text-sm text-obsidian-textMuted mt-1">
              Active adventurers and fallen heroes synchronized directly with the Guild API.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-obsidian-textMuted self-start sm:self-auto bg-obsidian-card/60 px-3 py-1.5 rounded-lg border border-obsidian-border">
            <span><strong className="text-white">{livingCharacters.length}</strong> Active</span>
            <span className="text-obsidian-border">&bull;</span>
            <span className="text-rose-400 flex items-center gap-1 font-semibold">
              <Skull className="w-3 h-3" />
              <strong>{deadCharacters.length}</strong> Fallen
            </span>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
        {[
          { label: 'All Characters', value: 'all', count: sorted.length },
          { label: 'Active Roster', value: 'active', count: livingCharacters.length },
          { label: 'Fallen Heroes', value: 'dead', count: deadCharacters.length },
        ].map(tab => {
          const isActive = statusFilter === tab.value;
          const href = tab.value === 'all' ? '/characters' : `/characters?status=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isActive
                  ? tab.value === 'dead'
                    ? 'bg-rose-950/70 border border-rose-800 text-rose-200 shadow-sm'
                    : 'bg-obsidian-purple text-white shadow-sm'
                  : 'bg-obsidian-surface border border-obsidian-border text-obsidian-textMuted hover:text-white hover:bg-obsidian-card'
              }`}
            >
              {tab.value === 'dead' && <Skull className="w-3 h-3 text-rose-400" />}
              <span>{tab.label}</span>
              <span className="text-[10px] opacity-75 font-mono">({tab.count})</span>
            </Link>
          );
        })}
      </div>

      {/* Content Rendering based on filter */}
      {statusFilter === 'all' ? (
        <div className="space-y-10">
          {/* Active Characters Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-obsidian-borderSubtle pb-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-obsidian-purpleLight" />
                <span>Active Adventurers</span>
                <span className="text-xs font-mono font-normal text-obsidian-textMuted">({livingCharacters.length})</span>
              </h2>
            </div>
            {livingCharacters.length === 0 ? (
              <p className="text-sm text-obsidian-textMuted italic py-4">No active adventurers found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {livingCharacters.map(renderCharacterCard)}
              </div>
            )}
          </div>

          {/* Fallen Heroes Section */}
          {deadCharacters.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-rose-900/40 pb-2">
                <h2 className="text-base font-bold text-rose-300 flex items-center gap-2">
                  <Skull className="w-4 h-4 text-rose-400" />
                  <span>Fallen Heroes &amp; Memorial</span>
                  <span className="text-xs font-mono font-normal text-rose-400/70">({deadCharacters.length})</span>
                </h2>
                <span className="text-xs text-rose-400/80 italic hidden sm:inline">Honoring those who gave their lives in the Void</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {deadCharacters.map(renderCharacterCard)}
              </div>
            </div>
          )}
        </div>
      ) : statusFilter === 'active' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-obsidian-borderSubtle pb-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-obsidian-purpleLight" />
              <span>Active Adventurers</span>
              <span className="text-xs font-mono font-normal text-obsidian-textMuted">({livingCharacters.length})</span>
            </h2>
          </div>
          {livingCharacters.length === 0 ? (
            <div className="text-center py-12 bg-obsidian-surface border border-obsidian-border rounded-xl">
              <p className="text-sm text-obsidian-textMuted">No active adventurers found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {livingCharacters.map(renderCharacterCard)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-rose-900/40 pb-2">
            <h2 className="text-base font-bold text-rose-300 flex items-center gap-2">
              <Skull className="w-4 h-4 text-rose-400" />
              <span>Fallen Heroes &amp; Memorial</span>
              <span className="text-xs font-mono font-normal text-rose-400/70">({deadCharacters.length})</span>
            </h2>
            <span className="text-xs text-rose-400/80 italic">Honoring those who gave their lives in the Void</span>
          </div>
          {deadCharacters.length === 0 ? (
            <div className="text-center py-12 bg-obsidian-surface border border-obsidian-border rounded-xl">
              <p className="text-sm text-obsidian-textMuted">No fallen heroes recorded.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deadCharacters.map(renderCharacterCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
