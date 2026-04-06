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
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="text-2xl font-bold text-[var(--primary)]">
              WC2026
            </span>
            <span className="hidden text-sm text-[var(--muted)] sm:inline">
              World Cup 2026
            </span>
          </Link>

          {/* Search form — hidden on mobile, visible from md up */}
          <form
            method="GET"
            action="/search"
            className="hidden md:flex flex-1 max-w-xs"
          >
            <div className="flex w-full gap-1.5">
              <input
                type="search"
                name="q"
                placeholder="Tìm kiếm..."
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                minLength={2}
                maxLength={200}
              />
              <button
                type="submit"
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
                aria-label="Tìm kiếm"
              >
                Tìm
              </button>
            </div>
          </form>

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
            {/* Mobile search icon */}
            <Link
              href="/search"
              className="md:hidden rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              aria-label="Tìm kiếm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
