# Full-Text Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Add PostgreSQL native full-text search across articles, teams, and matches with a Vietnamese-friendly `simple` dictionary, surfaced at `/search?q=...`.

**Architecture:** Use `to_tsvector('simple', ...)` + `plainto_tsquery('simple', ...)` via Prisma `$queryRaw` — no external service required, stays entirely within the Supabase/PostgreSQL stack. GIN indexes on the searched columns keep query time under 50 ms even at scale. A single API route `/api/search` handles all entity types with a `type` filter, and the search results page uses Next.js `Suspense` + URL-state so results are shareable and crawlable.

**Tech Stack:** PostgreSQL (tsvector / GIN index), Prisma `$queryRaw`, Next.js 14 App Router (Server Components + Suspense), TailwindCSS, `src/lib/rate-limit.ts` sliding-window limiter.

---

## Task 1 — Add GIN indexes via Prisma migration

**Why:** `to_tsvector` queries do a full-table scan without a GIN index. Adding indexes at the DB level is permanent and benefits every future query.

### 1a. Edit `prisma/schema.prisma`

**Modify:** `prisma/schema.prisma`

Add one raw index block to each of the three models. Prisma exposes `@@index` but does not support `USING GIN` directly, so we use `@@index` with a map and then apply the `USING GIN` via a manual SQL migration step (Task 1b).

Add the following `@@index` lines inside each model's closing `}`:

Inside `model Article` (after the existing `@@index([slug])`):
```prisma
  @@index([title, excerpt], map: "articles_fts_idx")
```

Inside `model Team` (before `@@map("teams")`):
```prisma
  @@index([name], map: "teams_fts_idx")
```

Inside `model Match` (before `@@map("matches")`):
```prisma
  @@index([slug], map: "matches_fts_idx")
```

> These Prisma `@@index` declarations are placeholders that prevent Prisma from dropping the indexes during future `prisma migrate dev` runs. The actual GIN index creation happens in Task 1b via raw SQL.

### 1b. Create a manual SQL migration file

**Create:** `prisma/migrations/20260406000000_add_fts_gin_indexes/migration.sql`

```sql
-- Full-text search GIN indexes for Article, Team, Match
-- Uses 'simple' dictionary: no stemming, works for Vietnamese text

-- Article: search on title + excerpt
CREATE INDEX CONCURRENTLY IF NOT EXISTS articles_fts_gin_idx
  ON articles
  USING GIN (to_tsvector('simple', title || ' ' || COALESCE(excerpt, '')));

-- Team: search on name
CREATE INDEX CONCURRENTLY IF NOT EXISTS teams_fts_gin_idx
  ON teams
  USING GIN (to_tsvector('simple', name));

-- Match: search on slug (contains team TLAs and date, e.g. "bra-arg-2026-06-15")
CREATE INDEX CONCURRENTLY IF NOT EXISTS matches_fts_gin_idx
  ON matches
  USING GIN (to_tsvector('simple', slug));
```

### 1c. Apply the migration

Run from the project root:

```bash
npx prisma migrate dev --name add_fts_gin_indexes
```

**Expected output:**
```
Applying migration `20260406000000_add_fts_gin_indexes`
Your database is now in sync with your schema.
```

If the Supabase DB does not allow `CONCURRENTLY` inside a transaction, apply the SQL directly via the Supabase SQL editor instead and mark the migration as applied:

```bash
npx prisma migrate resolve --applied 20260406000000_add_fts_gin_indexes
```

---

## Task 2 — Create `src/lib/search.ts`

**Create:** `src/lib/search.ts`

This module exports three typed search functions using `$queryRaw`. The `simple` dictionary is hardcoded so it never changes without an intentional code change.

