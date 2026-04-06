# Social Sharing (Facebook & Zalo) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Add Facebook, Zalo, and clipboard share buttons to team, match, and prediction pages using a client-side component with no external SDK dependency.

**Architecture:** A single `"use client"` component `ShareButtons` uses the Web Share API as the primary path; it falls back to `window.open` share URLs for Facebook (`facebook.com/sharer`) and Zalo (`zalo.me/share`). OG metadata is already implemented (Phase 5), so shares will automatically render rich link previews. No backend changes required.

**Tech Stack:** Next.js 14 App Router (Client Component), TypeScript, TailwindCSS, Web Share API, `NEXT_PUBLIC_BASE_URL` env var.

---

## Pre-flight checks

```bash
npx tsc --noEmit
# Expected: no errors

# Verify NEXT_PUBLIC_BASE_URL is set in .env / Vercel environment
grep NEXT_PUBLIC_BASE_URL .env
# Expected: NEXT_PUBLIC_BASE_URL=https://your-domain.com  (or similar)
```

If `NEXT_PUBLIC_BASE_URL` is not set, add it to `.env` and Vercel project settings before deploying.

---

## Task 1 — Create `src/components/share-buttons.tsx`

**Create:** `src/components/share-buttons.tsx`

```tsx
"use client";

import { useState } from "react";

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

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";
  const fullUrl = `${baseUrl}${url}`;

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl });
        return;
      } catch (err) {
        // User cancelled or browser blocked — fall through to FB share
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    // Fallback: open Facebook sharer in popup
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
      "_blank",
      "width=600,height=400,noopener,noreferrer"
    );
  };

  const handleZalo = () => {
    window.open(
      `https://zalo.me/share?url=${encodeURIComponent(fullUrl)}&title=${encodeURIComponent(title)}`,
      "_blank",
      "width=600,height=500,noopener,noreferrer"
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — select text manually as final fallback
      const input = document.createElement("input");
      input.value = fullUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

      {/* Facebook / Web Share button */}
      <button
        onClick={handleNativeShare}
        aria-label="Chia sẻ lên Facebook"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1877F2] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
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

      {/* Zalo button */}
      <button
        onClick={handleZalo}
        aria-label="Chia sẻ lên Zalo"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0068FF] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          {/* Simple "Z" lettermark used as Zalo wordmark placeholder */}
          <text
            x="3"
            y="18"
            fontSize="16"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            Z
          </text>
        </svg>
        Zalo
      </button>

      {/* Copy link button */}
      <button
        onClick={handleCopy}
        aria-label={copied ? "Đã sao chép liên kết" : "Sao chép liên kết"}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
          copied
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)]"
        }`}
      >
        {copied ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            Đã sao chép!
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
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
```

### TypeScript check

```bash
npx tsc --noEmit
# Expected: no errors
```

---

## Task 2 — Add `ShareButtons` to `src/app/teams/[slug]/page.tsx`

**Modify:** `src/app/teams/[slug]/page.tsx`

### 2a. Add import at the top of the file

```typescript
import { ShareButtons } from "@/components/share-buttons";
```

### 2b. Add component in JSX

Locate the bottom of the team page's main content — after the players table/section and before the closing `</div>` of the outermost container — and insert:

```tsx
{/* Share */}
<div className="mt-10">
  <ShareButtons url={`/teams/${team.slug}`} title={`${team.name} - World Cup 2026`} />
</div>
```

---

## Task 3 — Add `ShareButtons` to `src/app/matches/[slug]/page.tsx`

**Modify:** `src/app/matches/[slug]/page.tsx`

### 3a. Add import

```typescript
import { ShareButtons } from "@/components/share-buttons";
```

### 3b. Add component in JSX

After the match article/analysis section and before the closing `</div>` of the outermost container:

```tsx
{/* Share */}
<div className="mt-10">
  <ShareButtons
    url={`/matches/${match.slug}`}
    title={`${match.homeTeam.name} vs ${match.awayTeam.name} - World Cup 2026`}
  />
</div>
```

---

## Task 4 — Add `ShareButtons` to `src/app/predictions/[slug]/page.tsx`

**Modify:** `src/app/predictions/[slug]/page.tsx`

### 4a. Add import

```typescript
import { ShareButtons } from "@/components/share-buttons";
```

### 4b. Add component in JSX

After the article `MarkdownRenderer` block and before the closing container `</div>`:

```tsx
{/* Share */}
<div className="mt-10">
  <ShareButtons
    url={`/predictions/${article.slug}`}
    title={article.seoTitle ?? article.title}
  />
</div>
```

---

## Task 5 — Final TypeScript check and git commit

```bash
npx tsc --noEmit
# Expected: no errors
```

Manual verification checklist:

- [ ] Visit `/teams/[any-slug]` in the browser — share buttons appear at the bottom
- [ ] Visit `/matches/[any-slug]` — share buttons appear
- [ ] Visit `/predictions/[any-slug]` — share buttons appear
- [ ] Click "Sao chép link" — button shows "Đã sao chép!" for ~2s then resets
- [ ] On a mobile browser, click "Facebook" — Web Share sheet appears (iOS/Android)
- [ ] On desktop, click "Facebook" — `facebook.com/sharer` popup opens
- [ ] Click "Zalo" — `zalo.me/share` popup opens

If all checks pass:

```bash
git add \
  src/components/share-buttons.tsx \
  src/app/teams/\[slug\]/page.tsx \
  src/app/matches/\[slug\]/page.tsx \
  src/app/predictions/\[slug\]/page.tsx

git commit -m "feat: add Facebook and Zalo share buttons

- ShareButtons client component using Web Share API with FB/Zalo fallbacks
- Copy-to-clipboard with 2s confirmation feedback
- Integrated on team, match, and prediction detail pages
- No SDK dependency — pure URL-based sharing"
```

---

## Notes

- The Zalo SVG `<text>` element renders a "Z" lettermark. For production, replace this with an official Zalo SVG icon from your assets if available.
- `NEXT_PUBLIC_BASE_URL` must be set in both `.env.local` (development) and Vercel project environment variables. The component strips trailing slashes to avoid double-slash URLs.
- `navigator.share` is only available in secure contexts (HTTPS or localhost). The fallback to `window.open` handles all other cases automatically.
- Share counts are intentionally not tracked, avoiding any backend work or third-party analytics SDK.
