# Live Scores Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Show real-time score updates for in-progress matches by polling `/api/live-scores` every 30 seconds, with a pulsing "TRỰC TIẾP" badge on live match cards.

**Architecture:** A lightweight `GET /api/live-scores` route reads `IN_PLAY` and `PAUSED` matches directly from the DB (no cache, `Cache-Control: no-store`) and returns them as JSON. A custom `useLiveScores` React hook polls the route every 30 seconds on the client, pausing automatically when the browser tab is hidden to avoid wasted requests. The homepage and matches page remain ISR Server Components; they receive the initial static data from the server and the hook overlays live score updates in the client without re-rendering the whole page.

**Tech Stack:** Next.js 14 App Router (Server Components for static shell, Client Components for live overlay), React hooks (`useState`, `useEffect`), PostgreSQL via Prisma, TailwindCSS (`animate-pulse`), Vercel serverless (no WebSocket needed).

---

## Task 1 — Create `GET /api/live-scores/route.ts`

**Create:** `src/app/api/live-scores/route.ts`

Queries the DB for all matches with status `IN_PLAY` or `PAUSED`, returns them as JSON. Response must not be cached at any layer.

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
// Opt out of Next.js Data Cache — live data must always be fresh
export const dynamic = "force-dynamic";

export interface LiveMatch {
  id: number;
  slug: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: number;
  awayTeamId: number;
  updatedAt: Date;
}

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      where: {
        status: { in: ["IN_PLAY", "PAUSED"] },
      },
      select: {
        id: true,
        slug: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeamId: true,
        awayTeamId: true,
        updatedAt: true,
      },
      orderBy: { utcDate: "asc" },
    });

    return NextResponse.json(matches, {
      headers: {
        // Prevent CDN and browser from caching live data
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[live-scores] DB query failed:", err);
    return NextResponse.json(
      { error: "Live scores temporarily unavailable." },
      { status: 500 }
    );
  }
}
```

**Manual test:**
```bash
curl -I http://localhost:3000/api/live-scores
# Expect: Cache-Control: no-store, max-age=0
curl http://localhost:3000/api/live-scores
# Expect: [] when no matches are IN_PLAY, or array of live match objects
```

---

## Task 2 — Create `src/hooks/useLiveScores.ts`

**Create:** `src/hooks/useLiveScores.ts`

Custom React hook that:
- Fetches `/api/live-scores` immediately on mount
- Polls every 30 seconds
- Pauses polling when the tab is hidden (`visibilitychange`), resumes when it becomes visible
- Cleans up all timers and listeners on unmount

```ts
"use client";

import { useState, useEffect } from "react";

export interface LiveMatch {
  id: number;
  slug: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: number;
  awayTeamId: number;
  updatedAt: string; // ISO string from JSON parse
}

export function useLiveScores() {
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch("/api/live-scores");
        if (res.ok) {
          const data: LiveMatch[] = await res.json();
          setLiveMatches(data);
        }
      } catch {
        // Silently ignore network errors — stale data stays visible
      }
    };

    const startPolling = () => {
      if (intervalId !== null) return; // already running
      poll();
      intervalId = setInterval(poll, 30_000);
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return liveMatches;
}
```

> **Note on the spec hook:** The hook provided in the brief restarts the interval inside `handleVisibilityChange` using the already-cleared `id` from the outer closure, which means the new interval is never stored and cannot be cleared on unmount. The version above fixes that by tracking `intervalId` as a mutable variable inside the effect rather than a `const` from `setInterval`.

---

## Task 3 — Update `src/components/match-card.tsx`

**Modify:** `src/components/match-card.tsx`

Add an optional `isLive` prop. When `true`, overlay a pulsing red dot and "TRỰC TIẾP" badge. Also accept optional `liveHomeScore` / `liveAwayScore` props so the parent can pass real-time scores without re-fetching the whole card.

Replace the entire file with:

```tsx
import Link from "next/link";

