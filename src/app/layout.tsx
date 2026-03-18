import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://wc2026.vn";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "World Cup 2026 - Tin tức, Dự đoán & Phân tích bóng đá",
    template: "%s | World Cup 2026",
  },
  description:
    "Cập nhật tin tức World Cup 2026, dự đoán kết quả, phân tích đội tuyển và lịch sử đối đầu. Trang tin bóng đá hàng đầu cho người hâm mộ Việt Nam.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "WC2026 - World Cup 2026",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: baseUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased font-[family-name:var(--font-geist-sans)]`}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
