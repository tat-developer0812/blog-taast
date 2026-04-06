import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof (body as Record<string, unknown>).email === "string"
      ? ((body as Record<string, unknown>).email as string).trim().toLowerCase()
      : "";

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Địa chỉ email không hợp lệ." },
      { status: 422 }
    );
  }

  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing && existing.unsubscribedAt === null && existing.confirmedAt !== null) {
    return NextResponse.json(
      { error: "Email này đã được đăng ký." },
      { status: 409 }
    );
  }

  const subscriber = await prisma.subscriber.upsert({
    where: { email },
    update: {
      unsubscribedAt: null,
      confirmedAt: new Date(),
    },
    create: {
      email,
      confirmedAt: new Date(),
    },
  });

  sendWelcomeEmail(email, subscriber.unsubscribeToken).catch((err) => {
    console.error("[newsletter] Failed to send welcome email:", err);
  });

  return NextResponse.json(
    { message: "Đăng ký thành công! Cảm ơn bạn." },
    { status: 200 }
  );
}
