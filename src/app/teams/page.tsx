import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { TeamCrest } from "@/components/team-crest";

export const metadata: Metadata = {
  title: "Đội tuyển World Cup 2026",
  description:
    "Danh sách tất cả đội tuyển tham dự World Cup 2026. Thông tin đội hình, lịch sử và phân tích.",
};

export const revalidate = 86400; // daily

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
  });

  // Group teams by area/continent
  const grouped: Record<string, typeof teams> = {};
  for (const team of teams) {
    const area = team.area || "Khác";
    if (!grouped[area]) grouped[area] = [];
    grouped[area].push(team);
  }
  const sortedAreas = Object.keys(grouped).sort();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Đội tuyển World Cup 2026</h1>
      <p className="mb-8 text-[var(--muted)]">
        {teams.length} đội tuyển tham dự World Cup 2026 tại Hoa Kỳ, Canada và
        Mexico.
      </p>

      {sortedAreas.map((area) => (
        <section key={area} className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">{area}</h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {grouped[area].map((team, index) => (
              <Link
                key={team.id}
                href={`/teams/${team.slug}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-4 transition-shadow hover:shadow-md"
              >
                <TeamCrest src={team.crest} alt={team.name} size="md" priority={index === 0} />
                <div>
                  <p className="font-medium">{team.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {team.tla || team.shortName}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