```ts
import { prisma } from "@/lib/db";

// ---- Shared sanitiser -------------------------------------------------------
// plainto_tsquery handles multi-word input, but we still strip characters that
// could cause parse errors in edge cases (e.g. bare colons, backslashes).
function sanitise(q: string): string {
  return q.trim().replace(/[\\:*!'"]/g, " ").replace(/\s+/g, " ").slice(0, 200);
}

// ---- Result types -----------------------------------------------------------

export interface ArticleSearchResult {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  type: string;
  publishedAt: Date | null;
  rank: number;
}

export interface TeamSearchResult {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  slug: string;
  area: string | null;
  crest: string | null;
  rank: number;
}

export interface MatchSearchResult {
  id: number;
  slug: string;
  status: string;
  utcDate: Date;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamName: string;
  awayTeamName: string;
  rank: number;
}

// ---- Search functions -------------------------------------------------------

export async function searchArticles(q: string): Promise<ArticleSearchResult[]> {
  const query = sanitise(q);
  if (!query) return [];

  return prisma.$queryRaw<ArticleSearchResult[]>`
    SELECT
      a.id,
      a.title,
      a.slug,
      a.excerpt,
      a.type,
      a.published_at AS "publishedAt",
      ts_rank(
        to_tsvector('simple', a.title || ' ' || COALESCE(a.excerpt, '')),
        plainto_tsquery('simple', ${query})
      ) AS rank
    FROM articles a
    WHERE
      to_tsvector('simple', a.title || ' ' || COALESCE(a.excerpt, ''))
        @@ plainto_tsquery('simple', ${query})
      AND a.status = 'published'
    ORDER BY rank DESC
    LIMIT 20
  `;
}

export async function searchTeams(q: string): Promise<TeamSearchResult[]> {
  const query = sanitise(q);
  if (!query) return [];

  return prisma.$queryRaw<TeamSearchResult[]>`
    SELECT
      t.id,
      t.name,
      t.short_name AS "shortName",
      t.tla,
      t.slug,
      t.area,
      t.crest,
      ts_rank(
        to_tsvector('simple', t.name),
        plainto_tsquery('simple', ${query})
      ) AS rank
    FROM teams t
    WHERE
      to_tsvector('simple', t.name)
        @@ plainto_tsquery('simple', ${query})
    ORDER BY rank DESC
    LIMIT 20
  `;
}

export async function searchMatches(q: string): Promise<MatchSearchResult[]> {
  const query = sanitise(q);
  if (!query) return [];

  return prisma.$queryRaw<MatchSearchResult[]>`
    SELECT
      m.id,
      m.slug,
      m.status,
      m.utc_date     AS "utcDate",
      m.home_score   AS "homeScore",
      m.away_score   AS "awayScore",
      ht.name        AS "homeTeamName",
      at2.name       AS "awayTeamName",
      ts_rank(
        to_tsvector('simple', m.slug),
        plainto_tsquery('simple', ${query})
      ) AS rank
    FROM matches m
    JOIN teams ht  ON ht.id  = m.home_team_id
    JOIN teams at2 ON at2.id = m.away_team_id
    WHERE
      to_tsvector('simple', m.slug)
        @@ plainto_tsquery('simple', ${query})
    ORDER BY rank DESC
    LIMIT 20
  `;
}
```

**Verification:** No CLI command needed yet — TypeScript will validate in Task 6.

---

## Task 3 — Create `GET /api/search/route.ts`

**Create:** `src/app/api/search/route.ts`

Parses `q` and `type` query params, delegates to the search functions, applies a 20 req/min rate limit per IP.

```ts
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { searchArticles, searchTeams, searchMatches } from "@/lib/search";

export const runtime = "nodejs"; // needs Prisma

export async function GET(req: NextRequest) {
  // Rate limit: 20 requests per minute per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const { success } = rateLimit(`search:${ip}`, 20, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const type = searchParams.get("type") ?? "all"; // all | articles | teams | matches

  if (!q || q.length < 2) {
    return NextResponse.json(
      { articles: [], teams: [], matches: [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const [articles, teams, matches] = await Promise.all([
      type === "all" || type === "articles" ? searchArticles(q) : [],
      type === "all" || type === "teams"    ? searchTeams(q)    : [],
      type === "all" || type === "matches"  ? searchMatches(q)  : [],
    ]);

    return NextResponse.json(
      { articles, teams, matches },
      {
        headers: {
          // Results are user-specific / ephemeral — do not cache at CDN
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("[search] query failed:", err);
    return NextResponse.json(
      { error: "Search temporarily unavailable." },
      { status: 500 }
    );
  }
}
```

