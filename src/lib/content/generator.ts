import { prisma } from "@/lib/db";
import { generateSeo } from "./seo";
import {
  generateMatchPreview,
  generateMatchPreviewExcerpt,
} from "./templates/match-preview";
import {
  generatePrediction,
  generatePredictionExcerpt,
} from "./templates/prediction";
import {
  generateTeamHistory,
  generateTeamHistoryExcerpt,
} from "./templates/team-history";
import {
  generateHeadToHead,
  generateH2HExcerpt,
} from "./templates/head-to-head";
import type { GeneratedArticle, MatchData, TeamData, H2HData } from "./types";

// ── Fetch helpers ──

async function fetchMatchData(matchId: number): Promise<MatchData> {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
      competition: true,
    },
  });
  return match as unknown as MatchData;
}

async function fetchTeamData(teamId: number): Promise<TeamData> {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    include: { players: true },
  });
  return team as unknown as TeamData;
}

async function fetchH2HData(
  team1Id: number,
  team2Id: number
): Promise<H2HData> {
  const [team1, team2] = await Promise.all([
    fetchTeamData(team1Id),
    fetchTeamData(team2Id),
  ]);

  // Get H2H stats
  const h2h = await prisma.headToHead.findUnique({
    where: {
      team1Id_team2Id: { team1Id, team2Id },
    },
  });

  // Get recent matches between the two teams
  const recentMatches = await prisma.match.findMany({
    where: {
      OR: [
        { homeTeamId: team1Id, awayTeamId: team2Id },
        { homeTeamId: team2Id, awayTeamId: team1Id },
      ],
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      competition: true,
    },
    orderBy: { utcDate: "desc" },
    take: 10,
  });

  return {
    team1,
    team2,
    totalMatches: h2h?.totalMatches ?? 0,
    team1Wins: h2h?.team1Wins ?? 0,
    team2Wins: h2h?.team2Wins ?? 0,
    draws: h2h?.draws ?? 0,
    team1Goals: h2h?.team1Goals ?? 0,
    team2Goals: h2h?.team2Goals ?? 0,
    recentMatches: recentMatches as unknown as MatchData[],
  };
}

// ── Article generators ──

export async function generateMatchPreviewArticle(
  matchId: number
): Promise<GeneratedArticle> {
  const match = await fetchMatchData(matchId);
  const seo = generateSeo({
    type: "match_preview",
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
  });

  return {
    title: seo.title,
    slug: seo.slug,
    content: generateMatchPreview(match),
    excerpt: generateMatchPreviewExcerpt(match),
    type: "match_preview",
    seoTitle: seo.seoTitle,
    seoDescription: seo.seoDescription,
    matchId,
  };
}

export async function generatePredictionArticle(
  matchId: number
): Promise<GeneratedArticle> {
  const match = await fetchMatchData(matchId);
  const seo = generateSeo({
    type: "prediction",
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
  });

  return {
    title: seo.title,
    slug: seo.slug,
    content: generatePrediction(match),
    excerpt: generatePredictionExcerpt(match),
    type: "prediction",
    seoTitle: seo.seoTitle,
    seoDescription: seo.seoDescription,
    matchId,
  };
}

export async function generateTeamArticle(
  teamId: number
): Promise<GeneratedArticle> {
  const team = await fetchTeamData(teamId);
  const seo = generateSeo({
    type: "team_history",
    teamName: team.name,
  });

  return {
    title: seo.title,
    slug: seo.slug,
    content: generateTeamHistory(team),
    excerpt: generateTeamHistoryExcerpt(team),
    type: "team_history",
    seoTitle: seo.seoTitle,
    seoDescription: seo.seoDescription,
    teamId,
  };
}

export async function generateH2HArticle(
  team1Id: number,
  team2Id: number
): Promise<GeneratedArticle> {
  const data = await fetchH2HData(team1Id, team2Id);
  const seo = generateSeo({
    type: "h2h",
    homeTeam: data.team1.name,
    awayTeam: data.team2.name,
  });

  return {
    title: seo.title,
    slug: seo.slug,
    content: generateHeadToHead(data),
    excerpt: generateH2HExcerpt(data),
    type: "h2h",
    seoTitle: seo.seoTitle,
    seoDescription: seo.seoDescription,
  };
}

// ── Save to DB ──

export async function saveArticle(
  article: GeneratedArticle
): Promise<{ id: number; slug: string; isNew: boolean }> {
  const existing = await prisma.article.findUnique({
    where: { slug: article.slug },
  });

  if (existing) {
    await prisma.article.update({
      where: { id: existing.id },
      data: {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        teamId: article.teamId,
        matchId: article.matchId,
      },
    });
    return { id: existing.id, slug: existing.slug, isNew: false };
  }

  const created = await prisma.article.create({
    data: {
      title: article.title,
      slug: article.slug,
      content: article.content,
      excerpt: article.excerpt,
      type: article.type,
      status: "published",
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      teamId: article.teamId,
      matchId: article.matchId,
      publishedAt: new Date(),
    },
  });
  return { id: created.id, slug: created.slug, isNew: true };
}

// ── Bulk generation ──

export interface GenerationResult {
  type: string;
  slug: string;
  isNew: boolean;
  error?: string;
}

/**
 * Generate articles for all teams in the database.
 */
export async function generateAllTeamArticles(): Promise<GenerationResult[]> {
  const teams = await prisma.team.findMany();
  const results: GenerationResult[] = [];

  for (const team of teams) {
    try {
      const article = await generateTeamArticle(team.id);
      const saved = await saveArticle(article);
      results.push({
        type: "team_history",
        slug: saved.slug,
        isNew: saved.isNew,
      });
    } catch (error) {
      results.push({
        type: "team_history",
        slug: team.slug,
        isNew: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Generate match preview + prediction articles for all upcoming matches.
 */
export async function generateAllMatchArticles(): Promise<GenerationResult[]> {
  const matches = await prisma.match.findMany({
    where: {
      status: { in: ["SCHEDULED", "TIMED"] },
    },
  });

  const results: GenerationResult[] = [];

  for (const match of matches) {
    // Match preview
    try {
      const preview = await generateMatchPreviewArticle(match.id);
      const saved = await saveArticle(preview);
      results.push({
        type: "match_preview",
        slug: saved.slug,
        isNew: saved.isNew,
      });
    } catch (error) {
      results.push({
        type: "match_preview",
        slug: match.slug,
        isNew: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Prediction
    try {
      const prediction = await generatePredictionArticle(match.id);
      const saved = await saveArticle(prediction);
      results.push({
        type: "prediction",
        slug: saved.slug,
        isNew: saved.isNew,
      });
    } catch (error) {
      results.push({
        type: "prediction",
        slug: match.slug,
        isNew: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Generate H2H articles for all matches.
 */
export async function generateAllH2HArticles(): Promise<GenerationResult[]> {
  const matches = await prisma.match.findMany({
    select: { homeTeamId: true, awayTeamId: true },
    distinct: ["homeTeamId", "awayTeamId"],
  });

  const results: GenerationResult[] = [];
  const processed = new Set<string>();

  for (const match of matches) {
    // Avoid duplicate pairs
    const key = [match.homeTeamId, match.awayTeamId].sort().join("-");
    if (processed.has(key)) continue;
    processed.add(key);

    try {
      const article = await generateH2HArticle(
        match.homeTeamId,
        match.awayTeamId
      );
      const saved = await saveArticle(article);
      results.push({ type: "h2h", slug: saved.slug, isNew: saved.isNew });
    } catch (error) {
      results.push({
        type: "h2h",
        slug: key,
        isNew: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
