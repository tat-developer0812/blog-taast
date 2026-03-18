import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Trang chủ" },
  { href: "/teams", label: "Đội tuyển" },
  { href: "/matches", label: "Lịch thi đấu" },
  { href: "/predictions", label: "Dự đoán" },
  { href: "/blog", label: "Tin tức" },
  { href: "/world-cup", label: "World Cup" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[var(--primary)]">
              WC2026
            </span>
            <span className="hidden text-sm text-[var(--muted)] sm:inline">
              World Cup 2026
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
