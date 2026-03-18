import { prisma } from "../src/lib/db";
import { getApiClient } from "../src/lib/api-clients";

// World Cup 2026 competition ID on football-data.org = 2000 (FIFA World Cup)
const WORLD_CUP_ID = 2000;

async function seedCompetition() {
  console.log("Fetching World Cup competition data...");
  const client = getApiClient();
  const competition = await client.getCompetition(WORLD_CUP_ID);

  const result = await prisma.competition.upsert({
    where: { externalId: competition.externalId },
    update: {
      name: competition.name,
      code: competition.code,
      type: competition.type,
      emblem: competition.emblem,
      area: competition.area,
      season: competition.season,
      startDate: competition.startDate
        ? new Date(competition.startDate)
        : null,
      endDate: competition.endDate ? new Date(competition.endDate) : null,
    },
    create: {
      externalId: competition.externalId,
      name: competition.name,
      code: competition.code,
      type: competition.type,
      emblem: competition.emblem,
      area: competition.area,
      season: competition.season,
      startDate: competition.startDate
        ? new Date(competition.startDate)
        : null,
      endDate: competition.endDate ? new Date(competition.endDate) : null,
    },
  });

  console.log(`Competition saved: ${result.name} (ID: ${result.id})`);
  return result;
}

async function main() {
  try {
    await seedCompetition();
    console.log("Competition seed complete!");
  } catch (error) {
    console.error("Error seeding competition:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
