import Link from "next/link";

interface MatchCardProps {
  slug: string;
  homeTeam: string;
  awayTeam: string;
  homeTla: string | null;
  awayTla: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  utcDate: Date;
  stage: string | null;
  group: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Vòng bảng",
  ROUND_OF_16: "Vòng 1/16",
  QUARTER_FINALS: "Tứ kết",
  SEMI_FINALS: "Bán kết",
  THIRD_PLACE: "Tranh hạng 3",
  FINAL: "Chung kết",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Sắp diễn ra",
  TIMED: "Sắp diễn ra",
  LIVE: "Đang diễn ra",
  IN_PLAY: "Đang diễn ra",
  PAUSED: "Giải lao",
  FINISHED: "Kết thúc",
  POSTPONED: "Hoãn",
  CANCELLED: "Hủy",
};

export function MatchCard({
  slug,
  homeTeam,
  awayTeam,
  homeTla,
  awayTla,
  homeScore,
  awayScore,
  status,
  utcDate,
  stage,
  group,
}: MatchCardProps) {
  const isLive = status === "LIVE" || status === "IN_PLAY";
  const isFinished = status === "FINISHED";
  const stageLabel = stage ? STAGE_LABELS[stage] || stage : "";
  const statusLabel = STATUS_LABELS[status] || status;

  const dateStr = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(utcDate);

  return (
    <Link
      href={`/matches/${slug}`}
      className="group block rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 transition-shadow hover:shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          {stageLabel}
          {group ? ` - ${group}` : ""}
        </span>
        <span
          className={
            isLive
              ? "font-semibold text-red-500"
              : isFinished
                ? "text-[var(--accent)]"
                : ""
          }
        >
          {isLive ? `${statusLabel}` : statusLabel}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-right">
          <p className="text-sm font-medium">{homeTla || homeTeam}</p>
          <p className="text-xs text-[var(--muted)]">{homeTeam}</p>
        </div>

        <div className="flex min-w-[80px] items-center justify-center gap-2 text-center">
          {isFinished || isLive ? (
            <span className="text-2xl font-bold tabular-nums">
              {homeScore} - {awayScore}
            </span>
          ) : (
            <span className="text-sm text-[var(--muted)]">{dateStr}</span>
          )}
        </div>

        <div className="flex-1 text-left">
          <p className="text-sm font-medium">{awayTla || awayTeam}</p>
          <p className="text-xs text-[var(--muted)]">{awayTeam}</p>
        </div>
      </div>
    </Link>
  );
}
