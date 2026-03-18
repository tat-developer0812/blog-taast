import { prisma } from "@/lib/db";
import { getApiClient } from "@/lib/api-clients";
import { matchSlug } from "@/lib/utils/slug";

const WORLD_CUP_ID = 2000;

export async function syncMatches() {
  const client = getApiClient();
  const matches = await client.getMatches(WORLD_CUP_ID);

  const competition = await prisma.competition.findUnique({
    where: { externalId: WORLD_CUP_ID },
  });
  if (!competition) {
    throw new Error("Competition not found. Sync competitions first.");
  }

  const teams = await prisma.team.findMany();
  const teamByExternalId = new Map(teams.map((t) => [t.externalId, t]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const match of matches) {
    const homeTeam = teamByExternalId.get(match.homeTeamExternalId);
    const awayTeam = teamByExternalId.get(match.awayTeamExternalId);

    if (!homeTeam || !awayTeam) {
      skipped++;
      continue;
    }

    const slug = matchSlug(homeTeam.name, awayTeam.name);
    const existing = await prisma.match.findUnique({
      where: { externalId: match.externalId },
    });

    // Handle duplicate slugs
    const slugConflict = await prisma.match.findUnique({ where: { slug } });
    const finalSlug =
      slugConflict && slugConflict.externalId !== match.externalId
        ? `${slug}-matchday-${match.matchday || match.externalId}`
        : slug;

    await prisma.match.upsert({
      where: { externalId: match.externalId },
      update: {
        competitionId: competition.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: match.status,
        matchday: match.matchday,
        stage: match.stage,
        group: match.group,
        utcDate: new Date(match.utcDate),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        winner: match.winner,
        slug: finalSlug,
      },
      create: {
        externalId: match.externalId,
        competitionId: competition.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: match.status,
        matchday: match.matchday,
        stage: match.stage,
        group: match.group,
        utcDate: new Date(match.utcDate),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        winner: match.winner,
        slug: finalSlug,
      },
    });

    if (existing) updated++;
    else created++;
  }

  return { total: matches.length, created, updated, skipped };
}

/**
 * Sync only upcoming/live matches (lighter operation for frequent cron).
 */
export async function syncLiveMatches() {
  const client = getApiClient();
  const allMatches = await client.getMatches(WORLD_CUP_ID);

  // Only process non-finished matches
  const activeMatches = allMatches.filter(
    (m) => m.status !== "FINISHED" && m.status !== "CANCELLED"
  );

  const competition = await prisma.competition.findUnique({
    where: { externalId: WORLD_CUP_ID },
  });
  if (!competition) {
    throw new Error("Competition not found.");
  }

  const teams = await prisma.team.findMany();
  const teamByExternalId = new Map(teams.map((t) => [t.externalId, t]));

  let synced = 0;

  for (const match of activeMatches) {
    const homeTeam = teamByExternalId.get(match.homeTeamExternalId);
    const awayTeam = teamByExternalId.get(match.awayTeamExternalId);
    if (!homeTeam || !awayTeam) continue;

    const slug = matchSlug(homeTeam.name, awayTeam.name);
    const slugConflict = await prisma.match.findUnique({ where: { slug } });
    const finalSlug =
      slugConflict && slugConflict.externalId !== match.externalId
        ? `${slug}-matchday-${match.matchday || match.externalId}`
        : slug;

    await prisma.match.upsert({
      where: { externalId: match.externalId },
      update: {
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        winner: match.winner,
      },
      create: {
        externalId: match.externalId,
        competitionId: competition.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: match.status,
        matchday: match.matchday,
        stage: match.stage,
        group: match.group,
        utcDate: new Date(match.utcDate),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        winner: match.winner,
        slug: finalSlug,
      },
    });
    synced++;
  }

  return { activeMatches: activeMatches.length, synced };
}
