import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { status } = await request.json();

  if (!["draft", "published"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const article = await prisma.article.update({
    where: { id: parseInt(params.id, 10) },
    data: {
      status,
      publishedAt: status === "published" ? new Date() : null,
    },
  });

  return NextResponse.json(article);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.article.delete({ where: { id: parseInt(params.id, 10) } });
  return NextResponse.json({ ok: true });
}
