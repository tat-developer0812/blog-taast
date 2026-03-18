# Phase 6: Scaling Preparation - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Make the platform production-ready for 1M monthly visitors — implement response caching, ISR tuning, API rate limiting, and edge optimizations.

**Architecture:** Three-layer caching strategy: (1) in-memory LRU cache for API client calls to external football APIs, (2) Next.js ISR with tuned revalidation intervals per page type, (3) Vercel Edge caching via `Cache-Control` headers on API routes. API rate limiting via a simple sliding-window counter stored in-memory (adequate for Vercel serverless — no Redis needed at this scale).

**Tech Stack:** Next.js 14 ISR, `Cache-Control` headers, custom in-memory LRU cache, sliding-window rate limiter (no external deps).

---

### Task 1: In-memory LRU cache utility

**Files:**

- Create: `src/lib/cache.ts`

**Step 1: Create the cache module**

```ts
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Simple in-memory TTL cache.
 * Suitable for serverless — each cold start gets a fresh cache,
 * but warm instances benefit from repeated calls within the TTL.
 */
class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const cache = new MemoryCache();

/**
 * Cache-through helper. Returns cached value if available,
 * otherwise calls `fn`, caches the result, and returns it.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== null) return hit;

  const value = await fn();
  cache.set(key, value, ttlMs);
  return value;
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/cache.ts
git commit -m "feat(perf): add in-memory TTL cache utility"
```

---

### Task 2: Wrap football-data.org API client with caching

**Files:**

- Modify: `src/lib/api-clients/football-data.ts`

**Step 1: Add import at top of file**

```ts
import { cached } from "@/lib/cache";
```

**Step 2: Replace the raw `fetchApi` calls in each method with cached versions**

Update `getCompetition`:

```ts
async getCompetition(id: number): Promise<UnifiedCompetition> {
  return cached(`fd:competition:${id}`, 3600_000, async () => {
    const data = await fetchApi<FdCompetition>(`/competitions/${id}`);
    return {
      externalId: data.id,
      name: data.name,
      code: data.code,
      type: data.type,
      emblem: data.emblem,
      area: data.area?.name ?? null,
      season: data.currentSeason?.startDate?.slice(0, 4) ?? null,
      startDate: data.currentSeason?.startDate ?? null,
      endDate: data.currentSeason?.endDate ?? null,
    };
  });
},
```

Update `getTeams`:

```ts
async getTeams(competitionId: number): Promise<UnifiedTeam[]> {
  return cached(`fd:teams:${competitionId}`, 1800_000, async () => {
    const data = await fetchApi<{ teams: FdTeam[] }>(
      `/competitions/${competitionId}/teams`
    );
    return data.teams.map((t) => ({
      externalId: t.id,
      name: t.name,
      shortName: t.shortName,
      tla: t.tla,
      crest: t.crest,
      area: t.area?.name ?? null,
      founded: t.founded,
      venue: t.venue,
      coach: t.coach?.name ?? null,
    }));
  });
},
```

Update `getMatches`:

```ts
async getMatches(competitionId: number): Promise<UnifiedMatch[]> {
  return cached(`fd:matches:${competitionId}`, 300_000, async () => {
    const data = await fetchApi<{ matches: FdMatch[] }>(
      `/competitions/${competitionId}/matches`
    );
    return data.matches.map((m) => ({
      externalId: m.id,
      competitionExternalId: m.competition.id,
      homeTeamExternalId: m.homeTeam.id,
      awayTeamExternalId: m.awayTeam.id,
      status: m.status,
      matchday: m.matchday,
      stage: m.stage,
      group: m.group,
      utcDate: m.utcDate,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      winner: m.score?.winner ?? null,
    }));
  });
},
```

Update `getTeamPlayers`:

```ts
async getTeamPlayers(teamId: number): Promise<UnifiedPlayer[]> {
  return cached(`fd:players:${teamId}`, 1800_000, async () => {
    const data = await fetchApi<{ squad: FdPlayer[] }>(`/teams/${teamId}`);
    return (data.squad || []).map((p) => ({
      externalId: p.id,
      name: p.name,
      position: p.position,
      dateOfBirth: p.dateOfBirth,
      nationality: p.nationality,
      shirtNumber: p.shirtNumber,
    }));
  });
},
```

