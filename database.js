'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

// ── Setup ─────────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'steam.db'));

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS cache (
    key       TEXT PRIMARY KEY,
    data      TEXT NOT NULL,
    cached_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS history (
    steamid     TEXT PRIMARY KEY,
    personaname TEXT NOT NULL DEFAULT '',
    avatar      TEXT NOT NULL DEFAULT '',
    last_viewed INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// ── Cache TTLs (seconds) ──────────────────────────────────────────────────────
const TTL = {
  profile: 1800,  // 30 min
  library: 3600,  // 1 hour
  recent:  900,   // 15 min
};

// ── Cache helpers ─────────────────────────────────────────────────────────────
const stmtGetCache = db.prepare('SELECT data, cached_at FROM cache WHERE key = ?');
const stmtSetCache = db.prepare(`
  INSERT INTO cache (key, data, cached_at) VALUES (?, ?, unixepoch())
  ON CONFLICT(key) DO UPDATE SET data = excluded.data, cached_at = excluded.cached_at
`);
const stmtClearCache = db.prepare("DELETE FROM cache WHERE key LIKE ?");

function getCached(key, type) {
  const row = stmtGetCache.get(key);
  if (!row) return null;
  const ttl = TTL[type] || 3600;
  const age = Math.floor(Date.now() / 1000) - row.cached_at;
  if (age > ttl) return null;
  return JSON.parse(row.data);
}

function setCached(key, data) {
  stmtSetCache.run(key, JSON.stringify(data));
}

function clearCache(steamid) {
  stmtClearCache.run(`%${steamid}%`);
}

// ── History helpers ───────────────────────────────────────────────────────────
const stmtUpsertHistory = db.prepare(`
  INSERT INTO history (steamid, personaname, avatar, last_viewed)
  VALUES (?, ?, ?, unixepoch())
  ON CONFLICT(steamid) DO UPDATE SET
    personaname = excluded.personaname,
    avatar      = excluded.avatar,
    last_viewed = excluded.last_viewed
`);
const stmtGetHistory    = db.prepare('SELECT * FROM history ORDER BY last_viewed DESC LIMIT 10');
const stmtRemoveHistory = db.prepare('DELETE FROM history WHERE steamid = ?');

function upsertHistory(profile) {
  stmtUpsertHistory.run(
    profile.steamid,
    profile.personaname,
    profile.avatarmedium || profile.avatar || ''
  );
}

function getHistory() {
  return stmtGetHistory.all();
}

function removeHistory(steamid) {
  stmtRemoveHistory.run(steamid);
}

function clearHistory() {
  db.exec('DELETE FROM history');
}

module.exports = {
  getCached,
  setCached,
  clearCache,
  upsertHistory,
  getHistory,
  removeHistory,
  clearHistory,
};
