import { prisma } from "../src/lib/db";
import { getApiClient } from "../src/lib/api-clients";
import { slugify } from "../src/lib/utils/slug";

const WORLD_CUP_ID = 2000;

async function seedTeams() {
  console.log("Fetching World Cup teams...");
  const client = getApiClient();
  const teams = await client.getTeams(WORLD_CUP_ID);

  console.log(`Found ${teams.length} teams. Saving to database...`);

  let saved = 0;
  for (const team of teams) {
    const slug = slugify(team.name);

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
    saved++;
    console.log(`  [${saved}/${teams.length}] ${team.name}`);
  }

  console.log(`Teams seed complete: ${saved} teams saved.`);
}

async function seedPlayers() {
  console.log("\nFetching players for each team...");
  const client = getApiClient();
  const teams = await prisma.team.findMany();

  for (const team of teams) {
    try {
      const players = await client.getTeamPlayers(team.externalId);
      console.log(`  ${team.name}: ${players.length} players`);

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
      }

      // Rate limit: football-data.org free tier = 10 req/min
      await new Promise((resolve) => setTimeout(resolve, 6500));
    } catch (error) {
      console.error(`  Error fetching players for ${team.name}:`, error);
    }
  }

  const totalPlayers = await prisma.player.count();
  console.log(`Players seed complete: ${totalPlayers} players saved.`);
}

async function main() {
  try {
    await seedTeams();
    await seedPlayers();
    console.log("\nAll team data seeded successfully!");
  } catch (error) {
    console.error("Error seeding teams:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
