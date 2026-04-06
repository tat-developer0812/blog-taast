import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyCronAuth } from "@/lib/cron-auth";
import { syncStandings } from "@/lib/sync";
import { withSyncLogging } from "@/lib/sync/with-logging";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await withSyncLogging("standings", syncStandings);

    revalidatePath("/world-cup/standings");
    revalidatePath("/world-cup/bracket");
    revalidatePath("/world-cup");

    return NextResponse.json(
      { success: true, standings: result, syncedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Standings sync failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
