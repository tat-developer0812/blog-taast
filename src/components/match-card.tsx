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
  // Live overlay props — provided by useLiveScores hook
  isLive?: boolean;
  liveHomeScore?: number | null;
  liveAwayScore?: number | null;
  liveStatus?: string;
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
  isLive = false,
  liveHomeScore,
  liveAwayScore,
  liveStatus,
}: MatchCardProps) {
  const effectiveStatus = liveStatus ?? status;
  const effectiveHomeScore = liveHomeScore !== undefined ? liveHomeScore : homeScore;
  const effectiveAwayScore = liveAwayScore !== undefined ? liveAwayScore : awayScore;

  const displayLive =
    isLive ||
    effectiveStatus === "LIVE" ||
    effectiveStatus === "IN_PLAY";
  const isFinished = effectiveStatus === "FINISHED";
  const isPaused = effectiveStatus === "PAUSED";

  const stageLabel = stage ? STAGE_LABELS[stage] || stage : "";
  const statusLabel = STATUS_LABELS[effectiveStatus] || effectiveStatus;

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
      className="group relative block rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 transition-shadow hover:shadow-lg"
    >
      {/* Live badge */}
      {(displayLive || isPaused) && (
        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {displayLive && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          )}
          {isPaused ? "GIẢI LAO" : "TRỰC TIẾP"}
        </span>
      )}

      <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          {stageLabel}
          {group ? ` - ${group}` : ""}
        </span>
        <span
          className={
            displayLive
              ? "font-semibold text-red-500"
              : isFinished
                ? "text-[var(--accent)]"
                : ""
          }
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-right">
          <p className="text-sm font-medium">{homeTla || homeTeam}</p>
          <p className="text-xs text-[var(--muted)]">{homeTeam}</p>
        </div>

        <div className="flex min-w-[80px] items-center justify-center gap-2 text-center">
          {isFinished || displayLive || isPaused ? (
            <span
              className={`text-2xl font-bold tabular-nums ${
                displayLive ? "text-red-600" : ""
              }`}
            >
              {effectiveHomeScore} - {effectiveAwayScore}
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
