# World Cup Standings & Bracket Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Display World Cup 2026 group standings tables and knockout bracket, synced daily from football-data.org, at `/world-cup/standings` and `/world-cup/bracket`.

**Architecture:** Add a `Standing` Prisma model linked to `Competition` and `Team`, upserted by a new `syncStandings()` function following the existing sync pattern in `src/lib/sync/`. A new dedicated daily cron route hits the `/competitions/{id}/standings` football-data.org endpoint and revalidates the two new pages.

**Tech Stack:** Next.js 14 App Router (ISR), Prisma 7.5, PostgreSQL (Supabase), TypeScript, TailwindCSS, football-data.org API, Vercel Cron.

---

## Pre-flight checks

Confirm the project builds cleanly before starting:

```bash
npx tsc --noEmit
# Expected: no errors
```

---

## Task 1 — Add `Standing` model to `prisma/schema.prisma`

**Modify:** `prisma/schema.prisma`

Add the `Standing` model and wire up the back-relations on `Competition` and `Team`.

### 1a. Add `standings` back-relation to `Competition` model

In `prisma/schema.prisma`, add `standings Standing[]` to the `Competition` model, directly below the existing `matches Match[]` line:

```prisma
  matches   Match[]
  standings Standing[]
```

### 1b. Add `standings` back-relation to `Team` model

In `prisma/schema.prisma`, add `standings Standing[]` to the `Team` model, directly below the existing `articles Article[]` line:

```prisma
  articles    Article[]
  standings   Standing[]
```

### 1c. Append the `Standing` model at the end of the file

Add this block after the `SyncLog` model closing brace:

```prisma
model Standing {
  id             Int         @id @default(autoincrement())
  competitionId  Int         @map("competition_id")
  groupName      String      @map("group_name")
  position       Int
  playedGames    Int         @map("played_games")
  won            Int
  draw           Int
  lost           Int
  goalsFor       Int         @map("goals_for")
  goalsAgainst   Int         @map("goals_against")
  goalDifference Int         @map("goal_difference")
  points         Int
  teamId         Int         @map("team_id")
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")

  competition Competition @relation(fields: [competitionId], references: [id])
  team        Team        @relation(fields: [teamId], references: [id])

  @@unique([competitionId, groupName, teamId])
  @@index([competitionId])
  @@map("standings")
}
```

### 1d. Run migration

```bash
npx prisma migrate dev --name add_standings
# Expected output:
# Applying migration `YYYYMMDDHHMMSS_add_standings`
# Your database is now in sync with your schema.

npx prisma generate
# Expected output:
# ✔ Generated Prisma Client (v7.x.x)
```

---

## Task 2 — Add `getStandings()` to the football-data.org adapter

### 2a. Add `UnifiedStanding` type and `getStandings` method to `src/lib/api-clients/types.ts`

**Modify:** `src/lib/api-clients/types.ts`

Append `UnifiedStanding` and extend `FootballApiClient` interface:

```typescript
export interface UnifiedStanding {
  groupName: string;
  position: number;
  teamExternalId: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

// In the FootballApiClient interface, add:
// getStandings(competitionId: number): Promise<UnifiedStanding[]>;
```

The final `FootballApiClient` interface should read:

```typescript
export interface FootballApiClient {
  name: string;
  getCompetition(id: number): Promise<UnifiedCompetition>;
  getTeams(competitionId: number): Promise<UnifiedTeam[]>;
  getMatches(competitionId: number): Promise<UnifiedMatch[]>;
  getTeamPlayers(teamId: number): Promise<UnifiedPlayer[]>;
  getStandings(competitionId: number): Promise<UnifiedStanding[]>;
}
```

### 2b. Implement `getStandings` in `src/lib/api-clients/football-data.ts`

**Modify:** `src/lib/api-clients/football-data.ts`

Add the football-data.org response type at the top (after the existing `FdMatch` interface):

