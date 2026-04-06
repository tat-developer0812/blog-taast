import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MatchCard } from "@/components/match-card";
import { teamJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { JsonLd } from "@/components/json-ld";
import { ShareButtons } from "@/components/share-buttons";
import { RelatedArticles } from "@/components/related-articles";
import { TeamCrest } from "@/components/team-crest";
import { ArticleReadTracker } from "@/components/article-read-tracker";

interface Props {
  params: { slug: string };
}

export const revalidate = 3600;

export async function generateStaticParams() {
  const teams = await prisma.team.findMany({ select: { slug: true } });
  return teams.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = await prisma.team.findUnique({ where: { slug: params.slug } });
  if (!team) return { title: "Đội tuyển" };

  const article = await prisma.article.findFirst({
    where: { type: "team_history", teamId: team.id },
  });

  const title = article?.seoTitle || `${team.name} - World Cup 2026`;
  const description =
    article?.seoDescription ||
    `Thông tin đội tuyển ${team.name} tại World Cup 2026`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: team.crest ? [{ url: team.crest, alt: team.name }] : [],
    },
    alternates: {
      canonical: `/teams/${team.slug}`,
    },
  };
}

export default async function TeamPage({ params }: Props) {
  const team = await prisma.team.findUnique({
    where: { slug: params.slug },
    include: { players: { orderBy: { position: "asc" } } },
  });

  if (!team) notFound();

  const [article, matches] = await Promise.all([
    prisma.article.findFirst({
      where: { type: "team_history", teamId: team.id, status: "published" },
    }),
    prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { utcDate: "asc" },
      take: 10,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd data={teamJsonLd(team)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Trang chủ", href: "/" },
          { name: "Đội tuyển", href: "/teams" },
          { name: team.name, href: `/teams/${team.slug}` },
        ])}
      />
      {/* Team header */}
      <div className="mb-8 flex items-center gap-4">
        <TeamCrest src={team.crest} alt={team.name} size="xl" priority />
        <div>
          <h1 className="text-3xl font-bold">{team.name}</h1>
          <p className="text-[var(--muted)]">
            {team.area}
            {team.coach ? ` | HLV: ${team.coach}` : ""}
          </p>
        </div>
      </div>

      {/* Article content */}
      {article ? (
        <section className="mb-10">
          <MarkdownRenderer content={article.content} />
        </section>
      ) : (
        <section className="mb-10">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="mb-2 text-xl font-semibold">Thông tin đội tuyển</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {team.founded && (
                <>
                  <dt className="text-[var(--muted)]">Thành lập</dt>
                  <dd>{team.founded}</dd>
                </>
              )}
              {team.venue && (
                <>
                  <dt className="text-[var(--muted)]">Sân nhà</dt>
                  <dd>{team.venue}</dd>
                </>
              )}
              {team.coach && (
                <>
                  <dt className="text-[var(--muted)]">HLV trưởng</dt>
                  <dd>{team.coach}</dd>
                </>
              )}
            </dl>
          </div>
        </section>
      )}

      {/* Matches */}
      {matches.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">Lịch thi đấu</h2>
          <div className="grid gap-3">
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

      <ArticleReadTracker slug={team.slug} />

      {/* Related articles */}
      <RelatedArticles
        currentId={article?.id ?? 0}
        teamId={team.id}
        type="team_history"
      />

      {/* Share */}
      <div className="mt-10">
        <ShareButtons url={`/teams/${team.slug}`} title={`${team.name} - World Cup 2026`} />
      </div>
    </div>
  );
}