Cache TTLs:
- Competition: 1 hour (rarely changes)
- Teams: 30 min
- Matches: 5 min (scores can change)
- Players: 30 min

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/api-clients/football-data.ts src/lib/cache.ts
git commit -m "feat(perf): cache football-data.org API responses in-memory"
```

---

### Task 3: API rate limiter

**Files:**

- Create: `src/lib/rate-limit.ts`

**Step 1: Create the rate limiter**

```ts
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Sliding window rate limiter.
 * Returns { success, remaining, resetAt }.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// Cleanup stale entries periodically (avoid memory leak in long-running processes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60_000);
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "feat(perf): add sliding-window rate limiter"
```

---

### Task 4: Apply rate limiting to public API routes

**Files:**

- Modify: `src/app/api/generate/route.ts`

**Step 1: Add rate limiting to the POST handler**

Add import at top:

```ts
import { rateLimit } from "@/lib/rate-limit";
```

Add rate limit check at the start of the POST function, right after the auth check:

```ts
// Rate limit: 10 requests per minute per IP
const ip = request.headers.get("x-forwarded-for") || "anonymous";
const { success, remaining } = rateLimit(`generate:${ip}`, 10, 60_000);
if (!success) {
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    {
      status: 429,
      headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
    }
  );
}
```

Also add the remaining header to the success response. After the existing `return NextResponse.json({ success: true, ... })`, wrap it to include the header:

Actually, simpler approach — add the header to the existing success response. Change the success return to:

```ts
const response = NextResponse.json({
  success: true,
  article: {
    id: saved.id,
    slug: saved.slug,
    title: article.title,
    isNew: saved.isNew,
  },
});
response.headers.set("X-RateLimit-Remaining", String(remaining));
return response;
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat(perf): rate limit article generation API"
```

---

### Task 5: Add Cache-Control headers to cron API routes

**Files:**

- Modify: `src/app/api/cron/sync-matches/route.ts`
- Modify: `src/app/api/cron/sync-teams/route.ts`
- Modify: `src/app/api/cron/sync-competitions/route.ts`
- Modify: `src/app/api/cron/generate-articles/route.ts`

**Step 1: For each cron route, add `Cache-Control: no-store` to the success response**

In each route file, change the success `return NextResponse.json(...)` to include a header. For example, in `sync-matches/route.ts`, replace:

```ts
return NextResponse.json({
  success: true,
  ...
});
```

with:

```ts
return NextResponse.json(
  { success: true, ... },
  { headers: { "Cache-Control": "no-store" } }
);
```

Apply this pattern to all 4 cron route files. The existing response body stays the same — just wrap the second argument.

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/cron/
git commit -m "feat(perf): add Cache-Control no-store to cron API routes"
```

---

### Task 6: Tune ISR revalidation intervals across pages

**Files:**

- Modify: `src/app/page.tsx` — already has `revalidate = 3600` ✅
- Modify: `src/app/teams/page.tsx` — already has `revalidate = 86400` ✅
- Modify: `src/app/teams/[slug]/page.tsx` — already has `revalidate = 3600` ✅
- Modify: `src/app/matches/page.tsx` — already has `revalidate = 1800` ✅
- Modify: `src/app/matches/[slug]/page.tsx` — already has `revalidate = 1800` ✅
- Modify: `src/app/predictions/page.tsx` — already has `revalidate = 3600` ✅
- Modify: `src/app/predictions/[slug]/page.tsx` — already has `revalidate = 3600` ✅
- Modify: `src/app/blog/page.tsx` — already has `revalidate = 1800` ✅
- Modify: `src/app/world-cup/page.tsx` — already has `revalidate = 86400` ✅

**Step 1: Review**

All ISR intervals are already set from Phase 4. The current values are appropriate:

