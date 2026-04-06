"use client";

import { useState, useRef, useEffect } from "react";
import { usePlausible } from "@/hooks/usePlausible";

interface ShareButtonsProps {
  /** Relative path, e.g. "/teams/brazil" — will be prefixed with NEXT_PUBLIC_BASE_URL */
  url: string;
  /** Page title passed to navigator.share and share URLs */
  title: string;
  /** Optional className wrapper override */
  className?: string;
}

export function ShareButtons({ url, title, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { trackEvent } = usePlausible();

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";

  if (process.env.NODE_ENV === "development" && !baseUrl) {
    console.warn("[ShareButtons] NEXT_PUBLIC_BASE_URL is not set — share URLs will be relative and broken.");
  }

  const fullUrl = `${baseUrl}${url}`;

  // Fix 1: null out opener to prevent reverse tabnapping
  const handleNativeShare = async () => {
    trackEvent("Share", { method: "facebook" });
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    const popup = window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
      "_blank",
      "width=600,height=400"
    );
    if (popup) popup.opener = null;
  };

  const handleZalo = () => {
    trackEvent("Share", { method: "zalo" });
    const popup = window.open(
      `https://zalo.me/share?url=${encodeURIComponent(fullUrl)}&title=${encodeURIComponent(title)}`,
      "_blank",
      "width=600,height=500"
    );
    if (popup) popup.opener = null;
  };

  // Fix 2: Remove execCommand fallback, show error state instead
  // Fix 4: Clean up setTimeout with useRef
  const handleCopy = async () => {
    trackEvent("Share", { method: "copy" });
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-HTTPS or permissions denied)
      setCopyError(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopyError(false), 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4"
      }
    >
      <span className="text-sm font-medium text-[var(--muted)]">
        Chia sẻ:
      </span>

      {/* Fix 6: aria-label reflects native share / OS share sheet, not just Facebook */}
      {/* Fix 7: type="button" + focus-visible ring */}
      <button
        type="button"
        onClick={handleNativeShare}
        aria-label="Chia sẻ trang này"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1877F2] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#1877F2] focus-visible:ring-offset-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
        Facebook
      </button>

      {/* Fix 5: Replace SVG <text> with HTML span; Fix 7: type="button" + focus-visible ring */}
      <button
        type="button"
        onClick={handleZalo}
        aria-label="Chia sẻ lên Zalo"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0068FF] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#0068FF] focus-visible:ring-offset-2"
      >
        <span className="flex h-4 w-4 items-center justify-center text-xs font-black leading-none" aria-hidden="true">Z</span>
        Zalo
      </button>

      {/* Fix 7: type="button" + focus-visible ring */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label={
          copyError
            ? "Không thể sao chép liên kết"
            : copied
            ? "Đã sao chép liên kết"
            : "Sao chép liên kết"
        }
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-offset-2 ${
          copyError
            ? "border-red-400 bg-red-50 text-red-600 focus-visible:ring-red-400 dark:bg-red-950 dark:text-red-300"
            : copied
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 focus-visible:ring-emerald-500 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] focus-visible:ring-[var(--border)]"
        }`}
      >
        {copyError ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="text-red-600 dark:text-red-300">Không thể sao chép</span>
          </>
        ) : copied ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            Đã sao chép!
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
              <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
            </svg>
            Sao chép link
          </>
        )}
      </button>
    </div>
  );
}
