import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { Article } from "@prisma/client";

export async function getRelatedArticles(
  currentId: number,
  opts: {
    teamId?: number | null;
    matchId?: number | null;
    type?: string;
    limit?: number;
  }
): Promise<Article[]> {
  const { teamId, matchId, type, limit = 3 } = opts;

  const orClauses: Prisma.ArticleWhereInput[] = [];
  if (teamId != null) orClauses.push({ teamId });
  if (matchId != null) orClauses.push({ matchId });
  if (type) orClauses.push({ type });

  if (orClauses.length === 0) {
    return prisma.article.findMany({
      where: { id: { not: currentId }, status: "published" },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
  }

  const results = await prisma.article.findMany({
    where: {
      id: { not: currentId },
      status: "published",
      OR: orClauses,
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  if (results.length < limit) {
    const existingIds = results.map((a) => a.id);
    existingIds.push(currentId);

    const extras = await prisma.article.findMany({
      where: {
        id: { notIn: existingIds },
        status: "published",
      },
      orderBy: { publishedAt: "desc" },
      take: limit - results.length,
    });

    return [...results, ...extras];
  }

  return results;
}
