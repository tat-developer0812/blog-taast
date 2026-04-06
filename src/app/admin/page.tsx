import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const [totalArticles, publishedArticles, lastSync] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: "published" } }),
    prisma.syncLog.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const draftArticles = totalArticles - publishedArticles;

  const cards = [
    { label: "Tổng bài viết", value: totalArticles, href: "/admin/articles", color: "bg-blue-600" },
    { label: "Đã xuất bản", value: publishedArticles, href: "/admin/articles", color: "bg-green-600" },
    { label: "Bản nháp", value: draftArticles, href: "/admin/articles", color: "bg-yellow-600" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`${card.color} rounded-2xl p-6 flex flex-col gap-2 hover:opacity-90 transition`}
          >
            <span className="text-sm text-white/80">{card.label}</span>
            <span className="text-4xl font-bold text-white">{card.value}</span>
          </Link>
        ))}
      </div>
      <div className="bg-gray-900 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-3">Sync gần nhất</h2>
        {lastSync ? (
          <div className="text-sm text-gray-400 space-y-1">
            <p><span className="text-gray-200 font-medium">Loại:</span> {lastSync.type}</p>
            <p>
              <span className="text-gray-200 font-medium">Trạng thái:</span>{" "}
              <span className={lastSync.status === "success" ? "text-green-400" : "text-red-400"}>
                {lastSync.status}
              </span>
            </p>
            <p>
              <span className="text-gray-200 font-medium">Thời gian:</span>{" "}
              {new Date(lastSync.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Chưa có sync nào.</p>
        )}
        <Link href="/admin/sync" className="inline-block mt-4 text-blue-400 hover:underline text-sm">
          Xem tất cả sync logs →
        </Link>
      </div>
    </div>
  );
}
