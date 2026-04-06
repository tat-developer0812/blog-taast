import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Bảng xếp hạng World Cup 2026",
  description:
    "Bảng xếp hạng vòng bảng World Cup 2026. Thứ hạng, điểm số, hiệu số bàn thắng của tất cả 12 bảng đấu.",
  openGraph: {
    title: "Bảng xếp hạng World Cup 2026",
    description:
      "Bảng xếp hạng vòng bảng World Cup 2026. Thứ hạng, điểm số, hiệu số bàn thắng của tất cả 12 bảng đấu.",
  },
  alternates: { canonical: "/world-cup/standings" },
};

export const revalidate = 3600;

export default async function StandingsPage() {
  const competition = await prisma.competition.findFirst({
    where: { code: "WC" },
  });

  const standings = competition
    ? await prisma.standing.findMany({
        where: { competitionId: competition.id },
        include: { team: true },
        orderBy: [{ groupName: "asc" }, { position: "asc" }],
      })
    : [];

  const groups = standings.reduce<Record<string, typeof standings>>(
    (acc, s) => {
      if (!acc[s.groupName]) acc[s.groupName] = [];
      acc[s.groupName].push(s);
      return acc;
    },
    {}
  );

  const groupNames = Object.keys(groups).sort();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--foreground)]">Trang chủ</Link>
        <span>/</span>
        <Link href="/world-cup" className="hover:text-[var(--foreground)]">World Cup 2026</Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">Bảng xếp hạng</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bảng xếp hạng</h1>
          <p className="mt-1 text-[var(--muted)]">World Cup 2026 · Vòng bảng</p>
        </div>
        <Link
          href="/world-cup/bracket"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Xem nhánh đấu loại trực tiếp →
        </Link>
      </div>

      {groupNames.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <p className="text-[var(--muted)]">
            Bảng xếp hạng chưa có dữ liệu. Vui lòng kiểm tra lại sau khi giải đấu bắt đầu.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {groupNames.map((groupName) => {
            const rows = groups[groupName];
            const label = groupName.startsWith("GROUP_")
              ? `Bảng ${groupName.replace("GROUP_", "")}`
              : groupName;

            return (
              <section key={groupName}>
                <h2 className="mb-3 text-lg font-bold">{label}</h2>
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--card)] text-[var(--muted)]">
                        <th className="w-8 px-3 py-2 text-center font-medium">#</th>
                        <th className="px-3 py-2 text-left font-medium">Đội tuyển</th>
                        <th className="px-3 py-2 text-center font-medium">Tr</th>
                        <th className="px-3 py-2 text-center font-medium">T</th>
                        <th className="px-3 py-2 text-center font-medium">H</th>
                        <th className="px-3 py-2 text-center font-medium">B</th>
                        <th className="px-3 py-2 text-center font-medium">HS</th>
                        <th className="px-3 py-2 text-center font-bold text-[var(--primary)]">Đ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-t border-[var(--border)] transition-colors hover:bg-[var(--card)] ${
                            row.position <= 2
                              ? "border-l-2 border-l-emerald-500"
                              : row.position === 3
                              ? "border-l-2 border-l-amber-400"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center font-medium text-[var(--muted)]">{row.position}</td>
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/teams/${row.team.slug}`}
                              className="flex items-center gap-2 font-medium hover:text-[var(--primary)]"
                            >
                              {row.team.crest && (
                                <img src={row.team.crest} alt={row.team.name} className="h-5 w-5 object-contain" />
                              )}
                              <span className="hidden sm:inline">{row.team.name}</span>
                              <span className="sm:hidden">{row.team.tla ?? row.team.shortName ?? row.team.name}</span>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-center text-[var(--muted)]">{row.playedGames}</td>
                          <td className="px-3 py-2.5 text-center">{row.won}</td>
                          <td className="px-3 py-2.5 text-center">{row.draw}</td>
                          <td className="px-3 py-2.5 text-center">{row.lost}</td>
                          <td className="px-3 py-2.5 text-center text-[var(--muted)]">
                            {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-[var(--primary)]">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {groupNames.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-1 rounded-full bg-emerald-500" />
            Vào vòng 1/32
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-1 rounded-full bg-amber-400" />
            Đội hạng 3 tốt nhất (8 suất)
          </span>
          <span className="ml-auto">
            Tr = Trận · T = Thắng · H = Hòa · B = Bại · HS = Hiệu số · Đ = Điểm
          </span>
        </div>
      )}
    </div>
  );
}
