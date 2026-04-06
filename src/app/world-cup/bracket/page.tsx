import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Nhánh đấu loại trực tiếp World Cup 2026",
  description:
    "Nhánh đấu vòng loại trực tiếp World Cup 2026: vòng 1/32, tứ kết, bán kết và chung kết.",
  openGraph: {
    title: "Nhánh đấu loại trực tiếp World Cup 2026",
    description:
      "Nhánh đấu vòng loại trực tiếp World Cup 2026: vòng 1/32, tứ kết, bán kết và chung kết.",
  },
  alternates: { canonical: "/world-cup/bracket" },
};

export const revalidate = 3600;

const KNOCKOUT_STAGES = [
  { key: "ROUND_OF_32", label: "Vòng 1/32" },
  { key: "ROUND_OF_16", label: "Vòng 1/16" },
  { key: "QUARTER_FINALS", label: "Tứ kết" },
  { key: "SEMI_FINALS", label: "Bán kết" },
  { key: "THIRD_PLACE", label: "Tranh hạng 3" },
  { key: "FINAL", label: "Chung kết" },
] as const;

interface MatchWithTeams {
  id: number;
  slug: string;
  stage: string | null;
  utcDate: Date;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  status: string;
  homeTeam: { name: string; tla: string | null; shortName: string | null; crest: string | null; slug: string };
  awayTeam: { name: string; tla: string | null; shortName: string | null; crest: string | null; slug: string };
}

function MatchSlot({ match }: { match: MatchWithTeams }) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  const isFinished = match.status === "FINISHED" || match.status === "AWARDED";
  const homeWon = match.winner === "HOME_TEAM";
  const awayWon = match.winner === "AWAY_TEAM";

  return (
    <Link
      href={`/matches/${match.slug}`}
      className="block rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm transition-shadow hover:shadow-md"
    >
      <div className={`flex items-center gap-2 px-3 py-2 ${homeWon ? "font-semibold" : ""}`}>
        {home.crest && <img src={home.crest} alt={home.name} className="h-5 w-5 object-contain" />}
        <span className="flex-1 truncate">{home.tla ?? home.shortName ?? home.name}</span>
        {isFinished && <span className={homeWon ? "text-[var(--primary)]" : "text-[var(--muted)]"}>{match.homeScore}</span>}
      </div>
      <div className="h-px bg-[var(--border)]" />
      <div className={`flex items-center gap-2 px-3 py-2 ${awayWon ? "font-semibold" : ""}`}>
        {away.crest && <img src={away.crest} alt={away.name} className="h-5 w-5 object-contain" />}
        <span className="flex-1 truncate">{away.tla ?? away.shortName ?? away.name}</span>
        {isFinished && <span className={awayWon ? "text-[var(--primary)]" : "text-[var(--muted)]"}>{match.awayScore}</span>}
      </div>
    </Link>
  );
}

function PlaceholderSlot() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] text-sm opacity-50">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-5 w-5 rounded-full bg-[var(--border)]" />
        <span className="text-[var(--muted)]">TBD</span>
      </div>
      <div className="h-px bg-[var(--border)]" />
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-5 w-5 rounded-full bg-[var(--border)]" />
        <span className="text-[var(--muted)]">TBD</span>
      </div>
    </div>
  );
}

export default async function BracketPage() {
  const competition = await prisma.competition.findFirst({ where: { code: "WC" } });

  const knockoutMatches: MatchWithTeams[] = competition
    ? await prisma.match.findMany({
        where: {
          competitionId: competition.id,
          stage: { in: KNOCKOUT_STAGES.map((s) => s.key) },
        },
        include: {
          homeTeam: { select: { name: true, tla: true, shortName: true, crest: true, slug: true } },
          awayTeam: { select: { name: true, tla: true, shortName: true, crest: true, slug: true } },
        },
        orderBy: { utcDate: "asc" },
      })
    : [];

  const matchesByStage = knockoutMatches.reduce<Record<string, MatchWithTeams[]>>((acc, m) => {
    const stage = m.stage ?? "UNKNOWN";
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(m);
    return acc;
  }, {});

  const stageCounts: Record<string, number> = {
    ROUND_OF_32: 32,
    ROUND_OF_16: 16,
    QUARTER_FINALS: 8,
    SEMI_FINALS: 4,
    THIRD_PLACE: 1,
    FINAL: 1,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--foreground)]">Trang chủ</Link>
        <span>/</span>
        <Link href="/world-cup" className="hover:text-[var(--foreground)]">World Cup 2026</Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">Nhánh đấu loại trực tiếp</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Nhánh đấu loại trực tiếp</h1>
          <p className="mt-1 text-[var(--muted)]">World Cup 2026 · 32 đội</p>
        </div>
        <Link
          href="/world-cup/standings"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--card)]"
        >
          ← Bảng xếp hạng vòng bảng
        </Link>
      </div>

      {knockoutMatches.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <p className="text-[var(--muted)]">
            Nhánh đấu loại trực tiếp chưa có dữ liệu. Vui lòng kiểm tra lại sau khi vòng bảng kết thúc.
          </p>
          <Link href="/world-cup/standings" className="mt-4 inline-block text-sm text-[var(--primary)] hover:underline">
            Xem bảng xếp hạng vòng bảng
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {KNOCKOUT_STAGES.map(({ key, label }) => {
            const stageMatches = matchesByStage[key] ?? [];
            const expectedCount = stageCounts[key] ?? 0;
            const placeholdersNeeded = Math.max(0, expectedCount / 2 - stageMatches.length);

            if (stageMatches.length === 0 && expectedCount > 8) return null;

            return (
              <section key={key}>
                <h2 className="mb-4 text-xl font-bold">{label}</h2>
                <div
                  className={`grid gap-3 ${
                    key === "FINAL" || key === "THIRD_PLACE"
                      ? "max-w-xs"
                      : key === "SEMI_FINALS"
                      ? "grid-cols-2 sm:max-w-lg"
                      : key === "QUARTER_FINALS"
                      ? "grid-cols-2 sm:grid-cols-4"
                      : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
                  }`}
                >
                  {stageMatches.map((match) => <MatchSlot key={match.id} match={match} />)}
                  {Array.from({ length: placeholdersNeeded }).map((_, i) => <PlaceholderSlot key={`ph-${i}`} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
