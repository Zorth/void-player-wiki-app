import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'wiki.db');

function ensureDbDir() {
  try {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create db directory:', err);
  }
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    ensureDbDir();
    dbInstance = new DatabaseSync(DB_PATH);
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  // Performance optimizations
  try {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
    `);
  } catch {}

  // Comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_slug TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_picture TEXT,
      user_nickname TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(note_slug);
  `);

  // Comment reactions table (upvote/+1, heart/like, laugh/funny)
  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_reactions (
      comment_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (comment_id, user_id, reaction),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
  `);

  // User permissions table (granting edit rights)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id TEXT PRIMARY KEY,
      user_name TEXT,
      user_email TEXT,
      user_nickname TEXT,
      user_picture TEXT,
      can_edit INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export interface CommentRecord {
  id: number;
  note_slug: string;
  user_id: string;
  user_name: string;
  user_picture: string | null;
  user_nickname: string | null;
  content: string;
  created_at: string;
  reactions?: Record<string, { count: number; users: string[] }>;
}

export interface UserPermissionRecord {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_nickname: string | null;
  user_picture: string | null;
  can_edit: number;
  is_admin: number;
  updated_at: string;
}

export function getCommentsForNote(slug: string): CommentRecord[] {
  const db = getDb();
  const query = db.prepare('SELECT * FROM comments WHERE note_slug = ? ORDER BY id ASC');
  const comments = query.all(slug) as unknown as CommentRecord[];

  if (comments.length === 0) return [];

  // Fetch reactions for these comments
  const commentIds = comments.map(c => c.id);
  const placeholders = commentIds.map(() => '?').join(',');
  const reactionQuery = db.prepare(`SELECT * FROM comment_reactions WHERE comment_id IN (${placeholders})`);
  const reactions = reactionQuery.all(...commentIds) as unknown as Array<{ comment_id: number; user_id: string; reaction: string }>;

  const reactionMap = new Map<number, Record<string, { count: number; users: string[] }>>();
  for (const r of reactions) {
    let commentReactions = reactionMap.get(r.comment_id);
    if (!commentReactions) {
      commentReactions = {};
      reactionMap.set(r.comment_id, commentReactions);
    }
    if (!commentReactions[r.reaction]) {
      commentReactions[r.reaction] = { count: 0, users: [] };
    }
    commentReactions[r.reaction].count += 1;
    commentReactions[r.reaction].users.push(r.user_id);
  }

  for (const c of comments) {
    c.reactions = reactionMap.get(c.id) || {};
  }

  return comments;
}

export function toggleCommentReaction(commentId: number, userId: string, reaction: string): { reacted: boolean; count: number } {
  const db = getDb();
  // Valid reactions: 'upvote' (+1/THIS), 'heart' (love/like), 'laugh' (funny/laugh)
  const existing = db.prepare('SELECT * FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND reaction = ?')
    .get(commentId, userId, reaction);

  let reacted = false;
  if (existing) {
    db.prepare('DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND reaction = ?')
      .run(commentId, userId, reaction);
    reacted = false;
  } else {
    db.prepare('INSERT INTO comment_reactions (comment_id, user_id, reaction) VALUES (?, ?, ?)')
      .run(commentId, userId, reaction);
    reacted = true;
  }

  const countRow = db.prepare('SELECT COUNT(*) as count FROM comment_reactions WHERE comment_id = ? AND reaction = ?')
    .get(commentId, reaction) as { count: number };

  return { reacted, count: countRow ? Number(countRow.count) : 0 };
}

export function addComment(slug: string, userId: string, userName: string, userPicture: string | null, userNickname: string | null, content: string): CommentRecord {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO comments (note_slug, user_id, user_name, user_picture, user_nickname, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(slug, userId, userName, userPicture, userNickname, content);
  const getById = db.prepare('SELECT * FROM comments WHERE id = ?');
  return getById.get(Number(result.lastInsertRowid)) as unknown as CommentRecord;
}

export function deleteComment(id: number, userId: string, isAdmin: boolean): boolean {
  const db = getDb();
  if (isAdmin) {
    const stmt = db.prepare('DELETE FROM comments WHERE id = ?');
    const res = stmt.run(id);
    return res.changes > 0;
  } else {
    const stmt = db.prepare('DELETE FROM comments WHERE id = ? AND user_id = ?');
    const res = stmt.run(id, userId);
    return res.changes > 0;
  }
}

export function recordUserLogin(userId: string, name: string, email: string, nickname: string, picture: string, isAdmin: boolean) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(userId) as unknown as UserPermissionRecord | undefined;
  
  const isSuperAdmin = isAdmin || 
    email === 'jasper_goens@hotmail.com' || 
    email === 'hubbe.platteau2@gmail.com' ||
    nickname?.toLowerCase() === 'zorth' || 
    nickname?.toLowerCase() === 'hubbe' ||
    userId === 'user_3AZtRlDbNyvNAaBVjvrfceGwe69' ||
    userId === 'user_3AiTA7kVIsvRACWPU8yELDGggKj';

  if (!existing) {
    db.prepare(`
      INSERT INTO user_permissions (user_id, user_name, user_email, user_nickname, user_picture, can_edit, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name, email, nickname, picture, isSuperAdmin ? 1 : 0, isSuperAdmin ? 1 : 0);
  } else {
    const finalAdmin = isSuperAdmin || existing.is_admin === 1;
    const finalCanEdit = isSuperAdmin || existing.can_edit === 1;
    db.prepare(`
      UPDATE user_permissions
      SET user_name = ?, user_email = ?, user_nickname = ?, user_picture = ?, is_admin = ?, can_edit = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(name, email, nickname, picture, finalAdmin ? 1 : 0, finalCanEdit ? 1 : 0, userId);
  }
}

export function canUserEdit(userId: string, isClerkAdmin: boolean): boolean {
  if (isClerkAdmin || userId === 'user_3AZtRlDbNyvNAaBVjvrfceGwe69' || userId === 'user_3AiTA7kVIsvRACWPU8yELDGggKj') return true;
  const db = getDb();
  const rec = db.prepare('SELECT can_edit, is_admin FROM user_permissions WHERE user_id = ?').get(userId) as unknown as UserPermissionRecord | undefined;
  if (!rec) return false;
  return rec.can_edit === 1 || rec.is_admin === 1;
}

export function getAllUserPermissions(): UserPermissionRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM user_permissions ORDER BY is_admin DESC, updated_at DESC').all() as unknown as UserPermissionRecord[];
}

export function setUserEditPermission(userId: string, canEdit: boolean, noteName?: string) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare(`
      INSERT INTO user_permissions (user_id, user_name, can_edit, is_admin)
      VALUES (?, ?, ?, 0)
    `).run(userId, noteName || 'Pre-authorized Player', canEdit ? 1 : 0);
  } else {
    db.prepare(`
      UPDATE user_permissions
      SET can_edit = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(canEdit ? 1 : 0, userId);
  }
}
