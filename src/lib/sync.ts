import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { invalidateVaultCache } from './vault';
import { KNOWN_WORLDS } from './constants';

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

    const existingSessionNotes: Array<{
      fileName: string;
      fullPath: string;
      data: any;
      content: string;
      fileDate?: string;
      fileWorlds: string[];
      guildSessionId?: string;
    }> = [];

    for (const f of sessionFiles) {
      const fullPath = path.join(sessionDir, f);
      try {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        const parsed = matter(fileContent);
        let fDate = parsed.data.date;
        if (!fDate) {
          const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) fDate = dateMatch[1];
        }
        if (fDate instanceof Date) {
          fDate = fDate.toISOString().split('T')[0];
        }
        const fileWorlds: string[] = [];
        if (Array.isArray(parsed.data.worlds)) {
          parsed.data.worlds.forEach((w: string) => typeof w === 'string' && fileWorlds.push(w));
        } else if (typeof parsed.data.worlds === 'string') {
          fileWorlds.push(parsed.data.worlds);
        } else if (typeof parsed.data.world === 'string') {
          fileWorlds.push(parsed.data.world);
        }

        existingSessionNotes.push({
          fileName: f,
          fullPath,
          data: parsed.data,
          content: parsed.content,
          fileDate: fDate ? String(fDate) : undefined,
          fileWorlds,
          guildSessionId: parsed.data.guildSessionId ? String(parsed.data.guildSessionId).trim() : undefined,
        });
      } catch (err) {
        console.error(`Error reading ${f}:`, err);
      }
    }

    let sessionsLinked = 0;
    let sessionsCreated = 0;
    const assignedNoteFiles = new Set<string>();

    for (const s of sessions) {
      const d = new Date(s.date).toISOString().split('T')[0];
      const w = worldMap.get(s.world) || 'Unknown';
      const charNames = (s.characters || []).map((cid: string) => charMap.get(cid)?.name).filter(Boolean);

      // Match candidate existing note:
      // Priority 1: Exact match by guildSessionId, ensuring it does not cross-match a file named after another world
      let match = existingSessionNotes.find(
        n => !assignedNoteFiles.has(n.fileName) &&
             n.guildSessionId &&
             n.guildSessionId === s._id &&
             !KNOWN_WORLDS.some(otherW =>
               otherW.toLowerCase() !== w.toLowerCase() &&
               n.fileName.toLowerCase().includes(otherW.toLowerCase())
             )
      );

      // Priority 2: Match by Date AND World (if note is not yet assigned to a different guildSessionId)
      if (!match) {
        match = existingSessionNotes.find(
          n => !assignedNoteFiles.has(n.fileName) &&
               (!n.guildSessionId || n.guildSessionId === s._id) &&
               n.fileDate === d &&
               (n.fileWorlds.some(fw => fw.toLowerCase() === w.toLowerCase()) ||
                n.fileName.toLowerCase().includes(w.toLowerCase()))
        );
      }

      // Priority 3: Fallback match by Date ONLY if note has no world / unknown AND there is only 1 session on that date
      if (!match) {
        const sameDateSessions = sessions.filter((other: any) => new Date(other.date).toISOString().split('T')[0] === d);
        if (sameDateSessions.length === 1) {
          match = existingSessionNotes.find(
            n => !assignedNoteFiles.has(n.fileName) &&
                 (!n.guildSessionId || n.guildSessionId === s._id) &&
                 n.fileDate === d
          );
        }
      }

      const canonicalTitle = `${d} ${w.toUpperCase()}`;

      if (match) {
        assignedNoteFiles.add(match.fileName);
        const fullPath = match.fullPath;
        const data = { ...match.data };
        data.title = canonicalTitle;
        data.guildSessionId = s._id;
        data.system = s.system || data.system || 'PF';
        data.date = d;
        data.worlds = [w];
        data.tags = Array.from(new Set([...(Array.isArray(data.tags) ? data.tags : []), 'session']));
        fs.writeFileSync(fullPath, matter.stringify(match.content, data), 'utf8');
        try {
          fs.chownSync(fullPath, 1000, 1000);
          fs.chmodSync(fullPath, 0o775);
        } catch {}
        match.guildSessionId = s._id;
        match.data = data;
        sessionsLinked++;
      } else {
        // Need to create a new session report file
        // Ensure unique filename if collision occurs
        let fileName = `${canonicalTitle}.md`;
        let counter = 2;
        while (fs.existsSync(path.join(sessionDir, fileName)) || existingSessionNotes.some(n => n.fileName === fileName)) {
          fileName = `${canonicalTitle} ${counter}.md`;
          counter++;
        }

        const fullPath = path.join(sessionDir, fileName);
        const data = {
          title: canonicalTitle,
          draft: false,
          date: d,
          guildSessionId: s._id,
          system: s.system || 'PF',
          worlds: [w],
          tags: ['session'],
        };

        const body = `# ${canonicalTitle}\n\n` +
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

        const newNoteEntry = {
          fileName,
          fullPath,
          data,
          content: body,
          fileDate: d,
          fileWorlds: [w],
          guildSessionId: s._id,
        };
        existingSessionNotes.push(newNoteEntry);
        assignedNoteFiles.add(fileName);
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
        if (c.player !== undefined) data.player = c.player;
        if (c.class !== undefined) data.class = c.class;
        if (c.ancestry !== undefined) data.ancestry = c.ancestry;
        if (c.system !== undefined) data.system = c.system;
        data.level = c.lvl || 1;
        data.rank = rank;
        data.xp = c.xp || 0;
        data.isDead = Boolean(c.isDead);
        if (c.diedAtSessionId) data.diedAtSessionId = c.diedAtSessionId;
        else delete data.diedAtSessionId;
        if (c.diedAtLevel) data.diedAtLevel = c.diedAtLevel;
        else delete data.diedAtLevel;
        data.tags = Array.from(new Set([
          ...(Array.isArray(data.tags) ? data.tags : []),
          'pc',
          `pc/${rank}`,
          ...(c.isDead ? ['deceased'] : [])
        ].filter(t => !c.isDead ? t !== 'deceased' && t !== 'fallen' : true)));
        fs.writeFileSync(fullPath, matter.stringify(parsed.content, data), 'utf8');
        try {
          fs.chownSync(fullPath, 1000, 1000);
          fs.chmodSync(fullPath, 0o775);
        } catch {}
        charactersLinked++;
      } else {
        const fileName = `${safeName}.md`;
        const fullPath = path.join(charDir, fileName);
        const data: any = {
          title: rawName,
          draft: false,
          guildCharacterId: c._id,
          level: c.lvl || 1,
          rank: rank,
          xp: c.xp || 0,
          isDead: Boolean(c.isDead),
          tags: ['pc', `pc/${rank}`, ...(c.isDead ? ['deceased'] : [])],
        };
        if (c.diedAtSessionId) data.diedAtSessionId = c.diedAtSessionId;
        if (c.diedAtLevel) data.diedAtLevel = c.diedAtLevel;
        if (c.player) data.player = c.player;
        if (c.class) data.class = c.class;
        if (c.ancestry) data.ancestry = c.ancestry;
        if (c.system) data.system = c.system;

        const body = `## Backstory & Dossier\n` +
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

    invalidateVaultCache();

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
