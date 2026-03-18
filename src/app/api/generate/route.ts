import { NextRequest, NextResponse } from "next/server";
import {
  generateMatchPreviewArticle,
  generatePredictionArticle,
  generateTeamArticle,
  generateH2HArticle,
  saveArticle,
} from "@/lib/content/generator";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Generate a single article on demand.
 *
 * POST /api/generate
 * Body: { type: "match_preview" | "prediction" | "team_history" | "h2h", matchId?, teamId?, team1Id?, team2Id? }
 */
export async function POST(request: NextRequest) {
  // Simple auth check
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 requests per minute per IP
  const rawIp = request.headers.get("x-forwarded-for") || "";
  const ip = rawIp.split(",")[0].trim() || "anonymous";
  const { success, remaining } = rateLimit(`generate:${ip}`, 10, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      }
    );
  }

  try {
    const body = await request.json();
    const { type, matchId, teamId, team1Id, team2Id } = body;

    let article;

    switch (type) {
      case "match_preview":
        if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });
        article = await generateMatchPreviewArticle(matchId);
        break;
      case "prediction":
        if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });
        article = await generatePredictionArticle(matchId);
        break;
      case "team_history":
        if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
        article = await generateTeamArticle(teamId);
        break;
      case "h2h":
        if (!team1Id || !team2Id) return NextResponse.json({ error: "team1Id and team2Id required" }, { status: 400 });
        article = await generateH2HArticle(team1Id, team2Id);
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const saved = await saveArticle(article);

    const response = NextResponse.json({
      success: true,
      article: {
        id: saved.id,
        slug: saved.slug,
        title: article.title,
        isNew: saved.isNew,
      },
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (error) {
    console.error("Article generation failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
