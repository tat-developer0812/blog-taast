import Link from "next/link";
import { prisma } from "@/lib/db";
import { MatchCard } from "@/components/match-card";
import { ArticleCard } from "@/components/article-card";

export const revalidate = 3600; // ISR: revalidate every hour

async function getUpcomingMatches() {
  return prisma.match.findMany({
    where: { status: { in: ["SCHEDULED", "TIMED"] } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { utcDate: "asc" },
    take: 6,
  });
}

async function getLatestArticles() {
  return prisma.article.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 6,
  });
}

async function getTeamCount() {
  return prisma.team.count();
}

export default async function HomePage() {
  const [matches, articles, teamCount] = await Promise.all([
    getUpcomingMatches(),
    getLatestArticles(),
    getTeamCount(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero */}
      <section className="mb-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white sm:p-12">
        <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
          World Cup 2026
        </h1>
        <p className="mb-6 max-w-2xl text-lg text-blue-100">
          Cập nhật tin tức, dự đoán kết quả và phân tích chuyên sâu World Cup
          2026. Trang tin bóng đá hàng đầu cho người hâm mộ Việt Nam.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/matches"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          >
            Xem lịch thi đấu
          </Link>
          <Link
            href="/predictions"
            className="rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Dự đoán kết quả
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Đội tuyển", value: teamCount, href: "/teams" },
          { label: "Trận đấu", value: matches.length + "+", href: "/matches" },
          { label: "Bài viết", value: articles.length + "+", href: "/blog" },
          { label: "Quốc gia", value: "3", href: "/world-cup" },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-[var(--border)] p-4 text-center transition-shadow hover:shadow-md"
          >
            <p className="text-2xl font-bold text-[var(--primary)]">
              {stat.value}
            </p>
            <p className="text-sm text-[var(--muted)]">{stat.label}</p>
          </Link>
        ))}
      </section>

      {/* Upcoming Matches */}
      {matches.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Trận đấu sắp tới</h2>
            <Link
              href="/matches"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                slug={match.slug}
                homeTeam={match.homeTeam.name}
                awayTeam={match.awayTeam.name}
                homeTla={match.homeTeam.tla}
                awayTla={match.awayTeam.tla}
                homeScore={match.homeScore}
                awayScore={match.awayScore}
                status={match.status}
                utcDate={match.utcDate}
                stage={match.stage}
                group={match.group}
              />
            ))}
          </div>
        </section>
      )}

      {/* Latest Articles */}
      {articles.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Bài viết mới nhất</h2>
            <Link
              href="/blog"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                title={article.title}
                excerpt={article.excerpt}
                slug={article.slug}
                type={article.type}
                publishedAt={article.publishedAt}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
