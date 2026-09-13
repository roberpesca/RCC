// Uses Node's built-in SQLite module (stable from Node 22.5+, still flagged
// "experimental" by Node itself) instead of better-sqlite3, so there's no native
// addon to compile/prebuild — this runs anywhere a modern Node runs, no build step.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth/passwords.js';

const dbPath = process.env.DB_PATH || './data/coach.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
// Default rollback-journal mode (not WAL): WAL requires shared-memory mmap support
// that some network/container filesystems (and this dev sandbox's mounted volume)
// don't provide.

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function tableExists(table) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(table);
}

// --- Brand-new tables (multi-user accounts) --------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Short-lived, single-use row so the public Strava OAuth callback (hit directly by
-- Strava's redirect, with no auth header available) can recover which logged-in
-- user initiated the "Connect Strava" click.
CREATE TABLE IF NOT EXISTS strava_pending_connect (
  state TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// --- One-time migration: this app used to support exactly one athlete, with a
// single implicit "row 1" for profile/strava_tokens and no user scoping at all on
// plans/activities/ftp_history/weigh_ins/nutrition_targets. If a database from that
// era exists, attach all of it to a real account instead of silently discarding it.
const legacyProfileExists = tableExists('profile') && !columnExists('profile', 'user_id');

function createOwnerAccount() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Found an existing single-user database from before multi-user accounts. Set OWNER_EMAIL and ' +
      'OWNER_PASSWORD in your .env file to one-time-migrate your existing data to a real account, then restart.'
    );
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const info = db.prepare(
    `INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`
  ).run(email, hashPassword(password), 'Athlete');
  return Number(info.lastInsertRowid);
}

if (legacyProfileExists) {
  const ownerId = createOwnerAccount();

  db.exec('BEGIN');
  try {
    // profile & strava_tokens: PK changes from a fixed literal row to user_id, which
    // SQLite can't do with ALTER TABLE — recreate.
    db.exec(`
      CREATE TABLE profile_new (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        name TEXT, sex TEXT DEFAULT 'male', birth_year INTEGER, height_cm REAL, weight_kg REAL,
        ftp_watts REAL, goal_type TEXT DEFAULT 'ftp_and_weight', goal_weight_kg REAL,
        goal_rate_pct_per_week REAL DEFAULT 5, weekly_hours_available REAL DEFAULT 6,
        units TEXT DEFAULT 'metric', onboarded INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.prepare(`
      INSERT INTO profile_new (user_id, name, sex, birth_year, height_cm, weight_kg, ftp_watts, goal_type,
        goal_weight_kg, goal_rate_pct_per_week, weekly_hours_available, units, onboarded, updated_at)
      SELECT ?, name, sex, birth_year, height_cm, weight_kg, ftp_watts, goal_type,
        goal_weight_kg, goal_rate_pct_per_week, weekly_hours_available, units, onboarded, updated_at
      FROM profile WHERE id = 1
    `).run(ownerId);
    db.exec('DROP TABLE profile; ALTER TABLE profile_new RENAME TO profile;');

    if (tableExists('strava_tokens') && !columnExists('strava_tokens', 'user_id')) {
      db.exec(`
        CREATE TABLE strava_tokens_new (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          athlete_id INTEGER, access_token TEXT, refresh_token TEXT, expires_at INTEGER,
          scope TEXT, connected_at TEXT DEFAULT (datetime('now'))
        );
      `);
      db.prepare(`
        INSERT INTO strava_tokens_new (user_id, athlete_id, access_token, refresh_token, expires_at, scope, connected_at)
        SELECT ?, athlete_id, access_token, refresh_token, expires_at, scope, connected_at FROM strava_tokens WHERE id = 1
      `).run(ownerId);
      db.exec('DROP TABLE strava_tokens; ALTER TABLE strava_tokens_new RENAME TO strava_tokens;');
    }

    // weigh_ins & nutrition_targets: UNIQUE(date) needs to become UNIQUE(user_id, date)
    // — SQLite can't alter a unique constraint in place, so recreate.
    if (tableExists('weigh_ins') && !columnExists('weigh_ins', 'user_id')) {
      db.exec(`
        CREATE TABLE weigh_ins_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL, weight_kg REAL NOT NULL, note TEXT,
          UNIQUE(user_id, date)
        );
      `);
      db.prepare(`
        INSERT INTO weigh_ins_new (id, user_id, date, weight_kg, note)
        SELECT id, ?, date, weight_kg, note FROM weigh_ins
      `).run(ownerId);
      db.exec('DROP TABLE weigh_ins; ALTER TABLE weigh_ins_new RENAME TO weigh_ins;');
    }

    if (tableExists('nutrition_targets') && !columnExists('nutrition_targets', 'user_id')) {
      db.exec(`
        CREATE TABLE nutrition_targets_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL, day_type TEXT, calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL,
          tdee_estimate REAL, generated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(user_id, date)
        );
      `);
      db.prepare(`
        INSERT INTO nutrition_targets_new (id, user_id, date, day_type, calories, protein_g, carbs_g, fat_g, tdee_estimate, generated_at)
        SELECT id, ?, date, day_type, calories, protein_g, carbs_g, fat_g, tdee_estimate, generated_at FROM nutrition_targets
      `).run(ownerId);
      db.exec('DROP TABLE nutrition_targets; ALTER TABLE nutrition_targets_new RENAME TO nutrition_targets;');
    }

    // plans, activities, ftp_history: no global-unique constraint stands in the way,
    // so a plain added column + backfill is enough.
    for (const table of ['plans', 'activities', 'ftp_history']) {
      if (tableExists(table) && !columnExists(table, 'user_id')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id)`);
        db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(ownerId);
      }
    }

    db.exec('COMMIT');
    console.log(`[migration] Existing single-user data attached to account ${process.env.OWNER_EMAIL} (user id ${ownerId}).`);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// --- Full schema (also what a brand-new database gets directly) ------------
