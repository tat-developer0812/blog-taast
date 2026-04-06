import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { searchArticles, searchTeams, searchMatches } from "@/lib/search";
import { ArticleCard } from "@/components/article-card";
import { TeamCrest } from "@/components/team-crest";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Kết quả tìm kiếm: "${q}" — WC2026` : "Tìm kiếm — WC2026",
    description: "Tìm kiếm bài viết, đội tuyển và trận đấu World Cup 2026.",
    robots: { index: false },
  };
}

async function ArticleResults({ q }: { q: string }) {
  const articles = await searchArticles(q);
  if (articles.length === 0)
    return <p className="text-[var(--muted)]">Không tìm thấy bài viết nào.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <ArticleCard
          key={a.id}
          title={a.title}
          excerpt={a.excerpt}
          slug={a.slug}
          type={a.type}
          publishedAt={a.publishedAt}
        />
      ))}
    </div>
  );
}

async function TeamResults({ q }: { q: string }) {
  const teams = await searchTeams(q);
  if (teams.length === 0)
    return <p className="text-[var(--muted)]">Không tìm thấy đội tuyển nào.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((t) => (
        <li key={t.id}>
          <Link
            href={`/teams/${t.slug}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-4 transition-shadow hover:shadow-md"
          >
            <TeamCrest src={t.crest} alt={t.name} size="sm" />
            <div>
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-[var(--muted)]">
                {t.tla}{t.area ? ` · ${t.area}` : ""}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function MatchResults({ q }: { q: string }) {
  const matches = await searchMatches(q);
  if (matches.length === 0)
    return <p className="text-[var(--muted)]">Không tìm thấy trận đấu nào.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((m) => (
        <li key={m.id}>
          <Link
            href={`/matches/${m.slug}`}
            className="block rounded-xl border border-[var(--border)] p-4 transition-shadow hover:shadow-md"
          >
            <p className="font-semibold">
              {m.homeTeamName} vs {m.awayTeamName}
            </p>
            {m.homeScore !== null && m.awayScore !== null && (
              <p className="text-lg font-bold tabular-nums">
                {m.homeScore} — {m.awayScore}
              </p>
            )}
            <p className="text-xs text-[var(--muted)]">
              {new Intl.DateTimeFormat("vi-VN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Ho_Chi_Minh",
              }).format(new Date(m.utcDate))}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--card)]" />
      ))}
    </div>
  );
}

function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form method="GET" action="/search" className="mb-8">
      <div className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Tìm kiếm đội tuyển, trận đấu, bài viết..."
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
          autoFocus
          minLength={2}
          maxLength={200}
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
        >
          Tìm
        </button>
      </div>
    </form>
  );
}

const TABS = [
  { value: "all",      label: "Tất cả"    },
  { value: "articles", label: "Bài viết"  },
  { value: "teams",    label: "Đội tuyển" },
  { value: "matches",  label: "Trận đấu"  },
];

function TabBar({ q, activeTab }: { q: string; activeTab: string }) {
  return (
    <div className="mb-6 flex gap-1 border-b border-[var(--border)]">
      {TABS.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <Link
            key={tab.value}
            href={`/search?q=${encodeURIComponent(q)}&type=${tab.value}`}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q = "", type = "all" } = await searchParams;
  const activeTab = TABS.some((t) => t.value === type) ? type : "all";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Tìm kiếm</h1>
      <SearchForm defaultValue={q} />

      {q.length >= 2 ? (
        <>
          <TabBar q={q} activeTab={activeTab} />

          {(activeTab === "all" || activeTab === "articles") && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Bài viết</h2>
              <Suspense fallback={<ResultsSkeleton />}>
                <ArticleResults q={q} />
              </Suspense>
            </section>
          )}

          {(activeTab === "all" || activeTab === "teams") && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Đội tuyển</h2>
              <Suspense fallback={<ResultsSkeleton />}>
                <TeamResults q={q} />
              </Suspense>
            </section>
          )}

          {(activeTab === "all" || activeTab === "matches") && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Trận đấu</h2>
              <Suspense fallback={<ResultsSkeleton />}>
                <MatchResults q={q} />
              </Suspense>
            </section>
          )}
        </>
      ) : (
        <p className="text-[var(--muted)]">
          Nhập ít nhất 2 ký tự để bắt đầu tìm kiếm.
        </p>
      )}
    </main>
  );
}
