import Link from 'next/link';
import {
  BookOpen,
  Shield,
  Coins,
  Users,
  Compass,
  ChevronRight,
  ArrowUpRight,
  FileText,
  Sparkles,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PillarCardProps {
  title: string;
  slug: string;
  category: string;
  icon: React.ReactNode;
  description: string;
  highlights: Array<{ label: string; slug: string }>;
}

function PillarCard({
  title,
  slug,
  category,
  icon,
  description,
  highlights,
}: PillarCardProps) {
  return (
    <div className="p-6 sm:p-7 rounded-2xl bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder/80 transition-all hover:bg-obsidian-card group flex flex-col justify-between space-y-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-xs font-semibold text-obsidian-purpleLight uppercase tracking-wider">
            {icon}
            <span>{category}</span>
          </div>
          <Link
            href={`/notes/${slug}`}
            className="text-xs font-medium text-obsidian-textFaint group-hover:text-obsidian-purpleLight flex items-center space-x-1 transition-colors"
          >
            <span>Open Hub</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="space-y-2">
          <Link href={`/notes/${slug}`} className="block">
            <h2 className="text-xl font-bold text-white group-hover:text-obsidian-purpleLight transition-colors">
              {title}
            </h2>
          </Link>
          <p className="text-sm text-obsidian-textMuted leading-relaxed">
            {description}
          </p>
        </div>

        <div className="pt-2 border-t border-obsidian-border/50">
          <div className="text-[11px] font-semibold text-obsidian-textFaint uppercase tracking-wider mb-2.5">
            Key Topics Inside
          </div>
          <div className="flex flex-wrap gap-1.5">
            {highlights.map(h => (
              <Link
                key={h.slug}
                href={`/notes/${h.slug}`}
                className="inline-flex items-center px-2.5 py-1 rounded-md bg-obsidian-bg border border-obsidian-border text-xs text-zinc-300 hover:text-white hover:border-obsidian-purpleBorder hover:bg-obsidian-purple/20 transition-colors"
              >
                <span>{h.label}</span>
                <ArrowUpRight className="w-2.5 h-2.5 ml-1 text-obsidian-textFaint" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-obsidian-border/40">
        <Link
          href={`/notes/${slug}`}
          className="inline-flex items-center justify-between w-full text-xs font-semibold text-obsidian-purpleLight group-hover:text-white transition-colors"
        >
          <span>Explore Complete Guide</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

interface IndexItem {
  title: string;
  slug: string;
  summary: string;
}

interface IndexSectionProps {
  title: string;
  icon: React.ReactNode;
  items: IndexItem[];
}

function IndexSection({ title, icon, items }: IndexSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 border-b border-obsidian-border pb-2.5">
        {icon}
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">
          {title}
        </h3>
        <span className="text-[11px] font-mono text-obsidian-textFaint ml-auto">
          {items.length} notes
        </span>
      </div>
      <div className="divide-y divide-obsidian-border/40">
        {items.map(item => (
          <Link
            key={item.slug}
            href={`/notes/${item.slug}`}
            className="group py-2.5 px-2 -mx-2 rounded-lg hover:bg-obsidian-surface transition-colors flex items-start justify-between space-x-3"
          >
            <div className="space-y-0.5 min-w-0">
              <div className="text-sm font-medium text-zinc-200 group-hover:text-obsidian-purpleLight transition-colors truncate">
                {item.title}
              </div>
              <p className="text-xs text-obsidian-textFaint line-clamp-1">
                {item.summary}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-obsidian-textFaint group-hover:text-obsidian-purpleLight group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function RulesPage() {
  const onboardingItems: IndexItem[] = [
    { title: 'Getting Started', slug: 'getting-started', summary: '5-step onboarding guide, account setup, and table preparation.' },
    { title: 'Memberships (Kobolds)', slug: 'memberships', summary: '1 free monthly session allowance and €10/year Kobold perks.' },
    { title: 'Campaign Guidelines', slug: 'campaign-guidelines', summary: 'Living world player conduct, safety tools, and table etiquette.' },
    { title: 'Wiki Guidelines', slug: 'guidelines', summary: 'Naming conventions, objective player knowledge perspective, and tags.' },
    { title: 'Formatting on the Wiki', slug: 'formatting', summary: 'Markdown syntax, wikilinks, task lists, LaTeX math, and tables.' },
    { title: 'Using Callouts', slug: 'callouts', summary: 'Standardized colored callout blocks for notes, warnings, and GM quotes.' },
    { title: 'Contributing to the Wiki', slug: 'contributing', summary: 'Web editor instructions, character dossiers, and note permissions.' },
  ];

  const progressionItems: IndexItem[] = [
    { title: 'Ancestry Exemptions', slug: 'ancestryexemptions', summary: 'Approved ancestries & heritages (Beastkin, Anadi, Talos, Catfolk, Skeleton, etc).' },
    { title: 'Other Exemptions', slug: 'other-exemptions', summary: 'All classes allowed, full Guns & Gears approval (firearms, clockwork), and archetypes.' },
    { title: 'Ranks of The Void', slug: 'ranks', summary: 'Apprentice, Journeyman (Lvl 7 exam), and Guildmaster (Lvl 14 exam).' },
    { title: 'Experience Points (XP)', slug: 'xp', summary: 'Session XP awards, leveling curves, and milestone pacing.' },
  ];

  const downtimeItems: IndexItem[] = [
    { title: 'Downtime Activities', slug: 'downtime', summary: 'Pre-session downtime options, retraining, and reputation tasks.' },
    { title: 'Void Objective', slug: 'void-objective', summary: 'Server-wide monthly community objectives and gold reward scaling.' },
    { title: 'Earn Income', slug: 'earnincome', summary: 'PF2e task levels, wage tables, and weekly income calculation.' },
    { title: 'Craft an Item', slug: 'crafting', summary: 'Crafting mechanics, formulas, rush work, and item repair.' },
    { title: 'Learn a Spell', slug: 'learnspell', summary: 'Spellbook expansion costs and study requirements for casters.' },
    { title: 'Treasure & Loot', slug: 'treasure', summary: 'Expedition loot budgets, magic item ratios, and gold distribution.' },
    { title: 'Death & Resurrection', slug: 'death', summary: 'Character death rituals, resurrection costs, and backup characters.' },
  ];

  const gmItems: IndexItem[] = [
    { title: 'Becoming a Voidmaster', slug: 'gming', summary: 'Application steps (contact Jasper), 250 XP reward, and 3-month membership.' },
    { title: 'Voidmaster Guide', slug: 'voidmaster', summary: 'Central GM handbook, session workflows, and quick references.' },
    { title: 'Running a Session Checklist', slug: 'running-a-session', summary: 'Punctuality gold bonus, Hero Points, and post-session Guild wrap-up.' },
    { title: 'Creating a Session', slug: 'creating-a-session', summary: 'Guild session types, level overrides, GM character XP, and Discord alerts.' },
    { title: 'World & Quest Management', slug: 'world-management', summary: 'Configuring worlds on Guild, maps.tarragon.be, and quest balancing.' },
    { title: 'The Void Council', slug: 'void-council', summary: '3-vote exemption approvals, exam appointments, and lore secrecy.' },
    { title: 'Hexploration (Sythian)', slug: 'hexploration-sythian', summary: 'Wilderness turns, scouting terrain, and exploration travel pacing.' },
    { title: 'Session Reports Guide', slug: 'session-reports', summary: 'Guidelines for writing and preserving mission debriefs.' },
  ];

  return (
    <div className="space-y-12 pb-8">
      {/* Header Banner */}
      <section className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 sm:p-10 space-y-4">
        <div className="flex items-center space-x-2 text-xs text-obsidian-purpleLight font-semibold uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          <span>Living World Compendium</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Rules &amp; Compendium
        </h1>
        <p className="text-sm sm:text-base text-obsidian-textMuted max-w-3xl leading-relaxed">
          Navigate the core rule systems, living world guidelines, character progression, downtime activities, and Gamemaster resources in The Void.
        </p>
      </section>

      {/* Primary Gateway Hubs (Uncluttered Click-Through Hubs) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-obsidian-border pb-3">
          <div className="flex items-center space-x-2 text-white font-bold text-lg tracking-tight">
            <Sparkles className="w-4 h-4 text-obsidian-purpleLight" />
            <h2>Core Compendium Hubs</h2>
          </div>
          <span className="text-xs text-obsidian-textMuted">
            Click through to explore interconnected guides
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PillarCard
            title="Getting Started & Guidelines"
            slug="getting-started"
            category="Onboarding"
            icon={<Shield className="w-4 h-4 text-obsidian-purpleLight" />}
            description="Essential 5-step onboarding guide, table etiquette, Discord setup, Kobold memberships, and wiki editing standards."
            highlights={[
              { label: '5-Step Setup', slug: 'getting-started' },
              { label: 'Memberships', slug: 'memberships' },
              { label: 'Campaign Guidelines', slug: 'campaign-guidelines' },
              { label: 'Wiki Guidelines', slug: 'guidelines' },
              { label: 'Formatting', slug: 'formatting' },
            ]}
          />

          <PillarCard
            title="Character Progression & Ranks"
            slug="ranks"
            category="Progression"
            icon={<Users className="w-4 h-4 text-obsidian-purpleLight" />}
            description="Living world leveling curve, XP thresholds, permitted uncommon/rare ancestries, and Journeyman & Guildmaster rank exams."
            highlights={[
              { label: 'Ancestry Exemptions', slug: 'ancestryexemptions' },
              { label: 'Other Exemptions', slug: 'other-exemptions' },
              { label: 'Ranks of The Void', slug: 'ranks' },
              { label: 'Level 7 Exam', slug: 'ranks' },
              { label: 'XP Progression', slug: 'xp' },
            ]}
          />

          <PillarCard
            title="Downtime & Living Economy"
            slug="downtime"
            category="Economy"
            icon={<Coins className="w-4 h-4 text-obsidian-purpleLight" />}
            description="Pre-session downtime activities, Earn Income wage tables, crafting formulas, spell learning, treasure splits, and monthly Void Objectives."
            highlights={[
              { label: 'Downtime Activities', slug: 'downtime' },
              { label: 'Earn Income', slug: 'earnincome' },
              { label: 'Crafting', slug: 'crafting' },
              { label: 'Treasure & Loot', slug: 'treasure' },
              { label: 'Void Objective', slug: 'void-objective' },
            ]}
          />

          <PillarCard
            title="Voidmaster Guide (GM Hub)"
            slug="voidmaster"
            category="Gamemastering"
            icon={<Compass className="w-4 h-4 text-obsidian-purpleLight" />}
            description="The central handbook for Voidmasters: application perks (250 XP & 3-month membership), session setup on Guild, table checklists, and worldbuilding."
            highlights={[
              { label: 'Becoming a GM', slug: 'gming' },
              { label: 'Creating Sessions', slug: 'creating-a-session' },
              { label: 'Session Checklist', slug: 'running-a-session' },
              { label: 'World Management', slug: 'world-management' },
              { label: 'Void Council', slug: 'void-council' },
            ]}
          />
        </div>
      </section>

      {/* Complete Index (Clean Structured Directory at the Bottom) */}
      <section className="bg-obsidian-surface/60 border border-obsidian-border rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-obsidian-border pb-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-obsidian-purpleLight" />
            <h2 className="text-xl font-bold text-white tracking-tight">
              Complete Compendium Index
            </h2>
          </div>
          <span className="text-xs text-obsidian-textFaint">
            Directory of all 25 living world rules and compendium articles
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <IndexSection
            title="Onboarding"
            icon={<Shield className="w-4 h-4 text-obsidian-purpleLight" />}
            items={onboardingItems}
          />
          <IndexSection
            title="Progression"
            icon={<Users className="w-4 h-4 text-obsidian-purpleLight" />}
            items={progressionItems}
          />
          <IndexSection
            title="Downtime"
            icon={<Coins className="w-4 h-4 text-obsidian-purpleLight" />}
            items={downtimeItems}
          />
          <IndexSection
            title="Gamemastering"
            icon={<Compass className="w-4 h-4 text-obsidian-purpleLight" />}
            items={gmItems}
          />
        </div>
      </section>
    </div>
  );
}
