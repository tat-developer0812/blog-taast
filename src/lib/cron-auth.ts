import { NextRequest } from "next/server";

/**
 * Verify that a cron request is authorized.
 * Vercel cron jobs send an Authorization header with CRON_SECRET.
 * For local dev, set CRON_SECRET in .env.
 */
export function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If no secret configured, allow in development
  if (!cronSecret) {
    return process.env.NODE_ENV === "development";
  }

  return authHeader === `Bearer ${cronSecret}`;
}
