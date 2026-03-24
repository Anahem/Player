'use strict';
require('dotenv').config();

const express = require('express');
const path    = require('path');
const db      = require('./database');
const steam   = require('./steam');

const app  = express();
const PORT = parseInt(process.env.PORT) || 3003;

// ── Express config ────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Shared view helpers ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.fmtMinutes = function(mins) {
    if (!mins || mins === 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };
  res.locals.fmtDate = function(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };
  res.locals.personaState = function(state) {
    const states = ['Offline', 'Online', 'Busy', 'Away', 'Snooze', 'Trading', 'Looking to Play'];
    return states[state] || 'Offline';
  };
  res.locals.gameImg = function(appid) {
    return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
  };
  next();
});

// ── Home ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const history = db.getHistory();
  const err     = req.query.err  || null;
  const msg     = req.query.msg  || null;
  res.render('index', { history, err, msg, steamid: null, page: null });
});

// ── Search / resolve ──────────────────────────────────────────────────────────
app.post('/search', async (req, res) => {
  let { query } = req.body;
  if (!query || !query.trim()) return res.redirect('/?err=Please+enter+a+Steam+ID+or+profile+URL.');
  query = query.trim();

  let steamid = null;

  try {
    // Full URL: steamcommunity.com/profiles/STEAMID64
    const profileMatch = query.match(/\/profiles\/(\d{17})/);
    // Full URL: steamcommunity.com/id/VANITY
    const vanityMatch  = query.match(/\/id\/([^/?#]+)/);

    if (profileMatch) {
      steamid = profileMatch[1];
    } else if (vanityMatch) {
      steamid = await steam.resolveVanityUrl(vanityMatch[1]);
    } else if (/^\d{17}$/.test(query)) {
      steamid = query;
    } else {
      // Treat as vanity name
      steamid = await steam.resolveVanityUrl(query);
    }
  } catch (e) {
    return res.redirect(`/?err=${encodeURIComponent(e.message)}`);
  }

  if (!steamid) return res.redirect('/?err=Could+not+find+that+Steam+profile.+Try+a+SteamID64+or+vanity+URL.');
  res.redirect(`/profile/${steamid}`);
});

// ── Profile overview ──────────────────────────────────────────────────────────
app.get('/profile/:steamid', async (req, res) => {
  const { steamid } = req.params;
  if (!/^\d{17}$/.test(steamid)) return res.redirect('/?err=Invalid+Steam+ID.');

  try {
    const [profile, library, recent] = await Promise.all([
      steam.getPlayerSummary(steamid, db),
      steam.getOwnedGames(steamid, db),
      steam.getRecentlyPlayedGames(steamid, db),
    ]);

    if (!profile) return res.redirect('/?err=Steam+profile+not+found.');

    db.upsertHistory(profile);

    const isPrivate = profile.communityvisibilitystate !== 3;
    const games     = library?.games || [];
    const topGames  = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 6);

    res.render('profile', {
      profile, library, recent, topGames, isPrivate, steamid,
      page: 'profile',
      msg:  req.query.msg || null,
    });
  } catch (e) {
    console.error(e);
    res.render('error', { message: 'Failed to load profile.', detail: e.message, steamid: null, page: null });
  }
});

// ── Library ───────────────────────────────────────────────────────────────────
app.get('/profile/:steamid/library', async (req, res) => {
  const { steamid } = req.params;
  if (!/^\d{17}$/.test(steamid)) return res.redirect('/');

  try {
    const [profile, library] = await Promise.all([
      steam.getPlayerSummary(steamid, db),
      steam.getOwnedGames(steamid, db),
    ]);

    if (!profile) return res.redirect('/?err=Profile+not+found.');
    const isPrivate = profile.communityvisibilitystate !== 3;
    const games     = library?.games || [];

    res.render('library', { profile, games, isPrivate, steamid, page: 'library' });
  } catch (e) {
    console.error(e);
    res.render('error', { message: 'Failed to load library.', detail: e.message, steamid, page: 'library' });
  }
});

// ── Suggestions ───────────────────────────────────────────────────────────────
app.get('/profile/:steamid/suggestions', async (req, res) => {
  const { steamid } = req.params;
  if (!/^\d{17}$/.test(steamid)) return res.redirect('/');

  try {
    const [profile, library] = await Promise.all([
      steam.getPlayerSummary(steamid, db),
      steam.getOwnedGames(steamid, db),
    ]);

    if (!profile) return res.redirect('/?err=Profile+not+found.');
    const isPrivate = profile.communityvisibilitystate !== 3;
    const games     = library?.games || [];

    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

    const unplayed    = shuffle(games.filter(g => g.playtime_forever === 0));
    const barelyPlayed = shuffle(games.filter(g => g.playtime_forever > 0 && g.playtime_forever < 60));
    const inProgress  = shuffle(games.filter(g => g.playtime_forever >= 60 && g.playtime_forever < 600));

    res.render('suggestions', {
      profile, isPrivate, steamid, page: 'suggestions',
      unplayed:     unplayed.slice(0, 12),
      barelyPlayed: barelyPlayed.slice(0, 12),
      inProgress:   inProgress.slice(0, 12),
      counts: {
        unplayed:     unplayed.length,
        barelyPlayed: barelyPlayed.length,
        inProgress:   inProgress.length,
        total:        games.length,
      },
    });
  } catch (e) {
    console.error(e);
    res.render('error', { message: 'Failed to load suggestions.', detail: e.message, steamid, page: 'suggestions' });
  }
});

// ── Stats & reports ───────────────────────────────────────────────────────────
app.get('/profile/:steamid/stats', async (req, res) => {
  const { steamid } = req.params;
  if (!/^\d{17}$/.test(steamid)) return res.redirect('/');

  try {
    const [profile, library, recent] = await Promise.all([
      steam.getPlayerSummary(steamid, db),
      steam.getOwnedGames(steamid, db),
      steam.getRecentlyPlayedGames(steamid, db),
    ]);

    if (!profile) return res.redirect('/?err=Profile+not+found.');
    const isPrivate = profile.communityvisibilitystate !== 3;
    const games     = library?.games || [];

    const totalMinutes  = games.reduce((s, g) => s + g.playtime_forever, 0);
    const playedGames   = games.filter(g => g.playtime_forever > 0);
    const unplayedCount = games.filter(g => g.playtime_forever === 0).length;
    const avgMinutes    = playedGames.length ? Math.floor(totalMinutes / playedGames.length) : 0;
    const top10         = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 10);
    const recentMins    = (recent?.games || []).reduce((s, g) => s + (g.playtime_2weeks || 0), 0);

    const buckets = [
      { label: 'Never played',  count: games.filter(g => g.playtime_forever === 0).length },
      { label: '< 1 hour',      count: games.filter(g => g.playtime_forever > 0 && g.playtime_forever < 60).length },
      { label: '1 – 10 hours',  count: games.filter(g => g.playtime_forever >= 60 && g.playtime_forever < 600).length },
      { label: '10 – 50 hours', count: games.filter(g => g.playtime_forever >= 600 && g.playtime_forever < 3000).length },
      { label: '50 – 100 hrs',  count: games.filter(g => g.playtime_forever >= 3000 && g.playtime_forever < 6000).length },
      { label: '100 + hours',   count: games.filter(g => g.playtime_forever >= 6000).length },
    ];

    res.render('stats', {
      profile, isPrivate, steamid, page: 'stats',
      stats: {
        totalMinutes,
        totalHours:   Math.floor(totalMinutes / 60),
        totalGames:   games.length,
        playedCount:  playedGames.length,
        unplayedCount,
        avgMinutes,
        avgHours:     (avgMinutes / 60).toFixed(1),
        recentMinutes: recentMins,
        recentHours:  (recentMins / 60).toFixed(1),
      },
      top10,
      buckets,
      recent: recent?.games || [],
    });
  } catch (e) {
    console.error(e);
    res.render('error', { message: 'Failed to load stats.', detail: e.message, steamid, page: 'stats' });
  }
});

// ── Refresh cache ─────────────────────────────────────────────────────────────
app.post('/profile/:steamid/refresh', (req, res) => {
  const { steamid } = req.params;
  if (/^\d{17}$/.test(steamid)) db.clearCache(steamid);
  res.redirect(`/profile/${steamid}?msg=Cache+refreshed`);
});

// ── History management ────────────────────────────────────────────────────────
app.post('/history/:steamid/remove', (req, res) => {
  db.removeHistory(req.params.steamid);
  res.redirect('/');
});

app.post('/history/clear', (req, res) => {
  db.clearHistory();
  res.redirect('/');
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Steam Tool  →  http://localhost:${PORT}\n`);
});
