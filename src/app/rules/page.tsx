import Link from 'next/link';
import {
  BookOpen,
  Shield,
  Coins,
  Users,
  Compass,
  ChevronRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface RuleCardProps {
  title: string;
  slug: string;
  description: string;
}

function RuleCard({ title, slug, description }: RuleCardProps) {
  return (
    <Link
      href={`/notes/${slug}`}
      className="p-5 rounded-xl bg-obsidian-surface border border-obsidian-border hover:border-obsidian-purpleBorder transition-all hover:bg-obsidian-card group flex flex-col justify-between"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white group-hover:text-obsidian-purpleLight transition-colors">
            {title}
          </h3>
          <ChevronRight className="w-4 h-4 text-obsidian-textFaint group-hover:text-obsidian-purpleLight group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
        <p className="text-xs text-obsidian-textMuted leading-relaxed">
          {description}
        </p>
      </div>
      <div className="pt-3 text-[11px] text-obsidian-purpleLight font-medium">
        <span>Read Guide</span>
      </div>
    </Link>
  );
}

export default async function RulesPage() {
  return (
    <div className="space-y-12">
      {/* Header Banner */}
      <section className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 sm:p-10 space-y-4">
        <div className="flex items-center space-x-2 text-xs text-obsidian-purpleLight font-semibold uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          <span>Living World Compendium</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Rules
        </h1>
        <p className="text-sm sm:text-base text-obsidian-textMuted max-w-3xl leading-relaxed">
          Comprehensive reference for Pathfinder 2e campaign guidelines, house rules, downtime mechanics, ancestry exemptions, and player guidelines in The Void.
        </p>
      </section>

      {/* Section 1: Onboarding & Community */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 border-b border-obsidian-border pb-3">
          <Shield className="w-4 h-4 text-obsidian-purpleLight" />
          <h2 className="text-lg font-bold text-white tracking-tight">Onboarding &amp; Guidelines</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RuleCard
            title="Getting Started"
            slug="getting-started"
            description="5-step guide to register on Guild, join Discord, create your character, and join your first session."
          />
          <RuleCard
            title="Memberships (Kobolds by Tarragon)"
            slug="memberships"
            description="Free monthly session policy (1 per calendar month), €10/year Kobold membership, and Voidmaster perks."
          />
          <RuleCard
            title="Campaign Guidelines"
            slug="campaign-guidelines"
            description="Living world expectations, code of conduct, player courtesy, and table etiquette."
          />
          <RuleCard
            title="Wiki Guidelines"
            slug="guidelines"
            description="Formatting conventions, tagging rules, and note hierarchy for writing on this wiki."
          />
          <RuleCard
            title="Contributing to the Wiki"
            slug="contributing"
            description="How to record your character's adventures, create NPC profiles, and document discoveries."
          />
        </div>
      </section>

      {/* Section 2: Character Creation & Progression */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 border-b border-obsidian-border pb-3">
          <Users className="w-4 h-4 text-obsidian-purpleLight" />
          <h2 className="text-lg font-bold text-white tracking-tight">Character Creation &amp; Progression</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RuleCard
            title="Ancestry &amp; Heritage Exemptions"
            slug="ancestryexemptions"
            description="Permitted uncommon and rare ancestries & heritages (Automaton, Conrasu, Goloma, Kashrishi, Poppet, Skeleton, Shisk, Anadi, Talos)."
          />
          <RuleCard
            title="Ranks of The Void"
            slug="ranks"
            description="Guild hierarchy progression from Recruit to Master, including unlocked privileges and responsibilities."
          />
          <RuleCard
            title="Experience Points (XP)"
            slug="xp"
            description="Living world leveling curve, XP thresholds, milestone pacing, and session attendance rewards."
          />
        </div>
      </section>

      {/* Section 3: Downtime & Economy */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 border-b border-obsidian-border pb-3">
          <Coins className="w-4 h-4 text-obsidian-purpleLight" />
          <h2 className="text-lg font-bold text-white tracking-tight">Downtime &amp; Economy</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RuleCard
            title="Downtime Activities"
            slug="downtime"
            description="Pre-session downtime activities: Earn Income, Crafting, Retraining feats, Reputation tasks, and Research."
          />
          <RuleCard
            title="Void Objective"
            slug="void-objective"
            description="Server-wide monthly goals, progression tiers, and scaling gold payouts based on community completion."
          />
          <RuleCard
            title="Earn Income"
            slug="earnincome"
            description="Pathfinder 2e Earn Income rules, task level caps by settlement, and weekly payout calculations."
          />
          <RuleCard
            title="Craft an Item"
            slug="crafting"
            description="Item crafting mechanics, formula requirements, rush work, and downtime crafting progress."
          />
          <RuleCard
            title="Learn a Spell"
            slug="learnspell"
            description="Spellbook expansion rules and material costs for wizards, magi, and other prepared spellcasters."
          />
          <RuleCard
            title="Treasure &amp; Loot"
            slug="treasure"
            description="Distributing expedition rewards, party gold splits, selling found gear, and guild tax."
          />
          <RuleCard
            title="Death &amp; Resurrection"
            slug="death"
            description="Character death protocols, resurrection costs and rituals, and creating replacement characters."
          />
        </div>
      </section>

      {/* Section 4: Gamemastering & Exploration */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 border-b border-obsidian-border pb-3">
          <Compass className="w-4 h-4 text-obsidian-purpleLight" />
          <h2 className="text-lg font-bold text-white tracking-tight">Gamemastering &amp; Exploration</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RuleCard
            title="Voidmaster Guide"
            slug="voidmaster"
            description="Complete GM guide: world setup on Guild, session types, GM XP, checklists, Void Council, and maps."
          />
          <RuleCard
            title="Hexploration (Sythian)"
            slug="hexploration-sythian"
            description="Wilderness exploration turns, travel speeds, scouting terrain, and environment survival rules."
          />
          <RuleCard
            title="Session Reports Guide"
            slug="session-reports"
            description="Standard practices for writing and preserving mission debriefs and adventure logs."
          />
        </div>
      </section>
    </div>
  );
}
