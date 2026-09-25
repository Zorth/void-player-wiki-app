import Link from 'next/link';
import { getAllNotes, KNOWN_WORLDS } from '@/lib/vault';
import { getGuildWorlds } from '@/lib/guild';
import { Compass, ExternalLink, MapPin, BookOpen, ScrollText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function WorldsHubPage() {
  const allNotes = getAllNotes();
  const guildWorlds = await getGuildWorlds();
  const guildWorldMap = new Map(guildWorlds.map(w => [w.name.toLowerCase(), w]));

  const worldCards = KNOWN_WORLDS.map(w => {
    const wLower = w.toLowerCase();
    const count = allNotes.filter(n => n.worlds.some(nw => nw.toLowerCase() === wLower)).length;
    const gWorld = guildWorldMap.get(wLower);
    const mapEmbed = `https://guild.tarragon.be/world/${encodeURIComponent(w)}/map`;

    // Strip emojis from description if any
    const cleanDesc = gWorld?.description
      ? gWorld.description.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}]/gu, '').slice(0, 160) + '...'
      : `Explore the lore, factions, settlements, and expeditions recorded across ${w}.`;

    return {
      name: w,
      slug: w.toLowerCase().replace(/\s+/g, '-'),
      noteCount: count,
      mapEmbed,
      description: cleanDesc,
    };
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 sm:p-10 space-y-3">
        <div className="flex items-center space-x-2 text-xs text-obsidian-purpleLight font-semibold uppercase tracking-wider">
          <Compass className="w-4 h-4" />
          <span>Multiverse Atlas</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Campaign Worlds
        </h1>
        <p className="text-sm sm:text-base text-obsidian-textMuted max-w-3xl leading-relaxed">
          The Void spans distinct interconnected realms, each with unique cultures, dangers, geography, and active expeditions.
        </p>
      </section>

      {/* Worlds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {worldCards.map(world => (
          <div
            key={world.name}
            className="flex flex-col justify-between rounded-2xl border border-obsidian-border bg-obsidian-surface hover:border-obsidian-purpleBorder transition-all p-6 space-y-5 shadow-sm group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Link href={`/worlds/${world.slug}`}>
                  <h2 className="text-xl font-bold text-white group-hover:text-obsidian-purpleLight transition-colors">
                    {world.name}
                  </h2>
                </Link>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40">
                  {world.noteCount} {world.noteCount === 1 ? 'Note' : 'Notes'}
                </span>
              </div>
              <p className="text-xs text-obsidian-textMuted leading-relaxed">
                {world.description}
              </p>
            </div>

            <div className="pt-4 border-t border-obsidian-borderSubtle flex items-center justify-between gap-3">
              <Link
                href={`/worlds/${world.slug}`}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border text-white rounded-lg text-xs font-medium transition-colors"
              >
                <span>World Notes</span>
              </Link>
              <a
                href={world.mapEmbed}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40 rounded-lg text-xs font-medium transition-colors"
              >
                <span>Interactive Map</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