interface MatchCardProps {
  slug: string;
  homeTeam: string;
  awayTeam: string;
  homeTla: string | null;
  awayTla: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  utcDate: Date;
  stage: string | null;
  group: string | null;
  // Live overlay props — provided by useLiveScores hook
  isLive?: boolean;
  liveHomeScore?: number | null;
  liveAwayScore?: number | null;
  liveStatus?: string;
}

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Vòng bảng",
  ROUND_OF_16: "Vòng 1/16",
  QUARTER_FINALS: "Tứ kết",
  SEMI_FINALS: "Bán kết",
  THIRD_PLACE: "Tranh hạng 3",
  FINAL: "Chung kết",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Sắp diễn ra",
  TIMED: "Sắp diễn ra",
  LIVE: "Đang diễn ra",
  IN_PLAY: "Đang diễn ra",
  PAUSED: "Giải lao",
  FINISHED: "Kết thúc",
  POSTPONED: "Hoãn",
  CANCELLED: "Hủy",
};

export function MatchCard({
  slug,
  homeTeam,
  awayTeam,
  homeTla,
  awayTla,
  homeScore,
  awayScore,
  status,
  utcDate,
  stage,
  group,
  isLive = false,
  liveHomeScore,
  liveAwayScore,
  liveStatus,
}: MatchCardProps) {
  // Prefer live data from the hook over the static ISR data
  const effectiveStatus = liveStatus ?? status;
  const effectiveHomeScore = liveHomeScore !== undefined ? liveHomeScore : homeScore;
  const effectiveAwayScore = liveAwayScore !== undefined ? liveAwayScore : awayScore;

  const displayLive =
    isLive ||
    effectiveStatus === "LIVE" ||
    effectiveStatus === "IN_PLAY";
  const isFinished = effectiveStatus === "FINISHED";
  const isPaused = effectiveStatus === "PAUSED";

  const stageLabel = stage ? STAGE_LABELS[stage] || stage : "";
  const statusLabel = STATUS_LABELS[effectiveStatus] || effectiveStatus;

  const dateStr = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(utcDate);

  return (
    <Link
      href={`/matches/${slug}`}
      className="group relative block rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 transition-shadow hover:shadow-lg"
    >
      {/* Live badge */}
      {(displayLive || isPaused) && (
        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {displayLive && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          )}
          {isPaused ? "GIẢI LAO" : "TRỰC TIẾP"}
        </span>
      )}

      <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          {stageLabel}
          {group ? ` - ${group}` : ""}
        </span>
        <span
          className={
            displayLive
              ? "font-semibold text-red-500"
              : isFinished
                ? "text-[var(--accent)]"
                : ""
          }
        >
          {displayLive || isPaused ? statusLabel : statusLabel}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-right">
          <p className="text-sm font-medium">{homeTla || homeTeam}</p>
          <p className="text-xs text-[var(--muted)]">{homeTeam}</p>
        </div>

        <div className="flex min-w-[80px] items-center justify-center gap-2 text-center">
          {isFinished || displayLive || isPaused ? (
            <span
              className={`text-2xl font-bold tabular-nums ${
                displayLive ? "text-red-600" : ""
              }`}
            >
              {effectiveHomeScore} - {effectiveAwayScore}
            </span>
          ) : (
            <span className="text-sm text-[var(--muted)]">{dateStr}</span>
          )}
        </div>

        <div className="flex-1 text-left">
          <p className="text-sm font-medium">{awayTla || awayTeam}</p>
          <p className="text-xs text-[var(--muted)]">{awayTeam}</p>
        </div>
      </div>
    </Link>
  );
}
```

---

## Task 4 — Update `src/app/matches/page.tsx`

**Modify:** `src/app/matches/page.tsx`

The page stays a Server Component (ISR, `revalidate = 1800`). Extract the match grid into a new `"use client"` wrapper component that receives the static matches and overlays live scores from `useLiveScores`.

Replace the entire file with:

```tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { MatchesClientGrid } from "./matches-client-grid";