```typescript
interface FdTableEntry {
  position: number;
  team: { id: number };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface FdStandingsTable {
  stage: string;
  type: string;
  group: string | null;
  table: FdTableEntry[];
}

interface FdStandingsResponse {
  standings: FdStandingsTable[];
}
```

Add the import for `UnifiedStanding` at the top of the file alongside the existing imports:

```typescript
import type {
  FootballApiClient,
  UnifiedCompetition,
  UnifiedTeam,
  UnifiedMatch,
  UnifiedPlayer,
  UnifiedStanding,
} from "./types";
```

Add the `getStandings` method to the `footballDataClient` object (after `getTeamPlayers`):

```typescript
  async getStandings(competitionId: number): Promise<UnifiedStanding[]> {
    return cached(`fd:standings:${competitionId}`, 3600_000, async () => {
      const data = await fetchApi<FdStandingsResponse>(
        `/competitions/${competitionId}/standings`
      );

      const results: UnifiedStanding[] = [];

      for (const table of data.standings) {
        // Only process GROUP_STAGE tables that have an actual group name
        if (table.type !== "TOTAL") continue;

        const groupName = table.group ?? table.stage;

        for (const entry of table.table) {
          results.push({
            groupName,
            position: entry.position,
            teamExternalId: entry.team.id,
            playedGames: entry.playedGames,
            won: entry.won,
            draw: entry.draw,
            lost: entry.lost,
            goalsFor: entry.goalsFor,
            goalsAgainst: entry.goalsAgainst,
            goalDifference: entry.goalDifference,
            points: entry.points,
          });
        }
      }

      return results;
    });
  },
```

### 2c. Re-export `UnifiedStanding` from `src/lib/api-clients/index.ts`

**Modify:** `src/lib/api-clients/index.ts`

Add `UnifiedStanding` to the existing export block:

```typescript
export type {
  UnifiedTeam,
  UnifiedMatch,
  UnifiedPlayer,
  UnifiedCompetition,
  UnifiedStanding,
} from "./types";
```

### 2d. TypeScript check

```bash
npx tsc --noEmit
# Expected: no errors
```

---

## Task 3 — Create `src/lib/sync/sync-standings.ts`

**Create:** `src/lib/sync/sync-standings.ts`

```typescript
import { prisma } from "@/lib/db";
import { getApiClient } from "@/lib/api-clients";

const WORLD_CUP_ID = 2000;

export async function syncStandings() {
  const client = getApiClient();
  const standings = await client.getStandings(WORLD_CUP_ID);

  const competition = await prisma.competition.findUnique({
    where: { externalId: WORLD_CUP_ID },
  });
  if (!competition) {
    throw new Error("Competition not found. Run sync-competitions first.");
  }

  const teams = await prisma.team.findMany();
  const teamByExternalId = new Map(teams.map((t) => [t.externalId, t]));

  let upserted = 0;
  let skipped = 0;

  for (const standing of standings) {
    const team = teamByExternalId.get(standing.teamExternalId);

    if (!team) {
      skipped++;
      continue;
    }

    await prisma.standing.upsert({
      where: {
        competitionId_groupName_teamId: {
          competitionId: competition.id,
          groupName: standing.groupName,
          teamId: team.id,
        },
      },
      update: {
        position: standing.position,
        playedGames: standing.playedGames,
        won: standing.won,
        draw: standing.draw,
        lost: standing.lost,
        goalsFor: standing.goalsFor,
        goalsAgainst: standing.goalsAgainst,
        goalDifference: standing.goalDifference,
        points: standing.points,
      },
      create: {
        competitionId: competition.id,
        groupName: standing.groupName,
        position: standing.position,
        teamId: team.id,
        playedGames: standing.playedGames,
        won: standing.won,
        draw: standing.draw,
        lost: standing.lost,
        goalsFor: standing.goalsFor,
        goalsAgainst: standing.goalsAgainst,
        goalDifference: standing.goalDifference,
        points: standing.points,
      },
    });

    upserted++;
  }

  return {
    total: standings.length,
    upserted,
    skipped,
  };
}
```

---

