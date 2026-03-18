import { prisma } from "../src/lib/db";
import {
  generateAllTeamArticles,
  generateAllMatchArticles,
  generateAllH2HArticles,
} from "../src/lib/content/generator";

async function main() {
  const scope = process.argv[2] || "all";

  console.log(`Generating articles (scope: ${scope})...\n`);

  if (scope === "all" || scope === "teams") {
    console.log("=== Team Articles ===");
    const teamResults = await generateAllTeamArticles();
    const created = teamResults.filter((r) => r.isNew && !r.error).length;
    const updated = teamResults.filter((r) => !r.isNew && !r.error).length;
    const errors = teamResults.filter((r) => r.error);
    console.log(`  Created: ${created}, Updated: ${updated}, Errors: ${errors.length}`);
    for (const e of errors) {
      console.log(`  ERROR: ${e.slug} - ${e.error}`);
    }
    console.log();
  }

  if (scope === "all" || scope === "matches") {
    console.log("=== Match Articles ===");
    const matchResults = await generateAllMatchArticles();
    const created = matchResults.filter((r) => r.isNew && !r.error).length;
    const updated = matchResults.filter((r) => !r.isNew && !r.error).length;
    const errors = matchResults.filter((r) => r.error);
    console.log(`  Created: ${created}, Updated: ${updated}, Errors: ${errors.length}`);
    for (const e of errors) {
      console.log(`  ERROR: ${e.slug} - ${e.error}`);
    }
    console.log();
  }

  if (scope === "all" || scope === "h2h") {
    console.log("=== H2H Articles ===");
    const h2hResults = await generateAllH2HArticles();
    const created = h2hResults.filter((r) => r.isNew && !r.error).length;
    const updated = h2hResults.filter((r) => !r.isNew && !r.error).length;
    const errors = h2hResults.filter((r) => r.error);
    console.log(`  Created: ${created}, Updated: ${updated}, Errors: ${errors.length}`);
    for (const e of errors) {
      console.log(`  ERROR: ${e.slug} - ${e.error}`);
    }
    console.log();
  }

  const totalArticles = await prisma.article.count();
  console.log(`Total articles in database: ${totalArticles}`);
}

main()
  .catch((error) => {
    console.error("Generation failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
