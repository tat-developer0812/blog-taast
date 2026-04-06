# Analytics Integration (Plausible) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Plausible Analytics for privacy-friendly, GDPR-compliant pageview and custom event tracking — no cookies, no consent banner required.

**Architecture:** Plausible's script is loaded via `next/script` with `strategy="afterInteractive"` in the root layout. Custom events (article reads, searches, shares) are fired through a typed `usePlausible` hook that wraps `window.plausible()` and degrades gracefully to a no-op when the env var is absent or in development. A `Window` interface augmentation in `src/types/plausible.d.ts` provides full TypeScript safety without an external type package.

**Tech Stack:** Next.js 14 App Router, TypeScript, TailwindCSS, Plausible Analytics (plausible.io or self-hosted)

---

## Task 1 — Add `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` to `.env`

**Modify:** `.env`

```
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=wc2026.vn
```

Replace `wc2026.vn` with the domain registered on plausible.io (or your self-hosted instance domain). When this value is empty or absent, the `<Analytics />` component renders nothing and `trackEvent` becomes a no-op — safe for local development with no dummy traffic sent to Plausible.

---

## Task 2 — Create `src/types/plausible.d.ts`

**Create:** `src/types/plausible.d.ts`

```ts
interface Window {
  plausible?: (
    event: string,
    options?: { props?: Record<string, string | number | boolean> }
  ) => void;
}
```

This declaration augments the global `Window` interface so TypeScript resolves `window.plausible` without requiring a third-party `@types` package. No import needed — it is picked up automatically as an ambient declaration.

---

## Task 3 — Create `src/hooks/usePlausible.ts`

**Create:** `src/hooks/usePlausible.ts`

```ts
"use client";

import { useCallback } from "react";

export function usePlausible() {
  const trackEvent = useCallback(
    (
      event: string,
      props?: Record<string, string | number | boolean>
    ): void => {
      if (
        typeof window !== "undefined" &&
        typeof window.plausible === "function"
      ) {
        window.plausible(event, { props });
      }
    },
    []
  );

  return { trackEvent };
}
```

The `useCallback` with an empty dependency array ensures the returned function reference is stable across renders, preventing unnecessary re-renders in components that receive `trackEvent` as a prop.

---

## Task 4 — Create `src/components/analytics.tsx`

**Create:** `src/components/analytics.tsx`

```tsx
import Script from "next/script";

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export function Analytics() {
  if (!PLAUSIBLE_DOMAIN) return null;

  return (
    <Script
      defer
      data-domain={PLAUSIBLE_DOMAIN}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
```

Using `strategy="afterInteractive"` ensures the script loads after Next.js hydration is complete, avoiding any interference with LCP or TTI metrics. If using a self-hosted Plausible instance, replace the `src` value with your instance URL, e.g., `https://plausible.example.com/js/script.js`.

---

## Task 5 — Add `<Analytics />` to root layout

**Modify:** `src/app/layout.tsx`

Import and place `<Analytics />` inside `<body>` (before the closing tag):

```tsx
import { Analytics } from "@/components/analytics";

// Inside the returned JSX:
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

> If the root layout already exists, add only the import and the `<Analytics />` element — do not replace the entire file.

---

## Task 6 — Update `src/components/share-buttons.tsx`

**Modify:** `src/components/share-buttons.tsx`

Add the `usePlausible` hook and call `trackEvent` on each button's `onClick`. The `method` prop value must match one of the literal strings below exactly (Plausible filters by prop value in its dashboard).

```tsx
"use client";

import { usePlausible } from "@/hooks/usePlausible";

