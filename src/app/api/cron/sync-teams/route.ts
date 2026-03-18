import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyCronAuth } from "@/lib/cron-auth";
import { syncTeams, syncPlayers } from "@/lib/sync";
import { withSyncLogging } from "@/lib/sync/with-logging";

export const runtime = "nodejs";
export const maxDuration = 300; // players sync is slow due to rate limiting

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const syncPlayersParam =
    request.nextUrl.searchParams.get("players") !== "false";

  try {
    const teamsResult = await withSyncLogging("teams", syncTeams);
    let playersResult = null;

    if (syncPlayersParam) {
      playersResult = await withSyncLogging("players", syncPlayers);
    }

    revalidatePath("/");
    revalidatePath("/teams");

    return NextResponse.json(
      {
        success: true,
        teams: teamsResult,
        players: playersResult,
        syncedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Teams sync failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
