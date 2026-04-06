import { prisma } from "@/lib/db";

// ---- Shared sanitiser --------------------------------------------------------
function sanitise(q: string): string {
  return q.trim().replace(/[\\:*!'"]/g, " ").replace(/\s+/g, " ").slice(0, 200);
}

// ---- Result types ------------------------------------------------------------

export interface ArticleSearchResult {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  type: string;
  publishedAt: Date | null;
  rank: number;
}

export interface TeamSearchResult {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  slug: string;
  area: string | null;
  crest: string | null;
  rank: number;
}

export interface MatchSearchResult {
  id: number;
  slug: string;
  status: string;
  utcDate: Date;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamName: string;
  awayTeamName: string;
  rank: number;
}

// ---- Search functions --------------------------------------------------------

export async function searchArticles(q: string): Promise<ArticleSearchResult[]> {
  const query = sanitise(q);
  if (!query) return [];

  return prisma.$queryRaw<ArticleSearchResult[]>`
    SELECT
      a.id,
      a.title,
      a.slug,
      a.excerpt,
      a.type,
      a.published_at AS "publishedAt",
      ts_rank(
        to_tsvector('simple', a.title || ' ' || COALESCE(a.excerpt, '')),
        plainto_tsquery('simple', ${query})
      ) AS rank
    FROM articles a
    WHERE
      to_tsvector('simple', a.title || ' ' || COALESCE(a.excerpt, ''))
        @@ plainto_tsquery('simple', ${query})
      AND a.status = 'published'
    ORDER BY rank DESC
    LIMIT 20
  `;
}

export async function searchTeams(q: string): Promise<TeamSearchResult[]> {
  const query = sanitise(q);
  if (!query) return [];

  return prisma.$queryRaw<TeamSearchResult[]>`
    SELECT
      t.id,
      t.name,
      t.short_name AS "shortName",
      t.tla,
      t.slug,
      t.area,
      t.crest,
      ts_rank(
        to_tsvector('simple', t.name),
        plainto_tsquery('simple', ${query})
      ) AS rank
    FROM teams t
    WHERE
      to_tsvector('simple', t.name)
        @@ plainto_tsquery('simple', ${query})
    ORDER BY rank DESC
    LIMIT 20
  `;
}

export async function searchMatches(q: string): Promise<MatchSearchResult[]> {
  const query = sanitise(q);
  if (!query) return [];

  return prisma.$queryRaw<MatchSearchResult[]>`
    SELECT
      m.id,
      m.slug,
      m.status,
      m.utc_date     AS "utcDate",
      m.home_score   AS "homeScore",
      m.away_score   AS "awayScore",
      ht.name        AS "homeTeamName",
      at2.name       AS "awayTeamName",
      ts_rank(
        to_tsvector('simple', m.slug),
        plainto_tsquery('simple', ${query})
      ) AS rank
    FROM matches m
    JOIN teams ht  ON ht.id  = m.home_team_id
    JOIN teams at2 ON at2.id = m.away_team_id
    WHERE
      to_tsvector('simple', m.slug)
        @@ plainto_tsquery('simple', ${query})
    ORDER BY rank DESC
    LIMIT 20
  `;
}
