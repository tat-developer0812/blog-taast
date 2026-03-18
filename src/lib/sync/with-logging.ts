import { prisma } from "@/lib/db";

/**
 * Wraps a sync function with logging to the sync_logs table.
 */
export async function withSyncLogging<T>(
  type: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - start;

    await prisma.syncLog.create({
      data: {
        type,
        status: "success",
        result: JSON.stringify(result),
        duration,
      },
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const message =
      error instanceof Error ? error.message : String(error);

    await prisma.syncLog
      .create({
        data: {
          type,
          status: "error",
          error: message,
          duration,
        },
      })
      .catch(() => {
        // Don't let logging failure mask the original error
      });

    throw error;
  }
}
