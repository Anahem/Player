'use strict';

const BASE = 'https://api.steampowered.com';

function getKey() {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error('STEAM_API_KEY is not set in your .env file.');
  return key;
}

async function apiFetch(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Steam API returned ${res.status}`);
  return res.json();
}

// ── Resolve a vanity URL (custom profile name) to a SteamID64 ────────────────
async function resolveVanityUrl(vanityurl) {
  const key  = getKey();
  const data = await apiFetch(`${BASE}/ISteamUser/ResolveVanityURL/v0001/?key=${key}&vanityurl=${encodeURIComponent(vanityurl)}`);
  return data.response?.success === 1 ? data.response.steamid : null;
}

// ── Get player profile summary ────────────────────────────────────────────────
async function getPlayerSummary(steamid, db) {
  const cacheKey = `profile:${steamid}`;
  const cached   = db.getCached(cacheKey, 'profile');
  if (cached) return cached;

  const key    = getKey();
  const data   = await apiFetch(`${BASE}/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${steamid}`);
  const player = data.response?.players?.[0] || null;
  if (player) db.setCached(cacheKey, player);
  return player;
}

// ── Get owned games (with app info & free games) ──────────────────────────────
async function getOwnedGames(steamid, db) {
  const cacheKey = `library:${steamid}`;
  const cached   = db.getCached(cacheKey, 'library');
  if (cached) return cached;

  const key    = getKey();
  const data   = await apiFetch(
    `${BASE}/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${steamid}` +
    `&include_appinfo=1&include_played_free_games=1`
  );
  const result = data.response || null;
  if (result) db.setCached(cacheKey, result);
  return result;
}

// ── Get recently played games (last 2 weeks) ──────────────────────────────────
async function getRecentlyPlayedGames(steamid, db) {
  const cacheKey = `recent:${steamid}`;
  const cached   = db.getCached(cacheKey, 'recent');
  if (cached) return cached;

  const key    = getKey();
  const data   = await apiFetch(
    `${BASE}/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${key}&steamid=${steamid}&count=10`
  );
  const result = data.response || null;
  if (result) db.setCached(cacheKey, result);
  return result;
}

module.exports = { resolveVanityUrl, getPlayerSummary, getOwnedGames, getRecentlyPlayedGames };
