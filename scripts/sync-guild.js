const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const GUILD_BASE = 'https://guild.tarragon.be/api/external/v1';
const VAULT_PATH = '/mnt/whale/07_NOTES_WORKING/void_player_wiki';
const KNOWN_WORLDS = ['Sythian', 'Kalogeron', 'Khorash', 'Aldor', 'Elysium'];

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

  const existingSessionNotes = [];
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
      const fileWorlds = [];
      if (Array.isArray(parsed.data.worlds)) {
        parsed.data.worlds.forEach(w => typeof w === 'string' && fileWorlds.push(w));
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

  let linkedSessions = 0;
  let createdSessions = 0;
  const assignedNoteFiles = new Set();

  for (const s of sessions) {
    const d = new Date(s.date).toISOString().split('T')[0];
    const w = worldMap.get(s.world) || 'Unknown';
    const charNames = (s.characters || []).map(cid => charMap.get(cid)?.name).filter(Boolean);

    // Match candidate existing note:
    let match = existingSessionNotes.find(
      n => !assignedNoteFiles.has(n.fileName) &&
           n.guildSessionId &&
           n.guildSessionId === s._id &&
           !KNOWN_WORLDS.some(otherW =>
             otherW.toLowerCase() !== w.toLowerCase() &&
             n.fileName.toLowerCase().includes(otherW.toLowerCase())
           )
    );

    if (!match) {
      match = existingSessionNotes.find(
        n => !assignedNoteFiles.has(n.fileName) &&
             (!n.guildSessionId || n.guildSessionId === s._id) &&
             n.fileDate === d &&
             (n.fileWorlds.some(fw => fw.toLowerCase() === w.toLowerCase()) ||
              n.fileName.toLowerCase().includes(w.toLowerCase()))
      );
    }

    if (!match) {
      const sameDateSessions = sessions.filter(other => new Date(other.date).toISOString().split('T')[0] === d);
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
      match.guildSessionId = s._id;
      match.data = data;
      linkedSessions++;
    } else {
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
        charNames.map(cn => `- [[${cn}]]`).join('\n') + `\n\n` +
        `## Notes\n` +
        `- \n`;

      fs.writeFileSync(fullPath, matter.stringify(body, data), 'utf8');

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
      if (c.player !== undefined) data.player = c.player;
      if (c.class !== undefined) data.class = c.class;
      if (c.ancestry !== undefined) data.ancestry = c.ancestry;
      if (c.system !== undefined) data.system = c.system;
      data.level = c.lvl || 1;
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
        level: c.lvl || 1,
        rank: rank,
        xp: c.xp || 0,
        tags: ['pc', `pc/${rank}`],
      };
      if (c.player) data.player = c.player;
      if (c.class) data.class = c.class;
      if (c.ancestry) data.ancestry = c.ancestry;
      if (c.system) data.system = c.system;

      const body = `> [!abstract]\n` +
        `> Level ${c.lvl || 1} ${c.ancestry || 'Unknown Ancestry'} ${c.class || 'Adventurer'} (${c.system || 'PF'})${c.player ? ` played by ${c.player}` : ''}.\n\n` +
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