// Inside the component:
export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const { trackEvent } = usePlausible();

  function handleShare(method: "facebook" | "zalo" | "copy") {
    trackEvent("Share", { method });
    // existing share logic below
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={() => {
          handleShare("facebook");
          window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
            "_blank",
            "noopener"
          );
        }}
        className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition"
      >
        Facebook
      </button>

      <button
        onClick={() => {
          handleShare("zalo");
          window.open(
            `https://zalo.me/share/url?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
            "_blank",
            "noopener"
          );
        }}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition"
      >
        Zalo
      </button>

      <button
        onClick={async () => {
          handleShare("copy");
          await navigator.clipboard.writeText(url);
        }}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
      >
        Sao chép link
      </button>
    </div>
  );
}
```

> If `src/components/share-buttons.tsx` does not yet exist, create it with the full component above. If it exists, integrate only the `usePlausible` import and the `handleShare` calls into the existing button handlers.

---

## Task 7 — Update `src/app/search/page.tsx` to track search events

**Modify:** `src/app/search/page.tsx`

The search page must be a Client Component (or have a child Client Component) to call `trackEvent`. Add the following pattern:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePlausible } from "@/hooks/usePlausible";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const { trackEvent } = usePlausible();

  useEffect(() => {
    if (q.trim()) {
      trackEvent("Search", { query: q.trim() });
    }
  }, [q, trackEvent]);

  // ... rest of search UI
}
```

The `useEffect` fires whenever the `q` query parameter changes, which matches every new search without double-firing on re-renders.

> If the search page is currently a Server Component, convert it to a Client Component as shown above, or extract the tracking into a small `<SearchTracker q={q} />` Client Component nested inside a Server Component parent.

---

## Task 8 — Create `src/components/article-read-tracker.tsx`

**Create:** `src/components/article-read-tracker.tsx`

```tsx
"use client";

import { useEffect, useRef } from "react";
import { usePlausible } from "@/hooks/usePlausible";

interface Props {
  slug: string;
}

export function ArticleReadTracker({ slug }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const { trackEvent } = usePlausible();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          trackEvent("Article Read", { slug });
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [slug, trackEvent]);

  // Sentinel div placed at ~80% through the article body by the parent
  return <div ref={sentinelRef} aria-hidden="true" />;
}
```

The `firedRef` guard ensures the event fires at most once per page load, even if the user scrolls back up through the sentinel. The `observer.disconnect()` call after firing prevents further callback invocations.

---

## Task 9 — Add `<ArticleReadTracker>` to detail pages

**Modify:** Each of the following pages (or their shared layout if one exists):

- `src/app/articles/[slug]/page.tsx`
- `src/app/matches/[id]/page.tsx`
- `src/app/predictions/[id]/page.tsx` (if it exists)

**Pattern to apply in each file:**

```tsx
import { ArticleReadTracker } from "@/components/article-read-tracker";

// Inside the returned JSX, place the tracker at ~80% through the content:
export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug); // existing fetch logic

  return (
    <article>
      {/* ... article header ... */}

      <div className="prose prose-invert max-w-none">
        {/* article body content */}
      </div>

      {/* Sentinel at ~80% — tracker fires when user scrolls here */}
      <ArticleReadTracker slug={params.slug} />

      {/* ... comments, related articles, etc. ... */}
    </article>
  );
}
```

For match pages, pass the match ID as the slug: `<ArticleReadTracker slug={`match-${params.id}`} />`.

> Server Components can import and render Client Components — no conversion needed for the page itself.

---

## Task 10 — TypeScript check and commit

**CLI command:**

```bash
npx tsc --noEmit
```

**Expected output:** No errors. Common issues to watch for:
- `window.plausible` not recognized — ensure `src/types/plausible.d.ts` is included in `tsconfig.json`'s `include` array (or that it covers `src/**/*`).
- `useSearchParams` must be inside a `Suspense` boundary in Next.js 14 — wrap the search page component if the build warns about this.

**If `tsconfig.json` does not already cover `src/types`:**

```bash
# Check tsconfig include paths
cat tsconfig.json
```

Add `"src/types"` to the `include` array if missing:

```json
{
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "src/types/**/*.d.ts"]
}
```

**Git commit:**

```bash
git add \
  src/types/plausible.d.ts \
  src/hooks/usePlausible.ts \
  src/components/analytics.tsx \
  src/components/article-read-tracker.tsx \
  src/components/share-buttons.tsx \
  src/app/layout.tsx \
  src/app/search/page.tsx \
  src/app/articles/[slug]/page.tsx \
  src/app/matches/[id]/page.tsx

git commit -m "feat: add Plausible analytics with custom event tracking"
```

---

## Notes

- **Self-hosted Plausible:** Change the `src` in `<Analytics />` from `https://plausible.io/js/script.js` to your own instance URL. The `data-domain` value stays the same.
- **Outbound link tracking:** To also track outbound clicks automatically, switch the script to `script.outbound-links.js` on plausible.io.
- **Goal setup:** In the Plausible dashboard under **Goals**, register custom events: `Share`, `Search`, and `Article Read` — otherwise they will not appear in the UI even though they are being sent.
- **Development:** Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=` (empty) locally. The `<Analytics />` component returns `null` and `trackEvent` is a no-op, so no test events pollute your production stats.
- **Privacy:** Plausible does not use cookies and does not collect personal data — no cookie consent banner is legally required under GDPR or Vietnam's PDPD for this integration alone.
