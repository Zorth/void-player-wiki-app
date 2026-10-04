# The Void Player Wiki App

A high-performance living world campaign wiki and knowledge base for **The Void**, integrated directly with the [Tarragon Guild API](https://guild.tarragon.be) and backed by an Obsidian-compatible local Markdown vault.

---

## Architecture Overview

```
                                      +-------------------------------+
                                      |      Tarragon Guild API       |
                                      |   (guild.tarragon.be/api/v1)  |
                                      +---------------+---------------+
                                                      |
                                           OIDC Auth  |  Live Sync
                                           & Profiles |  (Sessions & Characters)
                                                      v
+-------------------------------+     +-------------------------------+
|     Local Markdown Vault      |<--->|       Next.js 14 Web App      |
|  (/data/vault / Obsidian)     |     |   (Standalone Production)     |
| - World Notes/                |     +---------------+---------------+
| - Session Reports/            |                     |
| - Player Characters/          |                     v
| - _META/ (Rules & Guidelines) |     +-------------------------------+
| - Attachments/                |     |    Local SQLite (wiki.db)     |
+-------------------------------+     |  - Comments & Permissions     |
                                      +-------------------------------+
```

The system is designed with a **file-first architecture**:
1. **Markdown Vault (`/data/vault`)**: The authoritative source of truth for all campaign notes, lore, character backstories, and session debriefs. Standard Obsidian frontmatter, callouts (`> [!note]`), LaTeX math (`$$...$$`), and wikilinks (`[[Note|Alias]]`) are fully parsed and rendered.
2. **Guild Platform Integration**: Live synchronization of player characters, session attendees, GM assignments, quest tracking, and interactive world map embeds.
3. **SQLite Database (`data/wiki.db`)**: Lightweight, persistent storage for user permission flags (edit access) and article comment threads.

---

## Performance Optimizations

The application implements multi-tier performance enhancements ensuring fast page loads (<100ms) and responsive search:

### 1. In-Memory Vault Index & Caching
- **Cached Memory Index**: Vault files are indexed into an in-memory structure with pre-sorted arrays and $O(1)$ lookup maps (`bySlug`, `byWorld`, `byTag`, `titleToSlugMap`, and `attachments`).
- **Zero Redundant Disk Reads**: Requests to note pages, search, and character rosters resolve from memory in $<1\text{ms}$ rather than synchronously scanning and parsing 280+ markdown files on disk.
- **Instant Invalidation**: Edits made through the web editor (`saveNote`) and automated Guild sync jobs immediately bust the cache (`invalidateVaultCache()`), ensuring zero stale reads while preserving background freshness (30-second fallback TTL).
- **In-Memory Attachment Cache**: Resolves character portraits and media embeds across multiple attachment directories without synchronous filesystem walks.

### 2. Concurrent Data Fetching
- Parallel execution of external Guild API calls and local data queries via `Promise.all([getSession(), getGuildWorlds(), getGuildSessions(), getGuildQuests()])` across Home, World, and Session views.
- Guild API responses are cached in memory with a 5-minute TTL to respect upstream rate limits.

### 3. Real-Time Client-Side Link Autocomplete
- When drafting content in the Web Editor, note titles and aliases are fetched once on mount.
- Real-time fuzzy link detection (Levenshtein distance $\le 1$ and trailing phrase matching) executes 100% client-side with a 60ms debounce. Keystrokes generate **zero** server requests or disk I/O.
- Press **`Tab`** or click suggestions to instantly insert internal wikilinks.

### 4. Database & HTTP Optimizations
- **SQLite WAL Mode**: Enabled `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = NORMAL;`, and `PRAGMA temp_store = MEMORY;` in `db.ts` for fast concurrent read/write operations without table locking.
- **Production Asset Compression**: Enabled `compress: true` and `poweredByHeader: false` in `next.config.mjs`.
- **Immutable Attachment Caching**: Attachments served with `Cache-Control: public, max-age=31536000, immutable` headers.

---

## Directory Structure

```
├── data/                      # App data directory (mounted in Docker)
│   ├── wiki.db                # SQLite database (comments & permissions)
│   └── last-sync.json         # Timestamp & stats of last Guild sync
├── public/                    # Static assets & icons
├── scripts/
│   └── sync-guild.js          # Standalone background sync script
├── src/
│   ├── app/                   # Next.js 14 App Router routes
│   │   ├── api/               # REST API endpoints (notes, comments, auth, search)
│   │   ├── characters/        # Character roster synchronized with Guild
│   │   ├── editor/            # Markdown editor with preview & fuzzy linking
│   │   ├── notes/[slug]/      # Article viewing, backlinks, and comments
│   │   ├── rules/             # Four-pillar rules hub & compendium index
│   │   ├── sessions/          # Chronological session reports & filter
│   │   └── worlds/[world]/    # Unified campaign world landing pages & maps
│   ├── components/            # Shared UI components (Navigation, Search, Comments)
│   └── lib/
│       ├── auth.ts            # OIDC authentication & JWT session management
│       ├── constants.ts       # Known campaign worlds & name formatters
│       ├── db.ts              # SQLite database connection & schema
│       ├── guild.ts           # Tarragon Guild API client
│       ├── sync.ts            # Bi-directional Guild sync logic
│       └── vault.ts           # Vault parsing, indexing, caching, and markdown renderer
├── docker-compose.yml         # Container specification
├── Dockerfile                 # Standalone multi-stage Next.js Docker build
└── next.config.mjs            # Next.js production configuration
```

---

## Development & Setup

### Prerequisites
- Node.js 20+ (Node 22 recommended)
- Access to the local or network-mounted Markdown vault

### Environment Variables (`.env`)
```bash
# Vault Location
VAULT_PATH=/mnt/whale/07_NOTES_WORKING/void_player_wiki

# SQLite Database Location
DB_PATH=/thor-server/apps/void-player-wiki-app/data/wiki.db

# Authentication / OIDC Configuration
SESSION_SECRET=your_long_random_session_secret
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_ISSUER=https://auth.tarragon.be
NEXT_PUBLIC_APP_URL=http://localhost:3005
```

### Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build production bundle
npm run build

# Start production server
npm run start
```

---

## Deployment (Docker)

The application is deployed using Docker Compose with standalone Next.js output:

```bash
# Build and start container in background
docker compose up -d --build

# View container logs
docker compose logs -f wiki-app

# Restart service
docker compose restart wiki-app
```

The container mounts:
- Vault storage: `/mnt/whale/07_NOTES_WORKING/void_player_wiki -> /data/vault`
- App database: `/thor-server/apps/void-player-wiki-app/data -> /data/app`
- Exposed port: `3005` (mapped to internal `3000`)