**Manual test after deploying locally:**
```bash
curl "http://localhost:3000/api/search?q=Brazil&type=teams"
# Expected: { articles: [], teams: [{ id: ..., name: "Brazil", ... }], matches: [] }
```

---

## Task 4 — Create `src/app/search/page.tsx`

**Create:** `src/app/search/page.tsx`

Server Component that reads `?q=` from `searchParams`, runs the search server-side (no client JS required for initial render), and renders tabbed results. Uses `Suspense` so slow DB queries don't block the shell.

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { searchArticles, searchTeams, searchMatches } from "@/lib/search";
import { ArticleCard } from "@/components/article-card";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Kết quả tìm kiếm: "${q}" — WC2026` : "Tìm kiếm — WC2026",
    description: "Tìm kiếm bài viết, đội tuyển và trận đấu World Cup 2026.",
    robots: { index: false }, // search result pages should not be indexed
  };
}

// ---- Sub-components (each can be individually suspended) --------------------

async function ArticleResults({ q }: { q: string }) {
  const articles = await searchArticles(q);
  if (articles.length === 0)
    return <p className="text-[var(--muted)]">Không tìm thấy bài viết nào.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <ArticleCard
          key={a.id}
          title={a.title}
          excerpt={a.excerpt}
          slug={a.slug}
          type={a.type}
          publishedAt={a.publishedAt}
        />
      ))}
    </div>
  );
}

async function TeamResults({ q }: { q: string }) {
  const teams = await searchTeams(q);
  if (teams.length === 0)
    return <p className="text-[var(--muted)]">Không tìm thấy đội tuyển nào.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((t) => (
        <li key={t.id}>
          <Link
            href={`/teams/${t.slug}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-4 transition-shadow hover:shadow-md"
          >
            {t.crest && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.crest} alt={t.name} className="h-8 w-8 object-contain" />
            )}
            <div>
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-[var(--muted)]">
                {t.tla} {t.area ? `· ${t.area}` : ""}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function MatchResults({ q }: { q: string }) {
  const matches = await searchMatches(q);
  if (matches.length === 0)
    return <p className="text-[var(--muted)]">Không tìm thấy trận đấu nào.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((m) => (
        <li key={m.id}>
          <Link
            href={`/matches/${m.slug}`}
            className="block rounded-xl border border-[var(--border)] p-4 transition-shadow hover:shadow-md"
          >
            <p className="font-semibold">
              {m.homeTeamName} vs {m.awayTeamName}
            </p>
            {(m.homeScore !== null && m.awayScore !== null) && (
              <p className="text-lg font-bold tabular-nums">
                {m.homeScore} — {m.awayScore}
              </p>
            )}
            <p className="text-xs text-[var(--muted)]">
              {new Intl.DateTimeFormat("vi-VN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Ho_Chi_Minh",
              }).format(new Date(m.utcDate))}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---- Loading skeleton -------------------------------------------------------

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl bg-[var(--card)]"
        />
      ))}
    </div>
  );
}

// ---- Search form (client interaction via full-page navigation) ---------------

function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form method="GET" action="/search" className="mb-8">
      <div className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Tìm kiếm đội tuyển, trận đấu, bài viết..."
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
          autoFocus
          minLength={2}
          maxLength={200}
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
        >
          Tìm
        </button>
      </div>
    </form>
  );
}

// ---- Tab bar (full-page navigation links) -----------------------------------

const TABS = [
  { value: "all",      label: "Tất cả"    },
  { value: "articles", label: "Bài viết"  },
  { value: "teams",    label: "Đội tuyển" },
  { value: "matches",  label: "Trận đấu"  },
];

