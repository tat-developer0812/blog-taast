import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { MatchesClientGrid } from "./matches-client-grid";

export const metadata: Metadata = {
  title: "Lịch thi đấu World Cup 2026",
  description:
    "Lịch thi đấu đầy đủ World Cup 2026. Xem tất cả trận đấu, tỷ số và kết quả.",
};

export const revalidate = 1800;

const STAGE_ORDER = [
  "GROUP_STAGE",
  "ROUND_OF_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

export const STAGE_LABELS: Record<string, string> = {
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

  const grouped: Record<string, typeof matches> = {};
  for (const match of matches) {
    const stage = match.stage || "OTHER";
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(match);
  }

  const orderedStages = STAGE_ORDER.filter((s) => grouped[s]);
  if (grouped["OTHER"]) orderedStages.push("OTHER");

  // Serialize for client component (Date → string)
  const serializedGrouped = Object.fromEntries(
    Object.entries(grouped).map(([stage, stageMatches]) => [
      stage,
      stageMatches.map((m) => ({ ...m, utcDate: m.utcDate.toISOString() })),
    ])
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Lịch thi đấu World Cup 2026</h1>
      <p className="mb-8 text-[var(--muted)]">
        {matches.length} trận đấu | Giờ Việt Nam (UTC+7)
      </p>

      <MatchesClientGrid
        grouped={serializedGrouped}
        orderedStages={orderedStages}
        stageLabelMap={STAGE_LABELS}
      />

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
