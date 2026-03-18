import { prisma } from "@/lib/db";
import { getApiClient } from "@/lib/api-clients";

const WORLD_CUP_ID = 2000;

export async function syncCompetitions() {
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

  return { competition: result.name, id: result.id };
}
