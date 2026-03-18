import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ArticleCard } from "@/components/article-card";

export const metadata: Metadata = {
  title: "Dự đoán kết quả World Cup 2026",
  description:
    "Dự đoán tỷ số và kết quả các trận đấu World Cup 2026. Phân tích xác suất và nhận định chuyên gia.",
};

export const revalidate = 3600;

export default async function PredictionsPage() {
  const articles = await prisma.article.findMany({
    where: { type: "prediction", status: "published" },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Dự đoán World Cup 2026</h1>
      <p className="mb-8 text-[var(--muted)]">
        Dự đoán tỷ số và phân tích kết quả các trận đấu World Cup 2026.
      </p>

      {articles.length > 0 ? (
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
      ) : (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="text-lg text-[var(--muted)]">
            Các bài dự đoán sẽ sớm được cập nhật. Vui lòng quay lại sau.
          </p>
        </div>
      )}
    </div>
  );
}
