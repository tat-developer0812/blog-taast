import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface LiveMatch {
  id: number;
  slug: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: number;
  awayTeamId: number;
  updatedAt: Date;
}

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      where: {
        status: { in: ["IN_PLAY", "PAUSED"] },
      },
      select: {
        id: true,
        slug: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeamId: true,
        awayTeamId: true,
        updatedAt: true,
      },
      orderBy: { utcDate: "asc" },
    });

    return NextResponse.json(matches, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[live-scores] DB query failed:", err);
    return NextResponse.json(
      { error: "Live scores temporarily unavailable." },
      { status: 500 }
    );
  }
}
