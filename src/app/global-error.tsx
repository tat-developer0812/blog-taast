"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 max-w-md">
          <div className="text-5xl mb-6" aria-hidden="true">🚨</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Lỗi nghiêm trọng</h1>
          <p className="text-gray-600 mb-6">
            Hệ thống gặp sự cố. Đội ngũ kỹ thuật đã được thông báo.
          </p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Thử lại
          </button>
          {error.digest && (
            <p className="mt-4 text-xs text-gray-400">Digest: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
