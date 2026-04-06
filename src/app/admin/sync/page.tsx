import { prisma } from "@/lib/db";
import SyncTrigger from "./SyncTrigger";

const SYNC_TYPES = [
  { type: "matches", label: "Sync Trận đấu", endpoint: "/api/cron/sync-matches" },
  { type: "standings", label: "Sync Bảng xếp hạng", endpoint: "/api/cron/sync-standings" },
  { type: "articles", label: "Tạo bài viết tự động", endpoint: "/api/cron/generate-articles" },
];

export default async function AdminSyncPage() {
  const logs = await Promise.all(
    SYNC_TYPES.map(({ type }) =>
      prisma.syncLog.findFirst({
        where: { type },
        orderBy: { createdAt: "desc" },
      })
    )
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Sync & Cron Jobs</h1>
      <div className="space-y-4">
        {SYNC_TYPES.map(({ type, label, endpoint }, i) => {
          const log = logs[i];
          return (
            <div key={type} className="bg-gray-900 rounded-2xl p-6 flex items-center justify-between gap-6">
              <div className="flex-1">
                <p className="font-semibold text-white">{label}</p>
                {log ? (
                  <p className="text-xs text-gray-400 mt-1">
                    Lần cuối: {new Date(log.createdAt).toLocaleString("vi-VN")} —{" "}
                    <span className={log.status === "success" ? "text-green-400" : "text-red-400"}>
                      {log.status}
                    </span>
                    {log.duration ? ` (${log.duration}ms)` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Chưa chạy lần nào.</p>
                )}
              </div>
              <SyncTrigger endpoint={endpoint} label={label} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
