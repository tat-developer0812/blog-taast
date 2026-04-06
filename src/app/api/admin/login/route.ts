import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const secret = process.env.ADMIN_SECRET ?? "";

  if (!secret || password !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await createSession(secret);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
