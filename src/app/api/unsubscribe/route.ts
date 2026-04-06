import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(renderPage("Lỗi", "Thiếu token hủy đăng ký."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { unsubscribeToken: token },
  });

  if (!subscriber) {
    return new NextResponse(
      renderPage("Không tìm thấy", "Token không hợp lệ hoặc đã hết hạn."),
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  if (subscriber.unsubscribedAt !== null) {
    return new NextResponse(
      renderPage("Đã hủy", "Bạn đã hủy đăng ký trước đó rồi."),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  await prisma.subscriber.update({
    where: { unsubscribeToken: token },
    data: { unsubscribedAt: new Date(), confirmedAt: null },
  });

  return new NextResponse(
    renderPage(
      "Hủy đăng ký thành công",
      "Bạn đã hủy đăng ký nhận bản tin WC2026. Hẹn gặp lại!"
    ),
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — WC2026</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0;
           background: #f9fafb; color: #111827; }
    .card { background: #fff; border-radius: 12px; padding: 40px 48px;
            box-shadow: 0 1px 6px rgba(0,0,0,.08); text-align: center;
            max-width: 480px; }
    h1 { color: #1d4ed8; margin-bottom: 12px; }
    a { color: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top:24px"><a href="/">Quay về trang chủ</a></p>
  </div>
</body>
</html>`;
}
