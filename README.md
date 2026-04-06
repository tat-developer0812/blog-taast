# WC2026.VN — World Cup 2026 Blog Platform

Vietnamese football blog platform targeting 1M monthly visitors for the 2026 World Cup. Automated content generation, SEO-first architecture, deployed on Vercel.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Data Sources](#api-data-sources)
- [Content Pipeline](#content-pipeline)
- [API Routes](#api-routes)
- [Pages & ISR Strategy](#pages--isr-strategy)
- [SEO](#seo)
- [Performance & Caching](#performance--caching)
- [Cron Jobs](#cron-jobs)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 7.5 |
| Hosting | Vercel (ISR + Cron + Edge) |
| Data Sources | football-data.org, TheSportsDB |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Vercel Edge                        │
│   Cache-Control: s-maxage=300, stale-while-revalidate   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                  Next.js App Router                     │
│   ISR pages: /, /teams, /matches, /predictions, /blog   │
│   Dynamic routes: /teams/[slug], /matches/[slug], ...   │
└──────┬─────────────────────────────────────┬────────────┘
       │                                     │
┌──────▼──────┐                    ┌─────────▼──────────┐
│  Supabase   │                    │   External APIs     │
│  PostgreSQL │◄───────────────────│  football-data.org  │
│  (Prisma)   │   Sync Pipeline    │  TheSportsDB        │
└─────────────┘                    └────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│              Content Generation Pipeline                │
│  Templates: match-preview, prediction, team-history,    │
│             head-to-head → Vietnamese markdown articles │
└─────────────────────────────────────────────────────────┘
```

**Three-layer caching strategy:**
1. **In-memory LRU** — external API calls cached per instance (TTL: 5–60 min)
2. **Next.js ISR** — pages served from CDN, revalidated on schedule or on-demand
3. **Vercel Edge** — `Cache-Control: s-maxage=300` for all public page routes

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended — free tier works)
- football-data.org API key (free: 10 req/min)

### Installation

```bash
npm install
```

### Local development

```bash
# Copy env template and fill in values
cp .env.example .env

# Push schema to database
npm run db:push

# Seed initial data (optional)
npm run seed:all

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase pooling URL) |
| `FOOTBALL_DATA_API_KEY` | Yes | API key from football-data.org |
| `THESPORTSDB_API_KEY` | No | TheSportsDB key (defaults to `"3"` for free tier) |
| `CRON_SECRET` | Yes | Bearer token for authenticating Vercel cron jobs |
| `NEXT_PUBLIC_BASE_URL` | Yes | Production URL, e.g. `https://wc2026.vn` |

Create a `.env` file at the project root:

```bash
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
FOOTBALL_DATA_API_KEY="your_key_here"
THESPORTSDB_API_KEY="3"
CRON_SECRET="generate-a-random-secret-here"
NEXT_PUBLIC_BASE_URL="https://wc2026.vn"
```

> **Security:** Never commit `.env` to git. The `.gitignore` already excludes it.

---

## Database

### Schema

Seven Prisma models:

| Model | Purpose |
|-------|---------|
| `Competition` | World Cup, qualifiers, group stages |
| `Team` | National teams with crest, slug, coach |
| `Player` | Squad members linked to a team |
| `Match` | Fixtures and results with scores |
| `HeadToHead` | Aggregated H2H stats between two teams |
| `Article` | Generated content articles (markdown) |
| `SyncLog` | Audit trail for every data sync operation |

### Key relationships

```
Competition ──< Match >── Team (home)
                    └──── Team (away)
Team ──< Player
Team ──< Article
Match ──< Article
```

### Commands

```bash
npm run db:migrate      # Create and apply a new migration
npm run db:push         # Push schema changes directly (dev only)
npm run db:studio       # Open Prisma Studio GUI
npm run db:generate     # Regenerate Prisma client after schema changes
```

### Seeding

```bash
npm run seed:competitions   # Seed competition records
npm run seed:teams          # Seed team records
npm run seed:matches        # Seed match fixtures
npm run seed:all            # Run all seeds in sequence
```

---

## API Data Sources

The project uses an **adapter pattern** so data sources are interchangeable.

### football-data.org (primary)

- Free tier: 10 requests/minute
- Provides competitions, teams, players, match fixtures & results
- All methods are cached in-memory:

| Method | Cache TTL |
|--------|-----------|
| `getCompetition` | 60 minutes |
| `getTeams` | 30 minutes |
| `getTeamPlayers` | 30 minutes |
| `getMatches` | 5 minutes |

### TheSportsDB (secondary)

- Free tier, no key required
- Used as a fallback for team images and supplementary data

### Adding a new data source

```ts
// src/lib/api-clients/my-source.ts
import { FootballApiClient } from "./types";

export const myClient: FootballApiClient = {
  name: "my-source",
  async getCompetition(id) { /* ... */ },
  async getTeams(competitionId) { /* ... */ },
  async getMatches(competitionId) { /* ... */ },
  async getTeamPlayers(teamId) { /* ... */ },
};

// src/lib/api-clients/index.ts
registerApiClient(myClient);
```

---

## Content Pipeline

Article generation follows this flow:

```
Database (Match / Team / H2H data)
    ↓
Template (Vietnamese markdown)
    ↓
SEO metadata (title, description, slug)
    ↓
Article saved to DB with status "published"
    ↓
ISR page revalidated via revalidatePath()
```

### Article types

| Type | Template | Trigger |
|------|----------|---------|
| `match_preview` | `templates/match-preview.ts` | Per match, pre-game |
| `prediction` | `templates/prediction.ts` | Per match, includes prediction |
| `team_history` | `templates/team-history.ts` | Per team |
| `h2h` | `templates/head-to-head.ts` | Per team pair |

### Manual generation (CLI)

```bash
npm run generate              # All article types
npm run generate:teams        # Team history articles only
npm run generate:matches      # Match preview articles only
npm run generate:h2h          # Head-to-head articles only
```

---

## API Routes

### Public

| Route | Method | Description | Auth | Rate limit |
|-------|--------|-------------|------|-----------|
| `/api/generate` | POST | On-demand article generation | `CRON_SECRET` | 10 req/min per IP |
| `/api/revalidate` | POST | Trigger ISR revalidation for specific paths | `CRON_SECRET` | — |

**POST /api/generate — request body:**

```json
{ "type": "match_preview", "matchId": 123 }
{ "type": "prediction",    "matchId": 123 }
{ "type": "team_history",  "teamId": 456 }
{ "type": "h2h",           "team1Id": 1, "team2Id": 2 }
```

**POST /api/revalidate — request body:**

```json
{ "paths": ["/teams/brazil", "/matches", "/"] }
```

Both endpoints require `Authorization: Bearer <CRON_SECRET>` header.

### Cron (internal)

| Route | Schedule | Description |
|-------|----------|-------------|
| `GET /api/cron/sync-competitions` | Weekly (Mon 00:00 UTC) | Sync competition records |
| `GET /api/cron/sync-teams` | Daily (06:00 UTC) | Sync team data |
| `GET /api/cron/sync-matches` | Every 6 hours | Sync all match fixtures & results |
| `GET /api/cron/sync-matches?mode=live` | Every 15 minutes | Fast sync for live match scores |
| `GET /api/cron/generate-articles?scope=all` | Daily (08:00 UTC) | Generate articles for all content types |

`generate-articles` accepts `scope=all|teams|matches|h2h` to limit scope.

All cron routes respond with `Cache-Control: no-store`.

---

## Pages & ISR Strategy

| Route | Revalidate | Description |
|-------|-----------|-------------|
| `/` | 1 hour | Home: hero, upcoming matches, latest articles |
| `/teams` | 24 hours | Team listing |
| `/teams/[slug]` | 1 hour | Team detail: roster, history, stats |
| `/matches` | 30 minutes | All fixtures and results |
| `/matches/[slug]` | 30 minutes | Match detail: score, article |
| `/predictions` | 1 hour | Prediction articles listing |
| `/predictions/[slug]` | 1 hour | Individual prediction |
| `/blog` | 30 minutes | All articles listing |
| `/world-cup` | 24 hours | Tournament info (static) |

Dynamic routes use `generateStaticParams` for pre-rendering known slugs at build time.

---

## SEO

### Metadata

- **Language:** Vietnamese (`lang="vi"`, `locale: vi_VN`)
- **Base URL:** Configured via `NEXT_PUBLIC_BASE_URL`
- **Title template:** `"Page Title | World Cup 2026"`
- **OpenGraph:** Article type with crest images for team/match pages
- **Twitter Card:** `summary_large_image`
- **Canonical URLs:** Set on all pages

### Structured data (JSON-LD)

| Schema | Pages |
|--------|-------|
| `Article` | Article/prediction detail pages |
| `SportsEvent` | Match detail pages (`EventPast` for finished matches) |
| `SportsTeam` | Team detail pages |
| `BreadcrumbList` | All detail pages |

### Sitemap & robots

- `/sitemap.xml` — dynamically generated from DB (teams, matches, articles)
- `/robots.txt` — allows all crawlers, points to sitemap

---

## Performance & Caching

### In-memory LRU cache (`src/lib/cache.ts`)

- Max 500 entries, LRU eviction (promote-on-read via Map ordering)
- TTL expiry checked at read time
- Use the `cached()` helper for cache-through:

```ts
const data = await cached("key", 60_000, () => fetchExpensiveData());
```

### Sliding-window rate limiter (`src/lib/rate-limit.ts`)

- Stores individual request timestamps per key (true sliding window)
- Periodic cleanup prevents memory leaks

```ts
const { success, remaining } = rateLimit(`ip:${clientIp}`, 10, 60_000);
```

### Edge caching

Configured in `next.config.mjs` via `headers()`:

```
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

Applied to: `/`, `/teams/*`, `/matches/*`, `/predictions/*`, `/blog/*`, `/world-cup/*`

### On-demand revalidation

After each cron sync, `revalidatePath()` is called automatically:

| Cron | Revalidates |
|------|------------|
| `sync-matches` | `/`, `/matches` |
| `sync-teams` | `/`, `/teams` |
| `generate-articles` | `/`, `/blog`, `/predictions` |

---

## Cron Jobs

All schedules are UTC, defined in `vercel.json`:

| Job | Schedule | Reason |
|-----|----------|--------|
| sync-competitions | Mon 00:00 | Competition data rarely changes |
| sync-teams | Daily 06:00 | Squad/coach updates |
| sync-matches | Every 6h | Fixture results |
| sync-matches (live) | Every 15min | Live scores |
| generate-articles | Daily 08:00 | Fresh content |

Vercel injects `Authorization: Bearer <CRON_SECRET>` automatically on production.

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import project in Vercel dashboard
3. Add environment variables (Settings → Environment Variables):
   - `DATABASE_URL`
   - `FOOTBALL_DATA_API_KEY`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_BASE_URL`
4. Deploy — cron jobs activate automatically from `vercel.json`

### First-time database setup

```bash
# Apply migrations to production DB
npx prisma migrate deploy

# Seed initial data
npm run seed:all
```

---

## Project Structure

```
blog-taast/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/
│   │   │   ├── cron/               # Scheduled sync & generation endpoints
│   │   │   ├── generate/           # On-demand article generation
│   │   │   └── revalidate/         # ISR revalidation webhook
│   │   ├── blog/                   # Blog listing
│   │   ├── matches/                # Listing + [slug] detail
│   │   ├── predictions/            # Listing + [slug] detail
│   │   ├── teams/                  # Listing + [slug] detail
│   │   ├── world-cup/              # Tournament info
│   │   ├── layout.tsx              # Root layout + global metadata
│   │   ├── page.tsx                # Home page
│   │   ├── robots.ts               # /robots.txt
│   │   └── sitemap.ts              # /sitemap.xml
│   ├── components/
│   │   ├── article-card.tsx
│   │   ├── match-card.tsx
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── json-ld.tsx             # JSON-LD script injector
│   │   └── markdown-renderer.tsx
│   ├── lib/
│   │   ├── api-clients/            # Football API adapters
│   │   │   ├── types.ts            # FootballApiClient interface
│   │   │   ├── football-data.ts    # football-data.org (primary)
│   │   │   ├── thesportsdb.ts      # TheSportsDB (secondary)
│   │   │   └── index.ts            # Client registry
│   │   ├── content/                # Content generation
│   │   │   ├── generator.ts        # Orchestrator
│   │   │   ├── seo.ts              # SEO metadata helpers
│   │   │   ├── types.ts
│   │   │   └── templates/          # Vietnamese article templates
│   │   ├── sync/                   # Data sync functions
│   │   │   ├── sync-competitions.ts
│   │   │   ├── sync-teams.ts
│   │   │   ├── sync-matches.ts
│   │   │   ├── with-logging.ts     # SyncLog wrapper
│   │   │   └── index.ts
│   │   ├── seo/json-ld.ts          # schema.org JSON-LD builders
│   │   ├── cache.ts                # In-memory LRU TTL cache
│   │   ├── rate-limit.ts           # Sliding-window rate limiter
│   │   ├── cron-auth.ts            # Bearer token auth
│   │   ├── db.ts                   # Prisma singleton
│   │   └── utils/slug.ts
│   └── middleware.ts               # Edge middleware (pass-through)
├── prisma/schema.prisma            # Database schema
├── scripts/                        # CLI seed & generation scripts
├── docs/plans/                     # Phase implementation plans
├── next.config.mjs                 # Image config, Cache-Control headers
├── prisma.config.ts                # Prisma datasource config
├── vercel.json                     # Cron job definitions
└── tsconfig.json
```