function TabBar({ q, activeTab }: { q: string; activeTab: string }) {
  return (
    <div className="mb-6 flex gap-1 border-b border-[var(--border)]">
      {TABS.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <Link
            key={tab.value}
            href={`/search?q=${encodeURIComponent(q)}&type=${tab.value}`}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

// ---- Page -------------------------------------------------------------------

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q = "", type = "all" } = await searchParams;
  const activeTab = TABS.some((t) => t.value === type) ? type : "all";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Tìm kiếm</h1>

      <SearchForm defaultValue={q} />

      {q.length >= 2 ? (
        <>
          <TabBar q={q} activeTab={activeTab} />

          {(activeTab === "all" || activeTab === "articles") && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Bài viết</h2>
              <Suspense fallback={<ResultsSkeleton />}>
                <ArticleResults q={q} />
              </Suspense>
            </section>
          )}

          {(activeTab === "all" || activeTab === "teams") && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Đội tuyển</h2>
              <Suspense fallback={<ResultsSkeleton />}>
                <TeamResults q={q} />
              </Suspense>
            </section>
          )}

          {(activeTab === "all" || activeTab === "matches") && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Trận đấu</h2>
              <Suspense fallback={<ResultsSkeleton />}>
                <MatchResults q={q} />
              </Suspense>
            </section>
          )}
        </>
      ) : (
        <p className="text-[var(--muted)]">
          Nhập ít nhất 2 ký tự để bắt đầu tìm kiếm.
        </p>
      )}
    </div>
  );
}
```

---

## Task 5 — Add search box to `src/components/header.tsx`

**Modify:** `src/components/header.tsx`

The header is a Server Component, so the search box must navigate via a form `GET` submission (no `useState` needed). Add the form between the logo and the nav links.

Replace the entire file content with:

```tsx
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Trang chủ" },
  { href: "/teams", label: "Đội tuyển" },
  { href: "/matches", label: "Lịch thi đấu" },
  { href: "/predictions", label: "Dự đoán" },
  { href: "/blog", label: "Tin tức" },
  { href: "/world-cup", label: "World Cup" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="text-2xl font-bold text-[var(--primary)]">
              WC2026
            </span>
            <span className="hidden text-sm text-[var(--muted)] sm:inline">
              World Cup 2026
            </span>
          </Link>

          {/* Search box */}
          <form
            method="GET"
            action="/search"
            className="hidden flex-1 max-w-xs sm:flex"
          >
            <input
              type="search"
              name="q"
              placeholder="Tìm kiếm..."
              minLength={2}
              maxLength={200}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </form>

          {/* Nav */}
          <nav className="ml-auto flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              >
                {item.label}
              </Link>
            ))}
            {/* Mobile search icon link */}
            <Link
              href="/search"
              aria-label="Tìm kiếm"
              className="sm:hidden rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--card)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
```

---

## Task 6 — TypeScript check + verification

### 6a. Run TypeScript compiler

```bash
npx tsc --noEmit
```

**Expected output:** No errors. If type errors appear in the `$queryRaw` results (Prisma returns `unknown` for raw queries), cast the return type or add the correct column aliases as shown in Task 2.

### 6b. Run Next.js dev server and verify manually

```bash
npm run dev
```

Visit `http://localhost:3000/search?q=Brazil` — expect:
- Teams section shows Brazil card
- Articles section shows any Brazil-related published articles
- Matches section shows matches whose slug contains "bra"

Visit `http://localhost:3000/search?q=Brazil&type=teams` — expect only the Teams tab to be active, only team results shown.

Test the header search box: type "arg" and press Enter — expect redirect to `/search?q=arg`.

### 6c. Test rate limiter

```bash
for i in $(seq 1 22); do
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/search?q=test"
done
```

**Expected output:** 20 lines of `200`, followed by at least 2 lines of `429`.

---

## Git commit

```bash
git add \
  prisma/schema.prisma \
  "prisma/migrations/20260406000000_add_fts_gin_indexes/migration.sql" \
  src/lib/search.ts \
  src/app/api/search/route.ts \
  src/app/search/page.tsx \
  src/components/header.tsx

git commit -m "feat: add PostgreSQL full-text search for articles, teams, and matches

- GIN-indexed tsvector on articles, teams, matches tables (simple dictionary)
- src/lib/search.ts with searchArticles / searchTeams / searchMatches
- GET /api/search route with 20 req/min rate limiting
- /search page with tabbed results (All / Articles / Teams / Matches)
- Search box added to header (desktop inline, mobile icon link)
- Vietnamese-friendly: 'simple' dictionary = no stemming, pure tokenisation"
```