## Task 4 — Export `syncStandings` from `src/lib/sync/index.ts`

**Modify:** `src/lib/sync/index.ts`

Add the export line:

```typescript
export { syncCompetitions } from "./sync-competitions";
export { syncTeams, syncPlayers } from "./sync-teams";
export { syncMatches, syncLiveMatches } from "./sync-matches";
export { syncStandings } from "./sync-standings";
```

### TypeScript check

```bash
npx tsc --noEmit
# Expected: no errors
```

---

## Task 5 — Create cron route `src/app/api/cron/sync-standings/route.ts`

**Create:** `src/app/api/cron/sync-standings/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyCronAuth } from "@/lib/cron-auth";
import { syncStandings } from "@/lib/sync";
import { withSyncLogging } from "@/lib/sync/with-logging";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await withSyncLogging("standings", syncStandings);

    revalidatePath("/world-cup/standings");
    revalidatePath("/world-cup/bracket");
    revalidatePath("/world-cup");

    return NextResponse.json(
      {
        success: true,
        standings: result,
        syncedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Standings sync failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

---

## Task 6 — Add cron schedule to `vercel.json`

**Modify:** `vercel.json`

Add the standings cron entry (daily at 07:00 UTC, after the matches sync):

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-competitions",
      "schedule": "0 0 * * 1"
    },
    {
      "path": "/api/cron/sync-teams?players=false",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/sync-matches",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/sync-matches?mode=live",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/sync-standings",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/generate-articles?scope=all",
      "schedule": "0 8 * * *"
    }
  ]
}
```

---

## Task 7 — Create `/world-cup/standings` page

**Create:** `src/app/world-cup/standings/page.tsx`

