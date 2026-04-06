import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { searchArticles, searchTeams, searchMatches } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rawIp = req.headers.get("x-forwarded-for") ?? "";
  const ip = rawIp.split(",")[0].trim() || "unknown";
  const { success } = rateLimit(`search:${ip}`, 20, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const type = searchParams.get("type") ?? "all";

  const validTypes = ["all", "articles", "teams", "matches"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: "Invalid type parameter." },
      { status: 400 }
    );
  }

  if (!q || q.length < 2) {
    return NextResponse.json(
      { articles: [], teams: [], matches: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const [articles, teams, matches] = await Promise.all([
      type === "all" || type === "articles" ? searchArticles(q) : [],
      type === "all" || type === "teams"    ? searchTeams(q)    : [],
      type === "all" || type === "matches"  ? searchMatches(q)  : [],
    ]);

    return NextResponse.json(
      { articles, teams, matches },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[search] query failed:", err);
    return NextResponse.json(
      { error: "Search temporarily unavailable." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
