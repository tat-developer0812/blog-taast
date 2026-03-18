import { prisma } from "@/lib/db";
import { getApiClient } from "@/lib/api-clients";
import { slugify } from "@/lib/utils/slug";

const WORLD_CUP_ID = 2000;

export async function syncTeams() {
  const client = getApiClient();
  const teams = await client.getTeams(WORLD_CUP_ID);

  let created = 0;
  let updated = 0;

  for (const team of teams) {
    const slug = slugify(team.name);
    const existing = await prisma.team.findUnique({
      where: { externalId: team.externalId },
    });

    await prisma.team.upsert({
      where: { externalId: team.externalId },
      update: {
        name: team.name,
        shortName: team.shortName,
        tla: team.tla,
        crest: team.crest,
        area: team.area,
        slug,
        founded: team.founded,
        venue: team.venue,
        coach: team.coach,
      },
      create: {
        externalId: team.externalId,
        name: team.name,
        shortName: team.shortName,
        tla: team.tla,
        crest: team.crest,
        area: team.area,
        slug,
        founded: team.founded,
        venue: team.venue,
        coach: team.coach,
      },
    });

    if (existing) updated++;
    else created++;
  }

  return { total: teams.length, created, updated };
}

export async function syncPlayers() {
  const client = getApiClient();
  const teams = await prisma.team.findMany();

  let totalPlayers = 0;
  const errors: string[] = [];

  for (const team of teams) {
    try {
      const players = await client.getTeamPlayers(team.externalId);

      for (const player of players) {
        await prisma.player.upsert({
          where: { externalId: player.externalId },
          update: {
            name: player.name,
            position: player.position,
            dateOfBirth: player.dateOfBirth
              ? new Date(player.dateOfBirth)
              : null,
            nationality: player.nationality,
            shirtNumber: player.shirtNumber,
            teamId: team.id,
          },
          create: {
            externalId: player.externalId,
            name: player.name,
            position: player.position,
            dateOfBirth: player.dateOfBirth
              ? new Date(player.dateOfBirth)
              : null,
            nationality: player.nationality,
            shirtNumber: player.shirtNumber,
            teamId: team.id,
          },
        });
        totalPlayers++;
      }

      // Rate limit: football-data.org free tier = 10 req/min
      await new Promise((resolve) => setTimeout(resolve, 6500));
    } catch (error) {
      errors.push(
        `${team.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { totalPlayers, teamsProcessed: teams.length, errors };
}
