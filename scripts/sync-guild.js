const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const GUILD_BASE = 'https://guild.tarragon.be/api/external/v1';
const VAULT_PATH = '/mnt/whale/07_NOTES_WORKING/void_player_wiki';

async function sync() {
  const [worlds, characters, sessions] = await Promise.all([
    fetch(GUILD_BASE + '/worlds').then(r => r.json()),
    fetch(GUILD_BASE + '/characters').then(r => r.json()),
    fetch(GUILD_BASE + '/sessions?past=true').then(r => r.json()),
  ]);

  const worldMap = new Map(worlds.map(w => [w._id, w.name]));
  const charMap = new Map(characters.map(c => [c._id, c]));

  // 1. SYNC SESSIONS
  const sessionDir = path.join(VAULT_PATH, 'Session Reports');
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  const sessionFiles = fs.readdirSync(sessionDir).filter(f => f.endsWith('.md'));

  let linkedSessions = 0;
  let createdSessions = 0;

  for (const s of sessions) {
    const d = new Date(s.date).toISOString().split('T')[0];
    const w = worldMap.get(s.world) || 'Unknown';
    const charNames = (s.characters || []).map(cid => charMap.get(cid)?.name).filter(Boolean);

    const existingFile = sessionFiles.find(f => f.includes(d));
    if (existingFile) {
      // Link to existing note
      const fullPath = path.join(sessionDir, existingFile);
      const parsed = matter(fs.readFileSync(fullPath, 'utf8'));
      const data = { ...parsed.data };
      data.guildSessionId = s._id;
      data.system = s.system || data.system || 'DnD';
      data.date = d;
      data.worlds = Array.from(new Set([...(Array.isArray(data.worlds) ? data.worlds : []), w]));
      data.tags = Array.from(new Set([...(Array.isArray(data.tags) ? data.tags : []), 'session']));
      fs.writeFileSync(fullPath, matter.stringify(parsed.content, data), 'utf8');
      linkedSessions++;
    } else {
      // Create new session note
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
        charNames.map(cn => `- [[${cn}]]`).join('\n') + `\n\n` +
        `## Notes\n` +
        `- \n`;

      fs.writeFileSync(fullPath, matter.stringify(body, data), 'utf8');
      createdSessions++;
    }
  }

  // 2. SYNC CHARACTERS
  const charDir = path.join(VAULT_PATH, 'Player Characters');
  if (!fs.existsSync(charDir)) fs.mkdirSync(charDir, { recursive: true });
  const charFiles = fs.readdirSync(charDir).filter(f => f.endsWith('.md'));

  let linkedChars = 0;
  let createdChars = 0;

  for (const c of characters) {
    const rawName = c.name.trim();
    const safeName = rawName.replace(/[\\/:*?"<>|]/g, '');
    const rank = c.rank && c.rank !== 'none' ? c.rank.toLowerCase() : 'apprentice';

    // Check if matches an existing file
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
      linkedChars++;
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
      createdChars++;
    }
  }

  console.log('Sessions: linked', linkedSessions, ', created', createdSessions);
  console.log('Characters: linked', linkedChars, ', created', createdChars);
}

sync().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
