import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { JsonLd } from "@/components/json-ld";
import { ShareButtons } from "@/components/share-buttons";
import { RelatedArticles } from "@/components/related-articles";
import { ArticleReadTracker } from "@/components/article-read-tracker";

interface Props {
  params: { slug: string };
}

export const revalidate = 3600;

export async function generateStaticParams() {
  const articles = await prisma.article.findMany({
    where: { type: "prediction", status: "published" },
    select: { slug: true },
  });
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
  });

  if (!article) return { title: "Dự đoán" };

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt || "";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    alternates: {
      canonical: `/predictions/${article.slug}`,
    },
  };
}

export default async function PredictionPage({ params }: Props) {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    include: {
      match: {
        include: { homeTeam: true, awayTeam: true },
      },
    },
  });

  if (!article) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd data={articleJsonLd(article)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Trang chủ", href: "/" },
          { name: "Dự đoán", href: "/predictions" },
          {
            name: article.match
              ? `${article.match.homeTeam.name} vs ${article.match.awayTeam.name}`
              : article.title,
            href: `/predictions/${article.slug}`,
          },
        ])}
      />
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--primary)]">
          Trang chủ
        </Link>
        <span className="mx-2">/</span>
        <Link href="/predictions" className="hover:text-[var(--primary)]">
          Dự đoán
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--foreground)]">
          {article.match
            ? `${article.match.homeTeam.name} vs ${article.match.awayTeam.name}`
            : article.title}
        </span>
      </nav>

      {/* Related links */}
      {article.match && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`/matches/${article.match.slug}`}
            className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200"
          >
            Xem nhận định trận đấu
          </Link>
          <Link
            href={`/teams/${article.match.homeTeam.slug}`}
            className="rounded-lg bg-[var(--card)] px-4 py-2 text-sm hover:bg-[var(--border)]"
          >
            {article.match.homeTeam.name}
          </Link>
          <Link
            href={`/teams/${article.match.awayTeam.slug}`}
            className="rounded-lg bg-[var(--card)] px-4 py-2 text-sm hover:bg-[var(--border)]"
          >
            {article.match.awayTeam.name}
          </Link>
        </div>
      )}

      <MarkdownRenderer content={article.content} />

      {/* Published date */}
      {article.publishedAt && (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Cập nhật:{" "}
          {new Intl.DateTimeFormat("vi-VN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(article.publishedAt)}
        </p>
      )}

      <ArticleReadTracker slug={article.slug} />

      <RelatedArticles
        currentId={article.id}
        matchId={article.matchId}
        teamId={article.match?.homeTeam?.id ?? null}
        type="prediction"
      />

      {/* Share */}
      <div className="mt-10">
        <ShareButtons
          url={`/predictions/${article.slug}`}
          title={article.seoTitle ?? article.title}
        />
      </div>
    </div>
  );
}