export const metadata: Metadata = {
  title: "Lịch thi đấu World Cup 2026",
  description:
    "Lịch thi đấu đầy đủ World Cup 2026. Xem tất cả trận đấu, tỷ số và kết quả.",
};

export const revalidate = 1800; // 30 minutes

const STAGE_ORDER = [
  "GROUP_STAGE",
  "ROUND_OF_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

export const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Vòng bảng",
  ROUND_OF_16: "Vòng 1/16",
  QUARTER_FINALS: "Tứ kết",
  SEMI_FINALS: "Bán kết",
  THIRD_PLACE: "Tranh hạng 3",
  FINAL: "Chung kết",
};

export default async function MatchesPage() {
  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true },
    orderBy: { utcDate: "asc" },
  });

  // Group by stage for the server-rendered shell
  const grouped: Record<string, typeof matches> = {};
  for (const match of matches) {
    const stage = match.stage || "OTHER";
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(match);
  }

  const orderedStages = STAGE_ORDER.filter((s) => grouped[s]);
  if (grouped["OTHER"]) orderedStages.push("OTHER");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Lịch thi đấu World Cup 2026</h1>
      <p className="mb-8 text-[var(--muted)]">
        {matches.length} trận đấu | Giờ Việt Nam (UTC+7)
      </p>

      {/* Client component handles live-score polling and rendering */}
      <MatchesClientGrid
        grouped={grouped}
        orderedStages={orderedStages}
        stageLabelMap={STAGE_LABELS}
      />

      {matches.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="text-lg text-[var(--muted)]">
            Lịch thi đấu chưa được cập nhật. Vui lòng quay lại sau.
          </p>
        </div>
      )}
    </div>
  );
}
```

**Create:** `src/app/matches/matches-client-grid.tsx`

```tsx
"use client";

import { useLiveScores } from "@/hooks/useLiveScores";
import { MatchCard } from "@/components/match-card";

