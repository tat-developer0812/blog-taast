import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ArticleCard } from "@/components/article-card";

export const metadata: Metadata = {
  title: "Tin tức bóng đá World Cup 2026",
  description:
    "Cập nhật tin tức mới nhất về World Cup 2026. Nhận định, dự đoán, phân tích đội tuyển và lịch sử đối đầu.",
};

export const revalidate = 1800;

export default async function BlogPage() {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  // Group by type for filter
  const types = Array.from(new Set(articles.map((a) => a.type)));

  const TYPE_LABELS: Record<string, string> = {
    match_preview: "Nhận định",
    prediction: "Dự đoán",
    team_history: "Đội tuyển",
    h2h: "Đối đầu",
    world_cup_history: "Lịch sử",
    tournament_analysis: "Phân tích",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Tin tức World Cup 2026</h1>
      <p className="mb-6 text-[var(--muted)]">
        {articles.length} bài viết mới nhất
      </p>

      {/* Type tags */}
      <div className="mb-8 flex flex-wrap gap-2">
        {types.map((type) => (
          <span
            key={type}
            className="rounded-full bg-[var(--card)] px-3 py-1 text-sm text-[var(--muted)]"
          >
            {TYPE_LABELS[type] || type} (
            {articles.filter((a) => a.type === type).length})
          </span>
        ))}
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

      {articles.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="text-lg text-[var(--muted)]">
            Chưa có bài viết nào. Nội dung sẽ sớm được cập nhật.
          </p>
        </div>
      )}
    </div>
  );
}
