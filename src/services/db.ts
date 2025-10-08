import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export type UserRow = {
  id?: number;
  utm_source: string;
  date: string; // YYYY-MM-DD
  username: string; // e.g. @alex or id:123456
  video_generate_name: string;
};

const dataDir = path.resolve('data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'data.sqlite');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utm_source TEXT NOT NULL,
  date TEXT NOT NULL,
  username TEXT NOT NULL,
  video_generate_name TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique ON users (utm_source, username);
CREATE INDEX IF NOT EXISTS idx_users_date ON users (date);
`);

const insertStmt = db.prepare<Pick<UserRow, 'utm_source' | 'date' | 'username' | 'video_generate_name'>>(
  'INSERT INTO users (utm_source, date, username, video_generate_name) VALUES (@utm_source, @date, @username, @video_generate_name)'
);

export function addUser(row: Pick<UserRow, 'utm_source' | 'date' | 'username' | 'video_generate_name'>): { inserted: boolean; id?: number } {
  try {
    const info = insertStmt.run(row);
    logger.info(`DB: user inserted (${row.username}, ${row.utm_source})`);
    return { inserted: true, id: Number(info.lastInsertRowid) };
  } catch (e: any) {
    // Unique constraint violation -> already exists
    if (typeof e?.code === 'string' && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      logger.info(`DB: user already exists (${row.username}, ${row.utm_source})`);
      return { inserted: false };
    }
    logger.error(`DB insert error: ${e?.message || e}`);
    throw e;
  }
}

export function countByDate(date: string): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE date = ?').get(date) as { cnt: number };
  return row.cnt;
}

export function listByDate(date: string): UserRow[] {
  const rows = db.prepare('SELECT id, utm_source, date, username, video_generate_name FROM users WHERE date = ? ORDER BY id ASC').all(date) as UserRow[];
  return rows;
}

export function listAll(): UserRow[] {
  const rows = db.prepare('SELECT id, utm_source, date, username, video_generate_name FROM users ORDER BY date ASC, id ASC').all() as UserRow[];
  return rows;
}

export function hasAnySubmission(username: string): boolean {
  const row = db.prepare('SELECT 1 as found FROM users WHERE username = ? LIMIT 1').get(username) as { found: number } | undefined;
  return !!row;
}

export function allDates(): { date: string; count: number }[] {
  const rows = db.prepare('SELECT date, COUNT(*) as count FROM users GROUP BY date ORDER BY date DESC').all() as { date: string; count: number }[];
  return rows;
}

export function toCsv(rows: UserRow[]): string {
  const header = 'date,utm_source,username,video_generate_name';
  const escape = (s: string) => {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = rows.map(r => [r.date, r.utm_source, r.username, r.video_generate_name].map(escape).join(','));
  return [header, ...lines].join('\n');
}