interface StaticMatch {
  id: number;
  slug: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: { name: string; tla: string | null };
  awayTeam: { name: string; tla: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  utcDate: Date;
  stage: string | null;
  group: string | null;
}

interface Props {
  grouped: Record<string, StaticMatch[]>;
  orderedStages: string[];
  stageLabelMap: Record<string, string>;
}

export function MatchesClientGrid({ grouped, orderedStages, stageLabelMap }: Props) {
  const liveMatches = useLiveScores();

  // Build a lookup map from match id -> live data for O(1) access
  const liveById = new Map(liveMatches.map((m) => [m.id, m]));

  return (
    <>
      {orderedStages.map((stage) => (
        <section key={stage} className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">
            {stageLabelMap[stage] || stage}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[stage].map((match) => {
              const live = liveById.get(match.id);
              return (
                <MatchCard
                  key={match.id}
                  slug={match.slug}
                  homeTeam={match.homeTeam.name}
                  awayTeam={match.awayTeam.name}
                  homeTla={match.homeTeam.tla}
                  awayTla={match.awayTeam.tla}
                  homeScore={match.homeScore}
                  awayScore={match.awayScore}
                  status={match.status}
                  utcDate={match.utcDate}
                  stage={match.stage}
                  group={match.group}
                  isLive={!!live}
                  liveHomeScore={live?.homeScore}
                  liveAwayScore={live?.awayScore}
                  liveStatus={live?.status}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
```

---

## Task 5 — Update `src/app/page.tsx` (homepage)

**Modify:** `src/app/page.tsx`

Same pattern: keep the Server Component shell, extract the upcoming-matches grid into a small `"use client"` component.

**Create:** `src/app/home-live-matches.tsx`

```tsx
"use client";

import { useLiveScores } from "@/hooks/useLiveScores";
import { MatchCard } from "@/components/match-card";

interface StaticMatch {
  id: number;
  slug: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: { name: string; tla: string | null };
  awayTeam: { name: string; tla: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  utcDate: Date;
  stage: string | null;
  group: string | null;
}

export function HomeLiveMatches({ matches }: { matches: StaticMatch[] }) {
  const liveMatches = useLiveScores();
  const liveById = new Map(liveMatches.map((m) => [m.id, m]));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => {
        const live = liveById.get(match.id);
        return (
          <MatchCard
            key={match.id}
            slug={match.slug}
            homeTeam={match.homeTeam.name}
            awayTeam={match.awayTeam.name}
            homeTla={match.homeTeam.tla}
            awayTla={match.awayTeam.tla}
            homeScore={match.homeScore}
            awayScore={match.awayScore}
            status={match.status}
            utcDate={match.utcDate}
            stage={match.stage}
            group={match.group}
            isLive={!!live}
            liveHomeScore={live?.homeScore}
            liveAwayScore={live?.awayScore}
            liveStatus={live?.status}
          />
        );
      })}
    </div>
  );
}
```

In `src/app/page.tsx`, replace the upcoming-matches grid section. Change the `import` at the top and the `{matches.map(...)}` block:

**Replace** in `src/app/page.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
import { MatchCard } from "@/components/match-card";
import { ArticleCard } from "@/components/article-card";
```
**With:**
```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArticleCard } from "@/components/article-card";
import { HomeLiveMatches } from "./home-live-matches";
```

**Replace** inside the Upcoming Matches section:
```tsx
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                slug={match.slug}
                homeTeam={match.homeTeam.name}
                awayTeam={match.awayTeam.name}
                homeTla={match.homeTeam.tla}
                awayTla={match.awayTeam.tla}
                homeScore={match.homeScore}
                awayScore={match.awayScore}
                status={match.status}
                utcDate={match.utcDate}
                stage={match.stage}
                group={match.group}
              />
            ))}
          </div>
```
**With:**
```tsx
          <HomeLiveMatches matches={matches} />
```

---

## Task 6 — TypeScript check

### 6a. Run the TypeScript compiler

```bash
npx tsc --noEmit
```

**Expected output:** No errors.

Common issues to watch for:
- `Date` serialization: Next.js cannot pass `Date` objects from Server Components to Client Components via props — they must be serialized. If TypeScript or Next.js raises a `non-serializable props` warning, change `utcDate: Date` to `utcDate: string` in the `StaticMatch` interfaces and call `new Date(match.utcDate)` inside the Client Components before passing to `MatchCard`.
- `useLiveScores` returns `LiveMatch[]` where `updatedAt` is a `string` (JSON-parsed). Ensure the type definition reflects this.

### 6b. Run dev server and verify

```bash
npm run dev
```

Open `http://localhost:3000/matches` and `http://localhost:3000`:
- Cards for matches with `status = 'IN_PLAY'` or `'PAUSED'` in the DB should show the red pulsing dot and "TRỰC TIẾP" / "GIẢI LAO" badge.
- Open DevTools Network tab, filter by `/api/live-scores` — requests should appear every 30 seconds.
- Switch to a different browser tab, wait 30+ seconds, return — confirm polling resumes immediately (one immediate fetch + new interval).

### 6c. Verify `Cache-Control` header

```bash
curl -I http://localhost:3000/api/live-scores
```

**Expected:**
```
Cache-Control: no-store, max-age=0
```

---

## Git commit

```bash
git add \
  src/app/api/live-scores/route.ts \
  src/hooks/useLiveScores.ts \
  src/components/match-card.tsx \
  src/app/matches/page.tsx \
  src/app/matches/matches-client-grid.tsx \
  src/app/home-live-matches.tsx \
  src/app/page.tsx

git commit -m "feat: add live score polling for in-progress matches

- GET /api/live-scores returns IN_PLAY/PAUSED matches, Cache-Control: no-store
- useLiveScores hook polls every 30s, pauses when tab hidden
- MatchCard accepts isLive / liveHomeScore / liveAwayScore / liveStatus props
- Pulsing red dot + TRỰC TIẾP badge on live match cards
- Matches page and homepage overlay live data on top of ISR-rendered shell
- No WebSockets required — polling is sufficient at this traffic scale"
```
