import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "World Cup 2026 - Thông tin giải đấu",
  description:
    "Tất cả thông tin về World Cup 2026 tại Hoa Kỳ, Canada và Mexico. 48 đội tuyển, lịch thi đấu và phân tích.",
};

export const revalidate = 86400;

const WORLD_CUP_WINNERS = [
  { year: 2022, winner: "Argentina", runner: "France", host: "Qatar" },
  { year: 2018, winner: "France", runner: "Croatia", host: "Nga" },
  { year: 2014, winner: "Germany", runner: "Argentina", host: "Brazil" },
  { year: 2010, winner: "Spain", runner: "Netherlands", host: "Nam Phi" },
  { year: 2006, winner: "Italy", runner: "France", host: "Đức" },
  { year: 2002, winner: "Brazil", runner: "Germany", host: "Hàn Quốc/Nhật Bản" },
  { year: 1998, winner: "France", runner: "Brazil", host: "Pháp" },
  { year: 1994, winner: "Brazil", runner: "Italy", host: "Hoa Kỳ" },
  { year: 1990, winner: "Germany", runner: "Argentina", host: "Ý" },
  { year: 1986, winner: "Argentina", runner: "Germany", host: "Mexico" },
];

export default async function WorldCupPage() {
  const [teamCount, matchCount, articleCount] = await Promise.all([
    prisma.team.count(),
    prisma.match.count(),
    prisma.article.count({ where: { status: "published" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">World Cup 2026</h1>
      <p className="mb-8 text-[var(--muted)]">
        Giải vô địch bóng đá thế giới 2026 - Hoa Kỳ, Canada & Mexico
      </p>

      {/* Tournament info */}
      <section className="mb-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white sm:p-8">
        <h2 className="mb-4 text-2xl font-bold">Thông tin giải đấu</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-emerald-200">Số đội tham dự</p>
            <p className="text-3xl font-bold">48</p>
          </div>
          <div>
            <p className="text-sm text-emerald-200">Quốc gia đăng cai</p>
            <p className="text-3xl font-bold">3</p>
            <p className="text-sm text-emerald-200">
              USA, Canada, Mexico
            </p>
          </div>
          <div>
            <p className="text-sm text-emerald-200">Tổng trận đấu</p>
            <p className="text-3xl font-bold">104</p>
          </div>
          <div>
            <p className="text-sm text-emerald-200">Thời gian</p>
            <p className="text-xl font-bold">11/6 - 19/7/2026</p>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="mb-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Link
          href="/teams"
          className="rounded-xl border border-[var(--border)] p-6 transition-shadow hover:shadow-lg"
        >
          <p className="text-3xl font-bold text-[var(--primary)]">
            {teamCount}
          </p>
          <p className="text-lg font-semibold">Đội tuyển</p>
          <p className="text-sm text-[var(--muted)]">
            Xem thông tin tất cả đội tuyển
          </p>
        </Link>
        <Link
          href="/matches"
          className="rounded-xl border border-[var(--border)] p-6 transition-shadow hover:shadow-lg"
        >
          <p className="text-3xl font-bold text-[var(--primary)]">
            {matchCount}
          </p>
          <p className="text-lg font-semibold">Trận đấu</p>
          <p className="text-sm text-[var(--muted)]">
            Lịch thi đấu đầy đủ
          </p>
        </Link>
        <Link
          href="/blog"
          className="rounded-xl border border-[var(--border)] p-6 transition-shadow hover:shadow-lg"
        >
          <p className="text-3xl font-bold text-[var(--primary)]">
            {articleCount}
          </p>
          <p className="text-lg font-semibold">Bài viết</p>
          <p className="text-sm text-[var(--muted)]">
            Nhận định và phân tích
          </p>
        </Link>
        <Link
          href="/world-cup/standings"
          className="rounded-xl border border-[var(--border)] p-6 transition-shadow hover:shadow-lg"
        >
          <p className="text-3xl font-bold text-[var(--primary)]">12</p>
          <p className="text-lg font-semibold">Bảng xếp hạng</p>
          <p className="text-sm text-[var(--muted)]">Thứ hạng & điểm số 12 bảng đấu</p>
        </Link>
        <Link
          href="/world-cup/bracket"
          className="rounded-xl border border-[var(--border)] p-6 transition-shadow hover:shadow-lg"
        >
          <p className="text-3xl font-bold text-[var(--primary)]">32</p>
          <p className="text-lg font-semibold">Nhánh đấu loại trực tiếp</p>
          <p className="text-sm text-[var(--muted)]">Từ vòng 1/32 đến chung kết</p>
        </Link>
      </section>

      {/* Format */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold">Thể thức thi đấu</h2>
        <div className="rounded-xl border border-[var(--border)] p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">Vòng bảng</h3>
              <p className="text-sm text-[var(--muted)]">
                48 đội chia thành 12 bảng, mỗi bảng 4 đội. Hai đội đứng đầu
                mỗi bảng và 8 đội xếp thứ 3 tốt nhất sẽ đi tiếp.
              </p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Vòng loại trực tiếp</h3>
              <p className="text-sm text-[var(--muted)]">
                32 đội vào vòng 1/16, sau đó là tứ kết, bán kết và chung kết.
                Tổng cộng 104 trận đấu trong giải.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* History table */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">Lịch sử World Cup</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--card)]">
                <th className="px-4 py-3 text-left font-semibold">Năm</th>
                <th className="px-4 py-3 text-left font-semibold">
                  Vô địch
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Á quân
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Nước chủ nhà
                </th>
              </tr>
            </thead>
            <tbody>
              {WORLD_CUP_WINNERS.map((wc) => (
                <tr
                  key={wc.year}
                  className="border-t border-[var(--border)]"
                >
                  <td className="px-4 py-3 font-medium">{wc.year}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--primary)]">
                    {wc.winner}
                  </td>
                  <td className="px-4 py-3">{wc.runner}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {wc.host}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
