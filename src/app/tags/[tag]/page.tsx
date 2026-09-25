import Link from 'next/link';
import { getNotesByTag, getAllNotes } from '@/lib/vault';
import { Tag, Compass, Calendar, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function TagPage({ params }: { params: { tag: string } }) {
  const rawTag = decodeURIComponent(params?.tag || '').toLowerCase();
  const notes = getNotesByTag(rawTag);

  // Get all unique tags across vault
  const allNotes = getAllNotes();
  const allTags = new Set<string>();
  allNotes.forEach(n => n.tags.forEach(t => allTags.add(t)));
  const sortedTags = Array.from(allTags).sort();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-obsidian-border pb-6">
        <div className="inline-flex items-center space-x-1.5 text-xs text-obsidian-purpleLight font-semibold uppercase tracking-wider mb-1">
          <Tag className="w-3.5 h-3.5" />
          <span>Tag Explorer</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          #{rawTag} <span className="text-obsidian-textFaint font-normal text-xl">({notes.length} Notes)</span>
        </h1>
      </div>

      {/* Tag Cloud */}
      <div className="flex flex-wrap gap-1.5 p-4 bg-obsidian-surface border border-obsidian-border rounded-xl">
        {sortedTags.map(t => {
          const isActive = t === rawTag;
          return (
            <Link
              key={t}
              href={`/tags/${encodeURIComponent(t)}`}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                isActive
                  ? 'bg-obsidian-purple text-white shadow-sm font-semibold'
                  : 'bg-obsidian-card text-obsidian-textMuted hover:text-white hover:bg-obsidian-hover'
              }`}
            >
              #{t}
            </Link>
          );
        })}
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.length === 0 ? (
          <p className="text-sm text-obsidian-textFaint">No notes found for #{rawTag}.</p>
        ) : (
          notes.map(n => (
            <Link
              key={n.slug}
              href={`/notes/${n.slug}`}
              className="p-5 rounded-xl bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder hover:bg-obsidian-card transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center space-x-2 text-xs text-obsidian-purpleLight mb-1.5">
                  {n.worlds.map(w => (
                    <span key={w} className="inline-flex items-center">
                      <Compass className="w-3 h-3 mr-1" />
                      {w}
                    </span>
                  ))}
                  {n.date && (
                    <span className="text-obsidian-textFaint font-mono">
                      &middot; {n.date}
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-base text-white hover:text-obsidian-purpleLight transition-colors">
                  {n.title}
                </h3>

                {n.abstract && (
                  <p className="text-xs text-obsidian-textMuted mt-1.5 line-clamp-2">
                    {n.abstract}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-obsidian-borderSubtle flex items-center justify-between text-[11px] text-obsidian-textFaint">
                <span>{n.authors.length > 0 ? `By ${n.authors.join(', ')}` : 'Lore Article'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-obsidian-purpleLight" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
