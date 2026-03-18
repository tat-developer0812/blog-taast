import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";

/**
 * On-demand revalidation endpoint.
 * Called after data sync to immediately refresh affected pages.
 *
 * POST /api/revalidate
 * Body: { paths: ["/teams/brazil", "/matches"] }
 */
export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const paths: string[] = Array.isArray(body.paths)
    ? body.paths.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];

  if (paths.length === 0) {
    return NextResponse.json(
      { error: "No paths provided" },
      { status: 400 }
    );
  }

  const results: { path: string; revalidated: boolean }[] = [];

  for (const path of paths) {
    try {
      revalidatePath(path);
      results.push({ path, revalidated: true });
    } catch (err) {
      console.error(`revalidatePath failed for ${path}:`, err);
      results.push({ path, revalidated: false });
    }
  }

  return NextResponse.json({ success: true, results });
}
