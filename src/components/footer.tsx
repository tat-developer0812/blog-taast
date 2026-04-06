import Link from "next/link";
import { NewsletterForm } from "@/components/newsletter-form";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h3 className="mb-3 text-lg font-bold text-[var(--primary)]">
              WC2026
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Trang tin bóng đá World Cup 2026 hàng đầu cho người hâm mộ Việt
              Nam. Cập nhật tin tức, dự đoán và phân tích chuyên sâu.
            </p>
          </div>

          <div>
            <h4 className="mb-3 font-semibold">Danh mục</h4>
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              <li>
                <Link href="/teams" className="hover:text-[var(--primary)]">
                  Đội tuyển
                </Link>
              </li>
              <li>
                <Link href="/matches" className="hover:text-[var(--primary)]">
                  Lịch thi đấu
                </Link>
              </li>
              <li>
                <Link
                  href="/predictions"
                  className="hover:text-[var(--primary)]"
                >
                  Dự đoán
                </Link>
              </li>
              <li>
                <Link
                  href="/world-cup"
                  className="hover:text-[var(--primary)]"
                >
                  World Cup
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <NewsletterForm compact />
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--border)] pt-4 text-center text-sm text-[var(--muted)]">
          &copy; 2026 WC2026. Dữ liệu cung cấp bởi football-data.org
        </div>
      </div>
    </footer>
  );
}
