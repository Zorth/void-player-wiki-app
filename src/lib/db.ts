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
  return query.all(slug) as unknown as CommentRecord[];
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
  
  const isSuperAdmin = isAdmin || email === 'jasper_goens@hotmail.com' || nickname?.toLowerCase() === 'zorth' || userId === 'user_3AZtRlDbNyvNAaBVjvrfceGwe69';

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
  if (isClerkAdmin || userId === 'user_3AZtRlDbNyvNAaBVjvrfceGwe69') return true;
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
