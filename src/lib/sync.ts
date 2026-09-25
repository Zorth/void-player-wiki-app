import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const GUILD_BASE = 'https://guild.tarragon.be/api/external/v1';

export interface SyncResult {
  success: boolean;
  sessionsLinked: number;
  sessionsCreated: number;
  charactersLinked: number;
  charactersCreated: number;
  timestamp: string;
  error?: string;
}

function getSyncInfoFilePath(): string {
  const dbPath = process.env.DB_PATH;
  if (dbPath) {
    return path.join(path.dirname(dbPath), 'last-sync.json');
  }
  return path.join('/tmp', 'last-sync.json');
}

export function getLastSyncInfo(): SyncResult | null {
  try {
    const file = getSyncInfoFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {}
  return null;
}

export async function runGuildSync(): Promise<SyncResult> {
  const VAULT_PATH = process.env.VAULT_PATH || '/mnt/whale/07_NOTES_WORKING/void_player_wiki';

  try {
    const [worldsRes, charsRes, sessionsRes] = await Promise.all([
      fetch(`${GUILD_BASE}/worlds`, {
        headers: { 'User-Agent': 'Thor-Void-Wiki/1.0' },
        cache: 'no-store',
      }),
      fetch(`${GUILD_BASE}/characters`, {
        headers: { 'User-Agent': 'Thor-Void-Wiki/1.0' },
        cache: 'no-store',
      }),
      fetch(`${GUILD_BASE}/sessions?past=true`, {
        headers: { 'User-Agent': 'Thor-Void-Wiki/1.0' },
        cache: 'no-store',
      }),
    ]);

    if (!worldsRes.ok || !charsRes.ok || !sessionsRes.ok) {
      throw new Error(`Guild API fetch failed (${worldsRes.status}, ${charsRes.status}, ${sessionsRes.status})`);
    }

    const [worlds, characters, sessions] = await Promise.all([
      worldsRes.json(),
      charsRes.json(),
      sessionsRes.json(),
    ]);

    const worldMap = new Map<string, string>(worlds.map((w: any) => [w._id, w.name]));
    const charMap = new Map<string, any>(characters.map((c: any) => [c._id, c]));

    // 1. SYNC SESSIONS
    const sessionDir = path.join(VAULT_PATH, 'Session Reports');
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    const sessionFiles = fs.readdirSync(sessionDir).filter(f => f.endsWith('.md'));

    let sessionsLinked = 0;
    let sessionsCreated = 0;

    for (const s of sessions) {
      const d = new Date(s.date).toISOString().split('T')[0];
      const w = worldMap.get(s.world) || 'Unknown';
      const charNames = (s.characters || []).map((cid: string) => charMap.get(cid)?.name).filter(Boolean);

      const existingFile = sessionFiles.find(f => f.includes(d));
      if (existingFile) {
        const fullPath = path.join(sessionDir, existingFile);
        const parsed = matter(fs.readFileSync(fullPath, 'utf8'));
        const data = { ...parsed.data };
        data.guildSessionId = s._id;
        data.system = s.system || data.system || 'DnD';
        data.date = d;
        data.worlds = Array.from(new Set([...(Array.isArray(data.worlds) ? data.worlds : []), w]));
        data.tags = Array.from(new Set([...(Array.isArray(data.tags) ? data.tags : []), 'session']));
        fs.writeFileSync(fullPath, matter.stringify(parsed.content, data), 'utf8');
        try {
          fs.chownSync(fullPath, 1000, 1000);
          fs.chmodSync(fullPath, 0o775);
        } catch {}
        sessionsLinked++;
      } else {
        const fileName = `${d} ${w}.md`;
        const fullPath = path.join(sessionDir, fileName);
        const data = {
          title: `Session ${d} ${w}`,
          draft: false,
          date: d,
          guildSessionId: s._id,
          system: s.system || 'DnD',
          worlds: [w],
          tags: ['session'],
        };

        const body = `# Session ${d} ${w}\n\n` +
          `> [!abstract]\n` +
          `> \n\n` +
          `## [[pc|Player Character]]s\n` +
          charNames.map((cn: string) => `- [[${cn}]]`).join('\n') + `\n\n` +
          `## Notes\n` +
          `- \n`;

        fs.writeFileSync(fullPath, matter.stringify(body, data), 'utf8');
        try {
          fs.chownSync(fullPath, 1000, 1000);
          fs.chmodSync(fullPath, 0o775);
        } catch {}
        sessionsCreated++;
      }
    }

    // 2. SYNC CHARACTERS
    const charDir = path.join(VAULT_PATH, 'Player Characters');
    if (!fs.existsSync(charDir)) fs.mkdirSync(charDir, { recursive: true });
    const charFiles = fs.readdirSync(charDir).filter(f => f.endsWith('.md'));

    let charactersLinked = 0;
    let charactersCreated = 0;

    for (const c of characters) {
      const rawName = (c.name || '').trim();
      if (!rawName) continue;
      const safeName = rawName.replace(/[\\/:*?"<>|]/g, '');
      const rank = c.rank && c.rank !== 'none' ? c.rank.toLowerCase() : 'apprentice';

      const existingFile = charFiles.find(f => {
        const base = f.replace(/\.md$/, '').toLowerCase();
        const nLow = rawName.toLowerCase();
        return base === nLow || base.startsWith(nLow) || nLow.startsWith(base);
      });

      if (existingFile) {
        const fullPath = path.join(charDir, existingFile);
        const parsed = matter(fs.readFileSync(fullPath, 'utf8'));
        const data = { ...parsed.data };
        data.guildCharacterId = c._id;
        data.player = c.player;
        data.class = c.class;
        data.ancestry = c.ancestry;
        data.system = c.system;
        data.level = c.lvl;
        data.rank = rank;
        data.xp = c.xp || 0;
        data.tags = Array.from(new Set([
          ...(Array.isArray(data.tags) ? data.tags : []),
          'pc',
          `pc/${rank}`
        ]));
        fs.writeFileSync(fullPath, matter.stringify(parsed.content, data), 'utf8');
        try {
          fs.chownSync(fullPath, 1000, 1000);
          fs.chmodSync(fullPath, 0o775);
        } catch {}
        charactersLinked++;
      } else {
        const fileName = `${safeName}.md`;
        const fullPath = path.join(charDir, fileName);
        const data = {
          title: rawName,
          draft: false,
          guildCharacterId: c._id,
          player: c.player,
          class: c.class,
          ancestry: c.ancestry,
          system: c.system,
          level: c.lvl,
          rank: rank,
          xp: c.xp || 0,
          tags: ['pc', `pc/${rank}`],
        };

        const body = `> [!abstract]\n` +
          `> Level ${c.lvl} ${c.ancestry} ${c.class} (${c.system}) played by ${c.player}.\n\n` +
          `## Backstory & Dossier\n` +
          `*Player character dossier awaiting player lore entries.*\n`;

        fs.writeFileSync(fullPath, matter.stringify(body, data), 'utf8');
        try {
          fs.chownSync(fullPath, 1000, 1000);
          fs.chmodSync(fullPath, 0o775);
        } catch {}
        charactersCreated++;
      }
    }

    const result: SyncResult = {
      success: true,
      sessionsLinked,
      sessionsCreated,
      charactersLinked,
      charactersCreated,
      timestamp: new Date().toISOString(),
    };

    try {
      const infoFile = getSyncInfoFilePath();
      fs.writeFileSync(infoFile, JSON.stringify(result, null, 2), 'utf8');
    } catch {}

    return result;
  } catch (err: any) {
    const failedResult: SyncResult = {
      success: false,
      sessionsLinked: 0,
      sessionsCreated: 0,
      charactersLinked: 0,
      charactersCreated: 0,
      timestamp: new Date().toISOString(),
      error: err.message,
    };
    return failedResult;
  }
}
