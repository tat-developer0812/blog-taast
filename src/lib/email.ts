import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = "WC2026 <noreply@wc2026.vn>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wc2026.vn";

export async function sendWelcomeEmail(
  email: string,
  unsubscribeToken: string
): Promise<void> {
  if (!resend) {
    return;
  }

  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${unsubscribeToken}`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: "Chào mừng bạn đến với WC2026!",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="color:#1d4ed8;margin-bottom:8px;">World Cup 2026</h1>
        <p style="color:#374151;">
          Cảm ơn bạn đã đăng ký nhận bản tin WC2026!
          Chúng tôi sẽ gửi cho bạn tin tức mới nhất, dự đoán và phân tích
          chuyên sâu về World Cup 2026.
        </p>
        <p style="margin-top:32px;font-size:12px;color:#9ca3af;">
          Nếu bạn không muốn nhận email nữa, hãy
          <a href="${unsubscribeUrl}" style="color:#6b7280;">hủy đăng ký tại đây</a>.
        </p>
      </div>
    `,
  });
}