```typescript
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Bảng xếp hạng World Cup 2026",
  description:
    "Bảng xếp hạng vòng bảng World Cup 2026. Thứ hạng, điểm số, hiệu số bàn thắng của tất cả 12 bảng đấu.",
  openGraph: {
    title: "Bảng xếp hạng World Cup 2026",
    description:
      "Bảng xếp hạng vòng bảng World Cup 2026. Thứ hạng, điểm số, hiệu số bàn thắng của tất cả 12 bảng đấu.",
  },
  alternates: { canonical: "/world-cup/standings" },
};

export const revalidate = 3600;

export default async function StandingsPage() {
  const competition = await prisma.competition.findFirst({
    where: { code: "WC" },
  });

  const standings = competition
    ? await prisma.standing.findMany({
        where: { competitionId: competition.id },
        include: { team: true },
        orderBy: [{ groupName: "asc" }, { position: "asc" }],
      })
    : [];

  // Group standings by groupName
  const groups = standings.reduce<
    Record<string, typeof standings>
  >((acc, s) => {
    if (!acc[s.groupName]) acc[s.groupName] = [];
    acc[s.groupName].push(s);
    return acc;
  }, {});

  const groupNames = Object.keys(groups).sort();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--foreground)]">
          Trang chủ
        </Link>
        <span>/</span>
        <Link href="/world-cup" className="hover:text-[var(--foreground)]">
          World Cup 2026
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">Bảng xếp hạng</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bảng xếp hạng</h1>
          <p className="mt-1 text-[var(--muted)]">World Cup 2026 · Vòng bảng</p>
        </div>
        <Link
          href="/world-cup/bracket"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Xem nhánh đấu loại trực tiếp →
        </Link>
      </div>

      {groupNames.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <p className="text-[var(--muted)]">
            Bảng xếp hạng chưa có dữ liệu. Vui lòng kiểm tra lại sau khi giải
            đấu bắt đầu.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {groupNames.map((groupName) => {
            const rows = groups[groupName];
            const label = groupName.startsWith("GROUP_")
              ? `Bảng ${groupName.replace("GROUP_", "")}`
              : groupName;

            return (
              <section key={groupName}>
                <h2 className="mb-3 text-lg font-bold">{label}</h2>
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--card)] text-[var(--muted)]">
                        <th className="w-8 px-3 py-2 text-center font-medium">
                          #
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Đội tuyển
                        </th>
                        <th className="px-3 py-2 text-center font-medium">
                          Tr
                        </th>
                        <th className="px-3 py-2 text-center font-medium">
                          T
                        </th>
                        <th className="px-3 py-2 text-center font-medium">
                          H
                        </th>
                        <th className="px-3 py-2 text-center font-medium">
                          B
                        </th>
                        <th className="px-3 py-2 text-center font-medium">
                          HS
                        </th>
                        <th className="px-3 py-2 text-center font-bold text-[var(--primary)]">
                          Đ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-t border-[var(--border)] transition-colors hover:bg-[var(--card)] ${
                            row.position <= 2
                              ? "border-l-2 border-l-emerald-500"
                              : row.position === 3
                              ? "border-l-2 border-l-amber-400"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center font-medium text-[var(--muted)]">
                            {row.position}
                          </td>
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/teams/${row.team.slug}`}
                              className="flex items-center gap-2 font-medium hover:text-[var(--primary)]"
                            >
                              {row.team.crest && (
                                <img
                                  src={row.team.crest}
                                  alt={row.team.name}
                                  className="h-5 w-5 object-contain"
                                />
                              )}
                              <span className="hidden sm:inline">
                                {row.team.name}
                              </span>
                              <span className="sm:hidden">
                                {row.team.tla ?? row.team.shortName ?? row.team.name}
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-center text-[var(--muted)]">
                            {row.playedGames}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {row.won}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {row.draw}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {row.lost}
                          </td>
                          <td className="px-3 py-2.5 text-center text-[var(--muted)]">
                            {row.goalDifference > 0
                              ? `+${row.goalDifference}`
                              : row.goalDifference}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-[var(--primary)]">
                            {row.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {groupNames.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-1 rounded-full bg-emerald-500" />
            Vào vòng 1/32
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-1 rounded-full bg-amber-400" />
            Đội hạng 3 tốt nhất (8 suất)
          </span>
          <span className="ml-auto">
            Tr = Trận · T = Thắng · H = Hòa · B = Bại · HS = Hiệu số · Đ = Điểm
          </span>
        </div>
      )}
    </div>
  );
}
```

---

## Task 8 — Create `/world-cup/bracket` page

**Create:** `src/app/world-cup/bracket/page.tsx`

```typescript
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Nhánh đấu loại trực tiếp World Cup 2026",
  description:
    "Nhánh đấu vòng loại trực tiếp World Cup 2026: vòng 1/32, tứ kết, bán kết và chung kết.",
  openGraph: {
    title: "Nhánh đấu loại trực tiếp World Cup 2026",
    description:
      "Nhánh đấu vòng loại trực tiếp World Cup 2026: vòng 1/32, tứ kết, bán kết và chung kết.",
  },
  alternates: { canonical: "/world-cup/bracket" },
};

export const revalidate = 3600;

// football-data.org stage values for WC 2026
const KNOCKOUT_STAGES = [
  { key: "ROUND_OF_32", label: "Vòng 1/32" },
  { key: "ROUND_OF_16", label: "Vòng 1/16" },
  { key: "QUARTER_FINALS", label: "Tứ kết" },
  { key: "SEMI_FINALS", label: "Bán kết" },
  { key: "THIRD_PLACE", label: "Tranh hạng 3" },
  { key: "FINAL", label: "Chung kết" },
] as const;

interface MatchWithTeams {
  id: number;
  slug: string;
  stage: string | null;
  utcDate: Date;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  status: string;
  homeTeam: { name: string; tla: string | null; shortName: string | null; crest: string | null; slug: string };
  awayTeam: { name: string; tla: string | null; shortName: string | null; crest: string | null; slug: string };
}

