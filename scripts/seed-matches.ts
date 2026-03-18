import { prisma } from "../src/lib/db";
import { getApiClient } from "../src/lib/api-clients";
import { matchSlug } from "../src/lib/utils/slug";

const WORLD_CUP_ID = 2000;

async function seedMatches() {
  console.log("Fetching World Cup matches...");
  const client = getApiClient();
  const matches = await client.getMatches(WORLD_CUP_ID);

  console.log(`Found ${matches.length} matches. Saving to database...`);

  // Get competition from DB
  const competition = await prisma.competition.findUnique({
    where: { externalId: WORLD_CUP_ID },
  });
  if (!competition) {
    throw new Error(
      "Competition not found. Run seed-competitions.ts first."
    );
  }

  // Build team lookup
  const teams = await prisma.team.findMany();
  const teamByExternalId = new Map(teams.map((t) => [t.externalId, t]));

  let saved = 0;
  let skipped = 0;

  for (const match of matches) {
    const homeTeam = teamByExternalId.get(match.homeTeamExternalId);
    const awayTeam = teamByExternalId.get(match.awayTeamExternalId);

    if (!homeTeam || !awayTeam) {
      console.log(
        `  Skipping match ${match.externalId}: team not found (home=${match.homeTeamExternalId}, away=${match.awayTeamExternalId})`
      );
      skipped++;
      continue;
    }

    const slug = matchSlug(homeTeam.name, awayTeam.name);

    // Handle duplicate slugs by appending matchday
    const existingSlug = await prisma.match.findUnique({
      where: { slug },
    });
    const finalSlug =
      existingSlug && existingSlug.externalId !== match.externalId
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

    saved++;
    if (saved % 10 === 0) {
      console.log(`  Saved ${saved}/${matches.length} matches...`);
    }
  }

  console.log(
    `\nMatches seed complete: ${saved} saved, ${skipped} skipped.`
  );
}

async function main() {
  try {
    await seedMatches();
  } catch (error) {
    console.error("Error seeding matches:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
