import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-6xl font-bold text-[var(--primary)]">404</h1>
      <p className="mb-6 text-xl text-[var(--muted)]">
        Trang bạn tìm không tồn tại
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Trang chủ
        </Link>
        <Link
          href="/matches"
          className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--card)]"
        >
          Lịch thi đấu
        </Link>
      </div>
    </div>
  );
}