| Page | Revalidate | Reason |
|------|-----------|--------|
| Homepage | 1h | Balanced freshness |
| Teams listing | 24h | Rarely changes |
| Team detail | 1h | Squad may update |
| Matches listing | 30min | Scores update frequently |
| Match detail | 30min | Live score updates |
| Predictions listing | 1h | New predictions daily |
| Prediction detail | 1h | Content stable |
| Blog | 30min | New articles frequently |
| World Cup | 24h | Static info |

No changes needed. Skip to next task.

---

### Task 7: On-demand revalidation API route

**Files:**

- Create: `src/app/api/revalidate/route.ts`

**Step 1: Create the revalidation endpoint**

```ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

/**
 * On-demand revalidation endpoint.
 * Called after data sync to immediately refresh affected pages.
 *
 * POST /api/revalidate
 * Body: { paths: ["/teams/brazil", "/matches"] }
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-api-key");
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const paths: string[] = body.paths || [];

  if (paths.length === 0) {
    return NextResponse.json(
      { error: "No paths provided" },
      { status: 400 }
    );
  }

  const results: { path: string; revalidated: boolean }[] = [];

  for (const path of paths) {
    try {
      revalidatePath(path);
      results.push({ path, revalidated: true });
    } catch {
      results.push({ path, revalidated: false });
    }
  }

  return NextResponse.json({ success: true, results });
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/revalidate/route.ts
git commit -m "feat(perf): add on-demand revalidation API endpoint"
```

---

### Task 8: Trigger revalidation after data sync

**Files:**

- Modify: `src/app/api/cron/sync-matches/route.ts`

**Step 1: Add revalidation call after successful sync**

Add import at top:

```ts
import { revalidatePath } from "next/cache";
```

After the `const result = ...` line (successful sync), add:

```ts
// Revalidate pages that display match data
revalidatePath("/");
revalidatePath("/matches");
```

**Step 2: Do the same for `sync-teams/route.ts`**

Add import at top:

```ts
import { revalidatePath } from "next/cache";
```

After successful teams sync, add:

```ts
revalidatePath("/");
revalidatePath("/teams");
```

**Step 3: Do the same for `generate-articles/route.ts`**

Add import at top:

```ts
import { revalidatePath } from "next/cache";
```

After successful generation, add:

```ts
revalidatePath("/");
revalidatePath("/blog");
revalidatePath("/predictions");
```

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/cron/
git commit -m "feat(perf): trigger ISR revalidation after data sync and article generation"
```

---

### Task 9: Add response headers middleware for static assets

**Files:**

- Create: `src/middleware.ts`

**Step 1: Create middleware for caching static pages at the edge**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Cache static-ish pages at Vercel edge for 5 minutes
  const path = request.nextUrl.pathname;

  if (
    path === "/" ||
    path.startsWith("/teams") ||
    path.startsWith("/matches") ||
    path.startsWith("/predictions") ||
    path.startsWith("/blog") ||
    path.startsWith("/world-cup")
  ) {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(perf): add edge caching middleware for public pages"
```

---

### Task 10: Update next.config.mjs with performance settings

**Files:**

- Modify: `next.config.mjs`

**Step 1: Add performance-related config**

Replace the entire file with:

```mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "crests.football-data.org",
      },
      {
        protocol: "https",
        hostname: "www.thesportsdb.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
    // Optimize image loading
    formats: ["image/avif", "image/webp"],
  },
  // Enable compression
  compress: true,
  // Strict mode for catching issues
  reactStrictMode: true,
  // Reduce bundle size by excluding server-only packages from client
  experimental: {
    optimizePackageImports: ["@prisma/client"],
  },
};

export default nextConfig;
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add next.config.mjs
git commit -m "feat(perf): optimize next.config with compression, image formats, package imports"
```

---

### Task 11: Final verification

**Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Dev server smoke test**

Run: `npm run dev` (then stop after confirming it starts)
Expected: `Ready in Xms`

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(perf): phase 6 complete — caching, rate limiting, ISR tuning, edge optimization"
```
