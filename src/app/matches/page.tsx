import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { MatchCard } from "@/components/match-card";

export const metadata: Metadata = {
  title: "Lịch thi đấu World Cup 2026",
  description:
    "Lịch thi đấu đầy đủ World Cup 2026. Xem tất cả trận đấu, tỷ số và kết quả.",
};

export const revalidate = 1800; // 30 minutes

const STAGE_ORDER = [
  "GROUP_STAGE",
  "ROUND_OF_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Vòng bảng",
  ROUND_OF_16: "Vòng 1/16",
  QUARTER_FINALS: "Tứ kết",
  SEMI_FINALS: "Bán kết",
  THIRD_PLACE: "Tranh hạng 3",
  FINAL: "Chung kết",
};

export default async function MatchesPage() {
  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true },
    orderBy: { utcDate: "asc" },
  });

  // Group by stage
  const grouped: Record<string, typeof matches> = {};
  for (const match of matches) {
    const stage = match.stage || "OTHER";
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(match);
  }

  const orderedStages = STAGE_ORDER.filter((s) => grouped[s]);
  if (grouped["OTHER"]) orderedStages.push("OTHER");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Lịch thi đấu World Cup 2026</h1>
      <p className="mb-8 text-[var(--muted)]">
        {matches.length} trận đấu | Giờ Việt Nam (UTC+7)
      </p>

      {orderedStages.map((stage) => (
        <section key={stage} className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">
            {STAGE_LABELS[stage] || stage}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[stage].map((match) => (
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
      ))}

      {matches.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="text-lg text-[var(--muted)]">
            Lịch thi đấu chưa được cập nhật. Vui lòng quay lại sau.
          </p>
        </div>
      )}
    </div>
  );
}
