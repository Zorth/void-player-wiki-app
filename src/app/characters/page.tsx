import Link from 'next/link';
import { getGuildCharacters } from '@/lib/guild';
import { getAllNotes, slugify, getCharacterAvatar, NoteMetadata } from '@/lib/vault';
import { Users, BookOpen, PlusCircle, Shield, Award } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CharactersPage() {
  const characters = await getGuildCharacters();
  const allNotes = getAllNotes();

  // Index local character notes by multiple keys for reliable matching:
  // 1. guildCharacterId
  // 2. Exact title (lowercase)
  // 3. Slug
  const charByGuildId = new Map<string, NoteMetadata>();
  const charByTitle = new Map<string, NoteMetadata>();

  for (const n of allNotes) {
    if (n.category === 'character') {
      if (n.guildCharacterId) {
        charByGuildId.set(n.guildCharacterId, n);
      }
      charByTitle.set(n.title.toLowerCase().trim(), n);
      charByTitle.set(slugify(n.title), n);
    }
  }

  // Sort characters by Level descending, then name
  const sorted = [...characters].sort((a, b) => b.lvl - a.lvl || a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-obsidian-border pb-6">
        <div className="inline-flex items-center space-x-1.5 text-xs text-obsidian-purpleLight font-semibold uppercase tracking-wider mb-1">
          <Users className="w-3.5 h-3.5" />
          <span>Guild of The Void</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Active Characters Roster</h1>
        <p className="text-sm text-obsidian-textMuted mt-1">
          Live character roster synchronized directly with the Guild API.
        </p>
      </div>

      {/* Characters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map(c => {
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

          const avatarUrl = getCharacterAvatar(c.name, localNote);

          return (
            <div
              key={c._id}
              className="p-5 bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder rounded-2xl transition-all shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start space-x-3.5">
                  {/* Character Portrait */}
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={c.name}
                      className="w-14 h-14 rounded-xl object-cover border border-obsidian-border shrink-0 shadow-md bg-obsidian-card"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-obsidian-purpleFaint to-obsidian-card border border-obsidian-border flex items-center justify-center shrink-0 text-obsidian-purpleLight font-bold text-lg font-serif shadow-sm">
                      {c.name.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-bold text-base sm:text-lg text-white truncate">
                        {localNote ? (
                          <Link href={`/notes/${localNote.slug}`} className="hover:text-obsidian-purpleLight transition-colors">
                            {c.name}
                          </Link>
                        ) : (
                          c.name
                        )}
                      </h2>

                      <span className="shrink-0 px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 text-xs font-mono font-semibold">
                        Lvl {c.lvl}
                      </span>
                    </div>

                    <p className="text-xs text-obsidian-textFaint mt-0.5 truncate">
                      Played by <span className="text-obsidian-textMuted font-medium">{c.player}</span>
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

                  {c.rank && c.rank !== 'none' && (
                    <div className="flex items-center justify-between">
                      <span className="text-obsidian-textFaint">Rank:</span>
                      <span className="capitalize font-medium text-obsidian-purpleLight">
                        {c.rank}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-obsidian-textFaint">System:</span>
                    <span className="text-obsidian-textMuted">
                      {c.system === 'PF' ? 'Pathfinder 2e' : 'D&D 2024'}
                    </span>
                  </div>
                </div>
              </div>

              {localNote ? (
                <div className="mt-5 pt-3 border-t border-obsidian-borderSubtle flex items-center justify-between">
                  <Link
                    href={`/notes/${localNote.slug}`}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-obsidian-purpleLight hover:underline"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Read Character Dossier &rarr;</span>
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
                    <span>Create Dossier</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
