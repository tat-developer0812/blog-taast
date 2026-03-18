import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyCronAuth } from "@/lib/cron-auth";
import { withSyncLogging } from "@/lib/sync/with-logging";
import {
  generateAllTeamArticles,
  generateAllMatchArticles,
  generateAllH2HArticles,
  type GenerationResult,
} from "@/lib/content/generator";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron endpoint to bulk-generate articles.
 *
 * GET /api/cron/generate-articles?scope=all|teams|matches|h2h
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = request.nextUrl.searchParams.get("scope") || "all";

  const validScopes = ["all", "teams", "matches", "h2h"];
  if (!validScopes.includes(scope)) {
    return NextResponse.json(
      { error: `Invalid scope. Valid values: ${validScopes.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const allResults: GenerationResult[] = [];

    if (scope === "all" || scope === "teams") {
      const teamResults = await withSyncLogging(
        "generate-teams",
        generateAllTeamArticles
      );
      allResults.push(...teamResults);
    }

    if (scope === "all" || scope === "matches") {
      const matchResults = await withSyncLogging(
        "generate-matches",
        generateAllMatchArticles
      );
      allResults.push(...matchResults);
    }

    if (scope === "all" || scope === "h2h") {
      const h2hResults = await withSyncLogging(
        "generate-h2h",
        generateAllH2HArticles
      );
      allResults.push(...h2hResults);
    }

    const created = allResults.filter((r) => r.isNew && !r.error).length;
    const updated = allResults.filter((r) => !r.isNew && !r.error).length;
    const errors = allResults.filter((r) => r.error).length;

    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath("/predictions");

    return NextResponse.json(
      {
        success: true,
        scope,
        summary: { total: allResults.length, created, updated, errors },
        results: allResults,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Article generation cron failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
