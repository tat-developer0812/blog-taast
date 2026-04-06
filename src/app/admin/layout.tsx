import Link from "next/link";
import type { ReactNode } from "react";

const navLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/articles", label: "Bài viết" },
  { href: "/admin/sync", label: "Sync Logs" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-950 text-white">
      <aside className="w-56 shrink-0 bg-gray-900 flex flex-col py-6 px-4">
        <div className="text-lg font-bold text-white mb-8 px-2">⚽ WC2026 Admin</div>
        <nav className="flex-1 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition text-sm"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <a
          href="/api/admin/logout"
          className="block px-3 py-2 rounded-lg text-red-400 hover:bg-gray-800 transition text-sm mt-4"
        >
          Đăng xuất
        </a>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
