import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { sportsEventJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { JsonLd } from "@/components/json-ld";
import { ShareButtons } from "@/components/share-buttons";
import { RelatedArticles } from "@/components/related-articles";
import { TeamCrest } from "@/components/team-crest";
import { ArticleReadTracker } from "@/components/article-read-tracker";

interface Props {
  params: { slug: string };
}

export const revalidate = 1800;

export async function generateStaticParams() {
  const matches = await prisma.match.findMany({ select: { slug: true } });
  return matches.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const match = await prisma.match.findUnique({
    where: { slug: params.slug },
    include: { homeTeam: true, awayTeam: true },
  });

  if (!match) return { title: "Trận đấu" };

  const article = await prisma.article.findFirst({
    where: { type: "match_preview", matchId: match.id },
  });

  const title =
    article?.seoTitle ||
    `${match.homeTeam.name} vs ${match.awayTeam.name} - World Cup 2026`;
  const description =
    article?.seoDescription ||
    `Nhận định trận đấu ${match.homeTeam.name} vs ${match.awayTeam.name} tại World Cup 2026`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    alternates: {
      canonical: `/matches/${match.slug}`,
    },
  };
}

export default async function MatchDetailPage({ params }: Props) {
  const match = await prisma.match.findUnique({
    where: { slug: params.slug },
    include: { homeTeam: true, awayTeam: true, competition: true },
  });

  if (!match) notFound();

  const article = await prisma.article.findFirst({
    where: {
      type: "match_preview",
      matchId: match.id,
      status: "published",
    },
  });

  const predictionArticle = await prisma.article.findFirst({
    where: {
      type: "prediction",
      matchId: match.id,
      status: "published",
    },
  });

  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "LIVE" || match.status === "IN_PLAY";

  const dateStr = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(match.utcDate);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={sportsEventJsonLd({
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          utcDate: match.utcDate,
          slug: match.slug,
          venue: match.homeTeam.venue,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          status: match.status,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Trang chủ", href: "/" },
          { name: "Lịch thi đấu", href: "/matches" },
          { name: `${match.homeTeam.name} vs ${match.awayTeam.name}`, href: `/matches/${match.slug}` },
        ])}
      />
      {/* Score header */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white sm:p-8">
        <p className="mb-4 text-center text-sm text-slate-300">
          {match.competition.name} | {dateStr}
        </p>

        <div className="flex items-center justify-center gap-6 sm:gap-10">
          <div className="flex-1 text-center">
            <TeamCrest src={match.homeTeam.crest} alt={match.homeTeam.name} size="lg" priority />
            <p className="text-lg font-bold">{match.homeTeam.name}</p>
          </div>

          <div className="text-center">
            {isFinished || isLive ? (
              <p className="text-4xl font-bold tabular-nums sm:text-5xl">
                {match.homeScore} - {match.awayScore}
              </p>
            ) : (
              <p className="text-lg text-slate-300">VS</p>
            )}
            <p
              className={`mt-1 text-sm ${isLive ? "font-semibold text-red-400" : "text-slate-400"}`}
            >
              {isLive
                ? "Đang diễn ra"
                : isFinished
                  ? "Kết thúc"
                  : "Sắp diễn ra"}
            </p>
          </div>

          <div className="flex-1 text-center">
            <TeamCrest src={match.awayTeam.crest} alt={match.awayTeam.name} size="lg" priority />
            <p className="text-lg font-bold">{match.awayTeam.name}</p>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="mb-6 flex gap-2">
        {predictionArticle && (
          <Link
            href={`/predictions/${predictionArticle.slug}`}
            className="rounded-lg bg-purple-100 px-4 py-2 text-sm font-medium text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200"
          >
            Xem dự đoán
          </Link>
        )}
        <Link
          href={`/teams/${match.homeTeam.slug}`}
          className="rounded-lg bg-[var(--card)] px-4 py-2 text-sm hover:bg-[var(--border)]"
        >
          {match.homeTeam.name}
        </Link>
        <Link
          href={`/teams/${match.awayTeam.slug}`}
          className="rounded-lg bg-[var(--card)] px-4 py-2 text-sm hover:bg-[var(--border)]"
        >
          {match.awayTeam.name}
        </Link>
      </div>

      {/* Article content */}
      {article ? (
        <MarkdownRenderer content={article.content} />
      ) : (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="text-[var(--muted)]">
            Bài nhận định cho trận đấu này sẽ sớm được cập nhật.
          </p>
        </div>
      )}

      <ArticleReadTracker slug={match.slug} />

      <RelatedArticles
        currentId={article?.id ?? 0}
        matchId={match.id}
        teamId={match.homeTeamId}
        type="match_preview"
      />

      {/* Share */}
      <div className="mt-10">
        <ShareButtons
          url={`/matches/${match.slug}`}
          title={`${match.homeTeam.name} vs ${match.awayTeam.name} - World Cup 2026`}
        />
      </div>
    </div>
  );
}
