import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyCronAuth } from "@/lib/cron-auth";
import { syncMatches, syncLiveMatches } from "@/lib/sync";
import { withSyncLogging } from "@/lib/sync/with-logging";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ?mode=live for lightweight live-only sync
  const mode = request.nextUrl.searchParams.get("mode");

  try {
    const logType = mode === "live" ? "matches-live" : "matches";
    const result =
      mode === "live"
        ? await withSyncLogging(logType, syncLiveMatches)
        : await withSyncLogging(logType, syncMatches);

    revalidatePath("/");
    revalidatePath("/matches");

    return NextResponse.json(
      {
        success: true,
        mode: mode || "full",
        ...result,
        syncedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Matches sync failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
