# Player

A self-hosted Steam profile analyser. Look up any public Steam profile, browse the full game library, discover unplayed and barely-started games, and view detailed playtime stats and reports. Runs locally — no cloud, no account required.

## Features

- **Profile analysis** — avatar, online status, account age, country, and currently playing game
- **Top games** — most-played games with playtime bars and recent 2-week activity
- **Full library browser** — every owned game with cover art, playtime, and client-side search, sort, and filter
- **Game suggestions** — shuffled picks from your backlog split into Never played, Barely started (<1h), and In progress (1–10h)
- **Stats & reports** — total playtime, played vs unplayed counts, average per game, top-10 chart, and playtime distribution breakdown
- **Profile history** — recently looked-up profiles saved locally for quick re-access
- **Smart caching** — Steam API responses cached in SQLite (profile 30min, library 1hr, recent 15min) to stay fast and avoid rate limits
- **Refresh on demand** — one-click cache bust to pull the latest data from Steam

## Requirements

- [Node.js](https://nodejs.org) **v22 or newer** (uses the built-in SQLite module)
- A free Steam Web API key
- Windows, macOS, or Linux

## Quick Start

**1. Clone the repo**
```bash
git clone https://github.com/Anahem/Player.git
cd Player
```

**2. Install dependencies**
```bash
npm install
```

**3. Get a Steam API key**

Go to [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey), log in with your Steam account, and generate a free key.

**4. Create your config file**

Create a `.env` file in the project root:
```
STEAM_API_KEY=your_api_key_here
```

**5. Start the server**
```bash
node --experimental-sqlite server.js
```

**6. Open your browser**

Go to `http://localhost:3003`

Enter a SteamID64, vanity URL, or full profile URL to look up any public profile.

## Configuration (`.env`)

| Variable | Required | Description |
|---|---|---|
| `STEAM_API_KEY` | Yes | Your Steam Web API key from [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) |
| `PORT` | No | Port to run on (default: `3003`) |

## Finding a Steam Profile

Player accepts three input formats:

| Format | Example |
|---|---|
| SteamID64 (17-digit number) | `76561197960287930` |
| Vanity URL name | `gaben` |
| Full profile URL | `https://steamcommunity.com/id/gaben` |

> **Note:** The profile must be set to **public** for game library and playtime data to be available. Private profiles will show basic info only.

## Pages

| Page | URL | What it shows |
|---|---|---|
| Search | `/` | Search form and recent profile history |
| Profile | `/profile/:steamid` | Overview — avatar, stats, top games, recent activity |
| Library | `/profile/:steamid/library` | All owned games — searchable, sortable, filterable |
| Suggestions | `/profile/:steamid/suggestions` | Backlog picks — shuffled each visit |
| Stats | `/profile/:steamid/stats` | Playtime metrics, top-10 chart, distribution |

## Data

All data is stored locally:

| Path | Contents |
|---|---|
| `data/steam.db` | API response cache and profile history |

The database is created automatically on first run. To clear all cached data and history, delete `data/steam.db` and restart.

## Tech Stack

- **Runtime:** Node.js 22+ with `node:sqlite` (no external DB driver)
- **Server:** Express
- **Templates:** EJS
- **Database:** SQLite (via Node.js built-in) — used for caching only
- **HTTP:** Native `fetch` (Node 18+) — no extra packages for API calls
- **Styling:** Vanilla CSS (dark theme, Inter + JetBrains Mono)
