import "server-only";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const globals = globalThis as typeof globalThis & { liteDb?: DatabaseSync };
export function db() {
  if (!globals.liteDb) {
    const file = process.env.DATABASE_PATH || "./data/dojo.sqlite";
    if (file !== ":memory:")
      mkdirSync(dirname(resolve(file)), { recursive: true });
    const connection = new DatabaseSync(file);
    connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000; PRAGMA cache_size=-2048; PRAGMA synchronous=NORMAL;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'STUDENT' CHECK(role IN ('STUDENT','ADMIN'))
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS login_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', video_url TEXT NOT NULL DEFAULT '',
        homework TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL, published INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS chapters_course ON chapters(course_id,position);
      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        title TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('QUIZ','CODE')), prompt TEXT NOT NULL,
        options TEXT NOT NULL DEFAULT '[]', answer INTEGER NOT NULL DEFAULT 0,
        starter TEXT NOT NULL DEFAULT '', tests TEXT NOT NULL DEFAULT '[]', position INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS exercises_chapter ON exercises(chapter_id,position);
      CREATE TABLE IF NOT EXISTS enrollments (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        PRIMARY KEY(user_id,course_id)
      );
      CREATE TABLE IF NOT EXISTS progress (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        done INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,chapter_id)
      );
      CREATE TABLE IF NOT EXISTS attempts (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        passed INTEGER NOT NULL DEFAULT 0, answer TEXT NOT NULL DEFAULT '', PRIMARY KEY(user_id,exercise_id)
      );
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','REVISION','ACCEPTED')),
        feedback TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL, UNIQUE(user_id,chapter_id)
      );
      CREATE INDEX IF NOT EXISTS submissions_chapter ON submissions(chapter_id);
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS attachments_course ON attachments(course_id);
      PRAGMA user_version=1;
    `);
    globals.liteDb = connection;
  }
  return globals.liteDb;
}
export function all<T>(sql: string, ...args: SQLInputValue[]): T[] {
  return db()
    .prepare(sql)
    .all(...args)
    .map((row) => ({ ...row })) as T[];
}
export function one<T>(sql: string, ...args: SQLInputValue[]): T | undefined {
  const row = db()
    .prepare(sql)
    .get(...args);
  return row ? ({ ...row } as T) : undefined;
}
export function run(sql: string, ...args: SQLInputValue[]) {
  return db()
    .prepare(sql)
    .run(...args);
}
export function transaction<T>(work: () => T): T {
  db().exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db().exec("COMMIT");
    return result;
  } catch (error) {
    db().exec("ROLLBACK");
    throw error;
  }
}
