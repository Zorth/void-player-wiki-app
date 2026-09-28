import Link from 'next/link';
import { getAllNotes, getSessionReports, KNOWN_WORLDS, formatInlineMarkdown } from '@/lib/vault';
import { getGuildWorlds, getGuildSessions, getGuildQuests } from '@/lib/guild';
import { getSession } from '@/lib/auth';
import {
  Compass,
  Scroll,
  ScrollText,
  Users,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Dice5,
  UserPlus,
  ShieldCheck,
  FileText,
  Sparkles,
  MessageSquare,
  MapPin,
  Coins,
  Heart,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSession();
  const allNotes = getAllNotes();
  const sessions = getSessionReports(undefined, true).slice(0, 4);
  const guildWorlds = await getGuildWorlds();
  const guildSessions = await getGuildSessions();
  const guildQuests = await getGuildQuests();

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

  const guildWorldMap = new Map(guildWorlds.map(w => [w.name.toLowerCase(), w]));

  // Calculate note counts per world
  const worldStats = KNOWN_WORLDS.map(w => {
    const wLower = w.toLowerCase();
    const count = allNotes.filter(n => n.worlds.some(nw => nw.toLowerCase() === wLower)).length;
    return {
      name: w,
      slug: w.toLowerCase().replace(/\s+/g, '-'),
      noteCount: count,
      hasMap: true,
      mapEmbed: `https://guild.tarragon.be/world/${encodeURIComponent(w)}/map`,
    };
  });

  return (
    <div className="space-y-12">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-obsidian-surface via-obsidian-card to-obsidian-surface border border-obsidian-border p-8 sm:p-12 shadow-2xl">
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center space-x-3">
            <img src="/void_icon_purple.png" alt="The Void" className="w-10 h-10 object-contain rounded-xl shadow-lg shadow-purple-950/40" />
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-obsidian-purpleFaint border border-obsidian-purpleBorder text-xs font-semibold text-obsidian-purpleLight">
              <span>Campaign Knowledge Base</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
            Welcome to The Void Player Wiki
          </h1>
          <p className="text-base sm:text-lg text-obsidian-textMuted leading-relaxed">
            A persistent, shared living world campaign spanning multiple interconnected realms and game masters. Lore evolves with our journeys.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="https://guild.tarragon.be"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-obsidian-purple hover:bg-obsidian-purpleHover text-white rounded-lg text-sm font-semibold shadow-md transition-colors"
            >
              <span>Guild Portal (Sessions &amp; Characters)</span>
              <ExternalLink className="w-4 h-4 ml-0.5" />
            </a>
            <Link
              href="/sessions"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border text-obsidian-text rounded-lg text-sm font-semibold transition-colors"
            >
              <ScrollText className="w-4 h-4" />
              <span>Read Session Reports</span>
            </Link>
            <Link
              href="/characters"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border text-obsidian-text rounded-lg text-sm font-semibold transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>Characters Roster</span>
            </Link>
            <Link
              href="/worlds"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border text-obsidian-text rounded-lg text-sm font-semibold transition-colors"
            >
              <Compass className="w-4 h-4" />
              <span>Campaign Worlds</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Getting Started Feature Section (Only shown when not logged in) */}
      {!session && (
        <section className="rounded-2xl border border-obsidian-purpleBorder/40 bg-gradient-to-b from-purple-950/20 via-obsidian-surface to-obsidian-surface p-6 sm:p-8 space-y-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-obsidian-borderSubtle pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/50 text-[11px] font-bold uppercase tracking-wider">
              <span>New Player Onboarding</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">How to Join The Void &amp; Start Playing</h2>
            <p className="text-sm text-obsidian-textMuted max-w-2xl leading-relaxed">
              New to our living world? This wiki is our lore and rules compendium. Character management and session signups happen on our campaign portal at <a href="https://guild.tarragon.be" target="_blank" rel="noopener noreferrer" className="text-obsidian-purpleLight hover:underline font-semibold">guild.tarragon.be</a>. Follow these 5 steps to get started:
            </p>
          </div>
          <Link
            href="/notes/getting-started"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-obsidian-purple hover:bg-obsidian-purpleHover text-white text-xs font-semibold self-start sm:self-auto transition-colors shrink-0 shadow"
          >
            <span>Full Getting Started Guide</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 5-Step Pathway */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs uppercase font-bold tracking-wider text-obsidian-textFaint">The 5 Steps to Play</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {/* Step 1 */}
            <div className="p-4 rounded-xl bg-obsidian-card/90 border border-obsidian-border flex flex-col justify-between space-y-3 hover:border-obsidian-purpleBorder/60 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-obsidian-purpleLight font-bold">
                  <span>STEP 1</span>
                  <UserPlus className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-white text-sm">Create an Account</h4>
                <p className="text-xs text-obsidian-textMuted leading-relaxed">
                  Sign up on{' '}
                  <a href="https://guild.tarragon.be" target="_blank" rel="noopener noreferrer" className="text-obsidian-purpleLight hover:underline font-medium">
                    guild.tarragon.be
                  </a>{' '}
                  using email, Discord, or Google.
                </p>
                <div className="pt-1">
                  <a
                    href="https://guild.tarragon.be"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-purple-900/40 hover:bg-purple-900/60 border border-purple-700/50 text-[11px] font-semibold text-purple-200 transition-colors"
                  >
                    <span>Open Guild Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="pt-2 border-t border-obsidian-borderSubtle text-[11px] text-obsidian-textFaint leading-snug">
                Accounts are shared between Guild and Tarragon. Linking Discord automatically pings you for session updates.
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl bg-obsidian-card/90 border border-obsidian-border flex flex-col justify-between space-y-3 hover:border-obsidian-purpleBorder/60 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-obsidian-purpleLight font-bold">
                  <span>STEP 2</span>
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-white text-sm">New Character</h4>
                <p className="text-xs text-obsidian-textMuted leading-relaxed">
                  Click <strong>New Character</strong> on Guild. Fill in your character name, ancestry, and class.
                </p>
              </div>
              <div className="pt-2 border-t border-obsidian-borderSubtle text-[11px] text-obsidian-textFaint leading-snug">
                Placeholders are fine if you haven't decided yet! You can always ask us for guidance on Discord.
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl bg-obsidian-card/90 border border-obsidian-border flex flex-col justify-between space-y-3 hover:border-obsidian-purpleBorder/60 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-obsidian-purpleLight font-bold">
                  <span>STEP 3</span>
                  <Calendar className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-white text-sm">Select &amp; Join Session</h4>
                <p className="text-xs text-obsidian-textMuted leading-relaxed">
                  Browse the session list on Guild for the day you want to play.
                </p>
              </div>
              <div className="pt-2 border-t border-obsidian-borderSubtle text-[11px] text-obsidian-textFaint leading-snug">
                Check the start time and physical location/table, select your character, and click Join.
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-xl bg-obsidian-card/90 border border-obsidian-border flex flex-col justify-between space-y-3 hover:border-obsidian-purpleBorder/60 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-obsidian-purpleLight font-bold">
                  <span>STEP 4</span>
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-white text-sm">Join Discord Thread</h4>
                <p className="text-xs text-obsidian-textMuted leading-relaxed">
                  Head into our{' '}
                  <a href="https://discord.com/channels/878674783972261918/1322273585032724510" target="_blank" rel="noopener noreferrer" className="text-obsidian-purpleLight hover:underline font-medium">
                    Discord server (#ouroboros_inn)
                  </a>{' '}
                  and open your session's dedicated thread.
                </p>
              </div>
              <div className="pt-2 border-t border-obsidian-borderSubtle text-[11px] text-obsidian-textFaint leading-snug">
                Discuss party tactics, organize carpools/rides to the venue, organize dinner, and plan loot.
              </div>
            </div>

            {/* Step 5 */}
            <div className="p-4 rounded-xl bg-obsidian-card/90 border border-obsidian-border flex flex-col justify-between space-y-3 hover:border-obsidian-purpleBorder/60 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-obsidian-purpleLight font-bold">
                  <span>STEP 5</span>
                  <MapPin className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-white text-sm">Show Up &amp; Play</h4>
                <p className="text-xs text-obsidian-textMuted leading-relaxed">
                  Arrive at the physical session venue on time and ready for adventure.
                </p>
              </div>
              <div className="pt-2 border-t border-obsidian-borderSubtle text-[11px] text-obsidian-textFaint leading-snug">
                Bring your dice, character sheet, and enthusiasm. We'll handle the rest at the table!
              </div>
            </div>
          </div>
        </div>

        {/* Free Sessions & Kobold Membership Highlight */}
        <div className="p-5 sm:p-6 rounded-xl bg-gradient-to-r from-purple-950/40 via-obsidian-card to-purple-950/20 border border-purple-800/40 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                Free to Start
              </span>
              <span className="text-xs font-semibold text-obsidian-textMuted">1 Session Per Month Free for Everyone</span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-white">
              Everyone can play 1 session per month for free!
            </h4>
            <p className="text-xs sm:text-sm text-obsidian-textMuted leading-relaxed">
              Want to join more sessions? Become a <strong className="text-white">Kobold</strong>—the official community membership from Tarragon. Memberships can be purchased on your account at{' '}
              <a href="https://tarragon.be" target="_blank" rel="noopener noreferrer" className="text-obsidian-purpleLight hover:underline font-medium">
                tarragon.be
              </a>{' '}
              for <strong>10 euro per year</strong>. Your support directly sustains our physical tables, venue, and campaign resources, and is greatly appreciated!
            </p>
          </div>
          <a
            href="https://tarragon.be"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors shrink-0"
          >
            <span>Become a Kobold (10 EUR/yr)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Character Creation Rules Quick Reference */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-bold tracking-wider text-obsidian-textFaint">
              Character Creation Rules by System
            </h3>
            <span className="text-xs text-obsidian-textFaint">Both systems share the same living multiverse</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PF2e Box */}
            <div className="p-4 rounded-xl bg-obsidian-card/80 border border-obsidian-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-obsidian-purpleLight uppercase tracking-wider">Pathfinder 2e Remastered</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-obsidian-surface text-obsidian-textMuted border border-obsidian-border font-medium">Level 1 Start</span>
              </div>
              <ul className="text-xs text-obsidian-textMuted space-y-1.5 list-disc list-inside">
                <li><strong className="text-white">Ruleset:</strong> PF2e Remastered (no outdated CRB/APG legacy or Battlezoo; no legacy flaws).</li>
                <li><strong className="text-white">Rarities:</strong> Common choices only (Uncommon/Rare require GM approval).</li>
                <li><strong className="text-white">Ancestries:</strong> See pre-approved exemptions in the guide.</li>
                <li><strong className="text-white">Tools:</strong> Build with <a href="https://pathbuilder2e.com" target="_blank" rel="noopener noreferrer" className="text-obsidian-purpleLight hover:underline">PathBuilder 2e</a>.</li>
              </ul>
              <div className="pt-2 border-t border-obsidian-borderSubtle flex items-center space-x-3 text-xs">
                <Link href="/notes/ancestryexemptions" className="text-obsidian-purpleLight hover:underline font-medium">
                  Ancestry Exemptions
                </Link>
                <span className="text-obsidian-border">&bull;</span>
                <Link href="/notes/xp" className="text-obsidian-purpleLight hover:underline font-medium">
                  XP Progression
                </Link>
              </div>
            </div>

            {/* D&D 2024 Box */}
            <div className="p-4 rounded-xl bg-obsidian-card/80 border border-obsidian-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-obsidian-purpleLight uppercase tracking-wider">Dungeons &amp; Dragons 2024</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-obsidian-surface text-obsidian-textMuted border border-obsidian-border font-medium">Level 3 Start</span>
              </div>
              <ul className="text-xs text-obsidian-textMuted space-y-1.5 list-disc list-inside">
                <li><strong className="text-white">Ruleset:</strong> Updated 2024 core rules (2014 content allowed with 2024 spells, feats &amp; masteries).</li>
                <li><strong className="text-white">Ability Scores:</strong> Point Buy (+2/+1 or +1/+1/+1 regardless of species/background).</li>
                <li><strong className="text-white">Bonus Feat:</strong> 1 free feat at character creation (excluding ASI feats).</li>
                <li><strong className="text-white">Tools:</strong> Ask a Voidmaster for a D&amp;D Beyond campaign invite.</li>
              </ul>
              <div className="pt-2 border-t border-obsidian-borderSubtle flex items-center space-x-3 text-xs">
                <Link href="/notes/xp" className="text-obsidian-purpleLight hover:underline font-medium">
                  XP Progression
                </Link>
                <span className="text-obsidian-border">&bull;</span>
                <Link href="/notes/treasure" className="text-obsidian-purpleLight hover:underline font-medium">
                  Treasure &amp; Equipment
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Rule Guides Badges */}
        <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-obsidian-textFaint font-semibold uppercase tracking-wider text-[11px] mr-1">Key Rules:</span>
          <Link href="/notes/getting-started" className="px-3 py-1.5 rounded-lg bg-obsidian-surface hover:bg-obsidian-card border border-obsidian-border text-obsidian-textMuted hover:text-white transition-colors">
            Getting Started
          </Link>
          <Link href="/notes/ancestryexemptions" className="px-3 py-1.5 rounded-lg bg-obsidian-surface hover:bg-obsidian-card border border-obsidian-border text-obsidian-textMuted hover:text-white transition-colors">
            Ancestry Exemptions
          </Link>
          <Link href="/notes/guidelines" className="px-3 py-1.5 rounded-lg bg-obsidian-surface hover:bg-obsidian-card border border-obsidian-border text-obsidian-textMuted hover:text-white transition-colors">
            Wiki Guidelines
          </Link>
          <Link href="/notes/campaign-guidelines" className="px-3 py-1.5 rounded-lg bg-obsidian-surface hover:bg-obsidian-card border border-obsidian-border text-obsidian-textMuted hover:text-white transition-colors">
            Campaign Guidelines
          </Link>
          <Link href="/notes/session-reports" className="px-3 py-1.5 rounded-lg bg-obsidian-surface hover:bg-obsidian-card border border-obsidian-border text-obsidian-textMuted hover:text-white transition-colors">
            Session Report Rules
          </Link>
          <Link href="/notes/xp" className="px-3 py-1.5 rounded-lg bg-obsidian-surface hover:bg-obsidian-card border border-obsidian-border text-obsidian-textMuted hover:text-white transition-colors">
            XP Progression
          </Link>
          <Link href="/notes/treasure" className="px-3 py-1.5 rounded-lg bg-obsidian-surface hover:bg-obsidian-card border border-obsidian-border text-obsidian-textMuted hover:text-white transition-colors">
            Treasure &amp; Loot
          </Link>
          <a href="https://guild.tarragon.be" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-obsidian-surface hover:bg-obsidian-card border border-obsidian-border text-obsidian-purpleLight hover:text-white transition-colors inline-flex items-center space-x-1">
            <span>Guild Portal</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
          <a href="https://tarragon.be" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-obsidian-surface hover:bg-obsidian-card border border-obsidian-border text-emerald-400 hover:text-white transition-colors inline-flex items-center space-x-1">
            <span>Tarragon Membership</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      </section>
      )}

      {/* Campaign Worlds Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Campaign Worlds</h2>
            <p className="text-xs text-obsidian-textFaint">Filter notes, settlements, lore, and sessions by world.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {worldStats.map(w => (
            <Link
              key={w.name}
              href={`/worlds/${w.slug}`}
              className="group p-5 rounded-xl bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder hover:bg-obsidian-card transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-obsidian-card border border-obsidian-border flex items-center justify-center text-obsidian-purpleLight group-hover:scale-105 transition-transform">
                    <Compass className="w-4 h-4" />
                  </div>
                  {w.hasMap && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                      Interactive Map
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-lg text-white group-hover:text-obsidian-purpleLight transition-colors">
                  {w.name}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-obsidian-borderSubtle flex items-center justify-between text-xs text-obsidian-textMuted">
                <span>{w.noteCount} Notes</span>
                <ArrowRight className="w-3.5 h-3.5 text-obsidian-textFaint group-hover:text-obsidian-purpleLight group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Sessions Feed */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Recent Session Reports</h2>
            <p className="text-xs text-obsidian-textFaint">Chronological log of campaign adventures.</p>
          </div>
          <Link href="/sessions" className="text-xs font-semibold text-obsidian-purpleLight hover:underline flex items-center space-x-1">
            <span>View All ({allNotes.filter(n => n.category === 'session-report').length})</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map(s => (
            <Link
              key={s.slug}
              href={`/notes/${s.slug}`}
              className="p-5 rounded-xl bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder hover:bg-obsidian-card transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 text-xs text-obsidian-textFaint">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{s.date || 'Unknown Date'}</span>
                  </div>
                  {s.worlds.map(w => (
                    <span key={w} className="text-[11px] px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40">
                      {w}
                    </span>
                  ))}
                </div>

                <h3 className="font-semibold text-base text-white hover:text-obsidian-purpleLight transition-colors line-clamp-1">
                  {s.title}
                </h3>

                {s.date && questBySessionDate.has(s.date) && (
                  <div className="mt-1 flex items-center space-x-1.5 text-xs text-emerald-300 font-medium">
                    <Scroll className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{questBySessionDate.get(s.date)}</span>
                  </div>
                )}

                {s.abstract && (
                  <div
                    className="mt-2 text-xs text-obsidian-textMuted line-clamp-2 leading-relaxed [&_a]:text-obsidian-purpleLight [&_a]:hover:underline [&_strong]:text-zinc-200"
                    dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(s.abstract) }}
                  />
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-obsidian-borderSubtle flex items-center justify-between text-xs text-obsidian-textFaint">
                <span>{s.authors.length > 0 ? `By ${s.authors.join(', ')}` : 'Campaign Log'}</span>
                <span className="text-obsidian-purpleLight font-medium">Read Report &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
