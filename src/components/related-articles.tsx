import { getRelatedArticles } from "@/lib/content/related";
import { ArticleCard } from "@/components/article-card";

interface RelatedArticlesProps {
  currentId: number;
  teamId?: number | null;
  matchId?: number | null;
  type?: string;
}

export async function RelatedArticles({
  currentId,
  teamId,
  matchId,
  type,
}: RelatedArticlesProps) {
  const articles = await getRelatedArticles(currentId, {
    teamId,
    matchId,
    type,
    limit: 3,
  });

  if (articles.length === 0) return null;

  return (
    <section className="mt-12 border-t border-[var(--border)] pt-10">
      <h2 className="mb-6 text-2xl font-bold">Bài viết liên quan</h2>
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
  );
}
