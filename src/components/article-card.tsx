import Link from "next/link";

interface ArticleCardProps {
  title: string;
  excerpt: string | null;
  slug: string;
  type: string;
  publishedAt: Date | null;
}

const TYPE_LABELS: Record<string, string> = {
  match_preview: "Nhận định",
  prediction: "Dự đoán",
  team_history: "Đội tuyển",
  h2h: "Đối đầu",
  world_cup_history: "Lịch sử",
  tournament_analysis: "Phân tích",
};

const TYPE_COLORS: Record<string, string> = {
  match_preview: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  prediction: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  team_history: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  h2h: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  world_cup_history: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  tournament_analysis: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function getArticleHref(slug: string, type: string): string {
  switch (type) {
    case "match_preview":
      return `/matches/${slug}`;
    case "prediction":
      return `/predictions/${slug}`;
    case "team_history":
      return `/teams/${slug}`;
    default:
      return `/blog/${slug}`;
  }
}

export function ArticleCard({
  title,
  excerpt,
  slug,
  type,
  publishedAt,
}: ArticleCardProps) {
  const href = getArticleHref(slug, type);
  const label = TYPE_LABELS[type] || type;
  const color = TYPE_COLORS[type] || "bg-gray-100 text-gray-800";

  return (
    <article className="group rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 transition-shadow hover:shadow-lg">
      <Link href={href} className="block">
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
          >
            {label}
          </span>
          {publishedAt && (
            <time
              className="text-xs text-[var(--muted)]"
              dateTime={publishedAt.toISOString()}
            >
              {new Intl.DateTimeFormat("vi-VN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(publishedAt)}
            </time>
          )}
        </div>

        <h3 className="mb-2 text-lg font-semibold leading-snug group-hover:text-[var(--primary)]">
          {title}
        </h3>

        {excerpt && (
          <p className="line-clamp-2 text-sm text-[var(--muted)]">{excerpt}</p>
        )}
      </Link>
    </article>
  );
}
