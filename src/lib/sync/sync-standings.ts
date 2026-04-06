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

  return { total: standings.length, upserted, skipped };
}
