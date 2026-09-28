export interface GuildWorld {
  _id: string;
  name: string;
  description?: string;
  factions?: string[];
  factionGroups?: Array<{ name: string; factions: string[] }>;
  mapEmbed?: string;
  reputationVisible?: boolean;
}

export interface GuildCharacter {
  _id: string;
  name: string;
  player: string;
  lvl: number;
  class: string;
  ancestry: string;
  rank?: string;
  system: string;
  title?: string | null;
  userId?: string;
  xp?: number;
}

export interface GuildSession {
  _id: string;
  date: number; // unix ms
  world?: string; // world id or name
  characters?: string[];
  gmCharacter?: string;
  discordThreadId?: string;
  location?: string;
  loot?: Array<{ name?: string; valueGP?: number; isGood?: boolean }>;
  xpGains?: Array<{ characterId: string; oldLvl: number; xpGained: number }>;
  system?: string;
  questId?: string;
}

export interface GuildQuest {
  _id: string;
  name: string;
  description?: string;
  questgiver?: string;
  reward?: string;
  level?: number;
  tags?: string[];
  isCompleted?: boolean;
  completedAt?: number;
  completedSessionId?: string;
  worldId?: string;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cachedWorlds: { data: GuildWorld[]; time: number } | null = null;
let cachedCharacters: { data: GuildCharacter[]; time: number } | null = null;
let cachedSessions: { data: GuildSession[]; time: number } | null = null;
let cachedQuests: { data: GuildQuest[]; time: number } | null = null;

const GUILD_BASE = 'https://guild.tarragon.be/api/external/v1';

export async function getGuildWorlds(): Promise<GuildWorld[]> {
  const now = Date.now();
  if (cachedWorlds && now - cachedWorlds.time < CACHE_TTL) {
    return cachedWorlds.data;
  }
  try {
    const res = await fetch(`${GUILD_BASE}/worlds`, {
      headers: { 'User-Agent': 'Thor-Void-Wiki/1.0' },
      next: { revalidate: 300 }
    });
    if (res.ok) {
      const data = await res.json();
      cachedWorlds = { data, time: now };
      return data;
    }
  } catch (e) {
    console.error('Failed to fetch guild worlds:', e);
  }
  return cachedWorlds?.data || [];
}

export async function getGuildCharacters(): Promise<GuildCharacter[]> {
  const now = Date.now();
  if (cachedCharacters && now - cachedCharacters.time < CACHE_TTL) {
    return cachedCharacters.data;
  }
  try {
    const res = await fetch(`${GUILD_BASE}/characters`, {
      headers: { 'User-Agent': 'Thor-Void-Wiki/1.0' },
      next: { revalidate: 300 }
    });
    if (res.ok) {
      const data = await res.json();
      cachedCharacters = { data, time: now };
      return data;
    }
  } catch (e) {
    console.error('Failed to fetch guild characters:', e);
  }
  return cachedCharacters?.data || [];
}

export async function getGuildSessions(): Promise<GuildSession[]> {
  const now = Date.now();
  if (cachedSessions && now - cachedSessions.time < CACHE_TTL) {
    return cachedSessions.data;
  }
  try {
    const res = await fetch(`${GUILD_BASE}/sessions?past=true`, {
      headers: { 'User-Agent': 'Thor-Void-Wiki/1.0' },
      next: { revalidate: 300 }
    });
    if (res.ok) {
      const data = await res.json();
      cachedSessions = { data, time: now };
      return data;
    }
  } catch (e) {
    console.error('Failed to fetch guild sessions:', e);
  }
  return cachedSessions?.data || [];
}

export async function getGuildQuests(): Promise<GuildQuest[]> {
  const now = Date.now();
  if (cachedQuests && now - cachedQuests.time < CACHE_TTL) {
    return cachedQuests.data;
  }
  try {
    const res = await fetch(`${GUILD_BASE}/quests`, {
      headers: { 'User-Agent': 'Thor-Void-Wiki/1.0' },
      next: { revalidate: 300 }
    });
    if (res.ok) {
      const data = await res.json();
      cachedQuests = { data, time: now };
      return data;
    }
  } catch (e) {
    console.error('Failed to fetch guild quests:', e);
  }
  return cachedQuests?.data || [];
}