db.exec(`
CREATE TABLE IF NOT EXISTS profile (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  sex TEXT DEFAULT 'male',
  birth_year INTEGER,
  height_cm REAL,
  weight_kg REAL,
  ftp_watts REAL,
  goal_type TEXT DEFAULT 'ftp_and_weight',
  goal_weight_kg REAL,
  goal_rate_pct_per_week REAL DEFAULT 5,
  weekly_hours_available REAL DEFAULT 6,
  units TEXT DEFAULT 'metric',
  onboarded INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strava_tokens (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  athlete_id INTEGER,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  scope TEXT,
  connected_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  program_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  weeks INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  base_ftp REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plan_workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  phase TEXT,
  day_date TEXT NOT NULL,
  workout_key TEXT,
  title TEXT,
  description TEXT,
  structure_json TEXT,
  planned_tss REAL,
  planned_duration_min REAL,
  status TEXT DEFAULT 'planned',
  matched_activity_id INTEGER,
  adapted_from TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT,
  type TEXT,
  name TEXT,
  distance_m REAL,
  moving_time_s REAL,
  elapsed_time_s REAL,
  avg_watts REAL,
  weighted_avg_watts REAL,
  max_watts REAL,
  avg_hr REAL,
  max_hr REAL,
  kilojoules REAL,
  suffer_score REAL,
  total_elevation_gain REAL,
  tss_estimate REAL,
  tss_method TEXT,
  source TEXT DEFAULT 'strava_api',
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS ftp_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  ftp_watts REAL NOT NULL,
  source TEXT DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS weigh_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  note TEXT,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS nutrition_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  day_type TEXT,
  calories REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  tdee_estimate REAL,
  generated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);
`);

export function getProfile(userId) {
  const row = db.prepare('SELECT * FROM profile WHERE user_id = ?').get(userId);
  if (row) return row;
  db.prepare(`INSERT INTO profile (user_id, name) VALUES (?, 'Athlete')`).run(userId);
  return db.prepare('SELECT * FROM profile WHERE user_id = ?').get(userId);
}

export function updateProfile(userId, fields) {
  getProfile(userId);
  const allowed = [
    'name', 'sex', 'birth_year', 'height_cm', 'weight_kg', 'ftp_watts',
    'goal_type', 'goal_weight_kg', 'goal_rate_pct_per_week',
    'weekly_hours_available', 'units', 'onboarded'
  ];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return getProfile(userId);
  const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(
    `UPDATE profile SET ${setClause}, updated_at = datetime('now') WHERE user_id = @user_id`
  ).run({ ...fields, user_id: userId });
  return getProfile(userId);
}