function MatchSlot({ match }: { match: MatchWithTeams }) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  const isFinished =
    match.status === "FINISHED" || match.status === "AWARDED";
  const homeWon = match.winner === "HOME_TEAM";
  const awayWon = match.winner === "AWAY_TEAM";

  return (
    <Link
      href={`/matches/${match.slug}`}
      className="block rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm transition-shadow hover:shadow-md"
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 ${
          homeWon ? "font-semibold" : ""
        }`}
      >
        {home.crest && (
          <img
            src={home.crest}
            alt={home.name}
            className="h-5 w-5 object-contain"
          />
        )}
        <span className="flex-1 truncate">
          {home.tla ?? home.shortName ?? home.name}
        </span>
        {isFinished && (
          <span className={homeWon ? "text-[var(--primary)]" : "text-[var(--muted)]"}>
            {match.homeScore}
          </span>
        )}
      </div>
      <div className="h-px bg-[var(--border)]" />
      <div
        className={`flex items-center gap-2 px-3 py-2 ${
          awayWon ? "font-semibold" : ""
        }`}
      >
        {away.crest && (
          <img
            src={away.crest}
            alt={away.name}
            className="h-5 w-5 object-contain"
          />
        )}
        <span className="flex-1 truncate">
          {away.tla ?? away.shortName ?? away.name}
        </span>
        {isFinished && (
          <span className={awayWon ? "text-[var(--primary)]" : "text-[var(--muted)]"}>
            {match.awayScore}
          </span>
        )}
      </div>
    </Link>
  );
}

function PlaceholderSlot({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] text-sm opacity-50">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-5 w-5 rounded-full bg-[var(--border)]" />
        <span className="text-[var(--muted)]">{label}</span>
      </div>
      <div className="h-px bg-[var(--border)]" />
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-5 w-5 rounded-full bg-[var(--border)]" />
        <span className="text-[var(--muted)]">{label}</span>
      </div>
    </div>
  );
}

export default async function BracketPage() {
  const competition = await prisma.competition.findFirst({
    where: { code: "WC" },
  });

  const knockoutMatches: MatchWithTeams[] = competition
    ? await prisma.match.findMany({
        where: {
          competitionId: competition.id,
          stage: {
            in: KNOCKOUT_STAGES.map((s) => s.key),
          },
        },
        include: {
          homeTeam: {
            select: {
              name: true,
              tla: true,
              shortName: true,
              crest: true,
              slug: true,
            },
          },
          awayTeam: {
            select: {
              name: true,
              tla: true,
              shortName: true,
              crest: true,
              slug: true,
            },
          },
        },
        orderBy: { utcDate: "asc" },
      })
    : [];

  const matchesByStage = knockoutMatches.reduce<
    Record<string, MatchWithTeams[]>
  >((acc, m) => {
    const stage = m.stage ?? "UNKNOWN";
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(m);
    return acc;
  }, {});

  // Expected slot counts per stage for WC 2026
  const stageCounts: Record<string, number> = {
    ROUND_OF_32: 32,
    ROUND_OF_16: 16,
    QUARTER_FINALS: 8,
    SEMI_FINALS: 4,
    THIRD_PLACE: 1,
    FINAL: 1,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--foreground)]">
          Trang chủ
        </Link>
        <span>/</span>
        <Link href="/world-cup" className="hover:text-[var(--foreground)]">
          World Cup 2026
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">Nhánh đấu loại trực tiếp</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Nhánh đấu loại trực tiếp</h1>
          <p className="mt-1 text-[var(--muted)]">World Cup 2026 · 32 đội</p>
        </div>
        <Link
          href="/world-cup/standings"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--card)]"
        >
          ← Bảng xếp hạng vòng bảng
        </Link>
      </div>

      {knockoutMatches.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <p className="text-[var(--muted)]">
            Nhánh đấu loại trực tiếp chưa có dữ liệu. Vui lòng kiểm tra lại
            sau khi vòng bảng kết thúc.
          </p>
          <Link
            href="/world-cup/standings"
            className="mt-4 inline-block text-sm text-[var(--primary)] hover:underline"
          >
            Xem bảng xếp hạng vòng bảng
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {KNOCKOUT_STAGES.map(({ key, label }) => {
            const stageMatches = matchesByStage[key] ?? [];
            const expectedCount = stageCounts[key] ?? 0;
            const placeholdersNeeded = Math.max(
              0,
              expectedCount / 2 - stageMatches.length
            );

            if (stageMatches.length === 0 && expectedCount > 8) {
              // Skip early rounds that have no data yet to keep the page clean
              return null;
            }

            return (
              <section key={key}>
                <h2 className="mb-4 text-xl font-bold">{label}</h2>
                <div
                  className={`grid gap-3 ${
                    key === "FINAL" || key === "THIRD_PLACE"
                      ? "max-w-xs"
                      : key === "SEMI_FINALS"
                      ? "grid-cols-2 sm:max-w-lg"
                      : key === "QUARTER_FINALS"
                      ? "grid-cols-2 sm:grid-cols-4"
                      : key === "ROUND_OF_16"
                      ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
                      : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
                  }`}
                >
                  {stageMatches.map((match) => (
                    <MatchSlot key={match.id} match={match} />
                  ))}
                  {Array.from({ length: placeholdersNeeded }).map((_, i) => (
                    <PlaceholderSlot key={`ph-${i}`} label="TBD" />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## Task 9 — Add links on `/world-cup/page.tsx`

**Modify:** `src/app/world-cup/page.tsx`

Add standings and bracket links to the existing Quick links section. Locate the `<section className="mb-10 grid gap-4 sm:grid-cols-3">` block and extend it to `sm:grid-cols-3 lg:grid-cols-5` adding two new `<Link>` cards after the existing three:

```tsx
{/* Add after the existing three Link cards inside the quick-links section: */}
<Link
  href="/world-cup/standings"
  className="rounded-xl border border-[var(--border)] p-6 transition-shadow hover:shadow-lg"
>
  <p className="text-3xl font-bold text-[var(--primary)]">12</p>
  <p className="text-lg font-semibold">Bảng xếp hạng</p>
  <p className="text-sm text-[var(--muted)]">
    Thứ hạng & điểm số 12 bảng đấu
  </p>
</Link>
<Link
  href="/world-cup/bracket"
  className="rounded-xl border border-[var(--border)] p-6 transition-shadow hover:shadow-lg"
>
  <p className="text-3xl font-bold text-[var(--primary)]">32</p>
  <p className="text-lg font-semibold">Nhánh đấu loại trực tiếp</p>
  <p className="text-sm text-[var(--muted)]">
    Từ vòng 1/32 đến chung kết
  </p>
</Link>
```

Also update the grid class from `sm:grid-cols-3` to `sm:grid-cols-3 lg:grid-cols-5`.

---

## Task 10 — Final TypeScript check and git commit

```bash
npx tsc --noEmit
# Expected: no errors
```

If clean:

```bash
git add \
  prisma/schema.prisma \
  src/lib/api-clients/types.ts \
  src/lib/api-clients/football-data.ts \
  src/lib/api-clients/index.ts \
  src/lib/sync/sync-standings.ts \
  src/lib/sync/index.ts \
  src/app/api/cron/sync-standings/route.ts \
  vercel.json \
  src/app/world-cup/standings/page.tsx \
  src/app/world-cup/bracket/page.tsx \
  src/app/world-cup/page.tsx

git commit -m "feat: add World Cup standings tables and knockout bracket

- Standing Prisma model with unique constraint on (competitionId, groupName, teamId)
- syncStandings() syncing from football-data.org /standings endpoint
- /api/cron/sync-standings route with verifyCronAuth + withSyncLogging
- /world-cup/standings page grouped by round-robin groups (ISR 1h)
- /world-cup/bracket page for knockout rounds (ISR 1h)
- vercel.json cron at 07:00 UTC daily"
```

---

## Rollback

If the migration needs to be reverted:

```bash
npx prisma migrate reset
# WARNING: this resets the entire database. Only use in development.
```

For production, roll back with:

```sql
DROP TABLE standings;
```

Then revert the `prisma/schema.prisma` changes and run `npx prisma generate`.
