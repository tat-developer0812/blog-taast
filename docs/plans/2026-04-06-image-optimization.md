# Image Optimization Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Optimize all team crest and article images for performance using Next.js built-in image optimization, replacing raw `<img>` tags with standardized components that provide blur placeholders, proper sizing, lazy loading, and graceful fallbacks.

**Architecture:** All remote image domains are already whitelisted in `next.config.mjs` (`remotePatterns` for crests.football-data.org, www.thesportsdb.com, upload.wikimedia.org), so no additional config is needed. Two shared components — `TeamCrest` and `ArticleImage` — encapsulate all `next/image` usage and are consumed by every page and card component. No Sharp processing is required; Next.js handles avif/webp conversion at runtime.

**Tech Stack:** Next.js 14 App Router, TypeScript, `next/image`, TailwindCSS

---

## Task 1 — Create `src/components/team-crest.tsx`

**Create:** `src/components/team-crest.tsx`

A standardized component for rendering team crest images. Shows a football-icon SVG fallback when `src` is null/undefined or fails to load. Uses a hardcoded 1×1 gray base64 PNG as `blurDataURL` so the placeholder shows immediately without a network request.

```tsx
// src/components/team-crest.tsx
"use client";

import Image from "next/image";
import { useState } from "react";

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const SIZES = { sm: 32, md: 48, lg: 64, xl: 96 } as const;

interface TeamCrestProps {
  src: string | null | undefined;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
}

function FallbackIcon({ px, className }: { px: number; className?: string }) {
  return (
    <div
      style={{ width: px, height: px }}
      className={`bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 ${className ?? ""}`}
    >
      <svg
        width={px * 0.6}
        height={px * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="text-gray-400"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path
          d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

export function TeamCrest({
  src,
  alt,
  size = "md",
  className,
  priority = false,
}: TeamCrestProps) {
  const [errored, setErrored] = useState(false);
  const px = SIZES[size];

  if (!src || errored) {
    return <FallbackIcon px={px} className={className} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={px}
      height={px}
      placeholder="blur"
      blurDataURL={BLUR_DATA_URL}
      priority={priority}
      onError={() => setErrored(true)}
      className={`object-contain flex-shrink-0 ${className ?? ""}`}
    />
  );
}
```

---

## Task 2 — Create `src/components/article-image.tsx`

**Create:** `src/components/article-image.tsx`

Responsive featured-image component for articles. Uses `fill` layout inside a positioned container so it adapts to any aspect ratio wrapper. Provides a skeleton shimmer fallback while loading.

```tsx
// src/components/article-image.tsx
"use client";

import Image from "next/image";
import { useState } from "react";

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

interface ArticleImageProps {
  src: string | null | undefined;
  alt: string;
  /** Pass true for the first article on the page to avoid lazy-load delay */
  priority?: boolean;
  className?: string;
}

export function ArticleImage({
  src,
  alt,
  priority = false,
  className,
}: ArticleImageProps) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center ${className ?? ""}`}
        aria-hidden="true"
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="text-gray-300"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
          <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
          <path d="M21 15l-5-5L5 21" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      priority={priority}
      placeholder="blur"
      blurDataURL={BLUR_DATA_URL}
      loading={priority ? undefined : "lazy"}
      onError={() => setErrored(true)}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
```

> **Note:** The parent element must have `position: relative` and a defined height (e.g., `relative h-48`) for the `fill` layout to work correctly.

---

## Task 3 — Update `src/components/match-card.tsx`

**Modify:** `src/components/match-card.tsx`

Replace any raw `<img>` tags used for team crests with the new `<TeamCrest>` component.

```tsx
// Before (example — adjust to actual file content)
<img src={match.homeTeam.crest} alt={match.homeTeam.name} className="w-8 h-8" />
<img src={match.awayTeam.crest} alt={match.awayTeam.name} className="w-8 h-8" />

// After
import { TeamCrest } from "@/components/team-crest";

<TeamCrest src={match.homeTeam.crest} alt={match.homeTeam.name} size="sm" />
<TeamCrest src={match.awayTeam.crest} alt={match.awayTeam.name} size="sm" />
```

Remove the old `<img>` imports/usages and add the `TeamCrest` import at the top of the file.

---

## Task 4 — Update `src/components/article-card.tsx`

**Modify:** `src/components/article-card.tsx`

Replace raw `<img>` for featured image with `<ArticleImage>`. Ensure the image container has `relative` positioning and a fixed height class so `fill` layout renders correctly.

```tsx
// Before (example)
<img src={article.coverImage} alt={article.title} className="w-full h-48 object-cover" />

// After
import { ArticleImage } from "@/components/article-image";

<div className="relative h-48 w-full overflow-hidden rounded-t-lg">
  <ArticleImage src={article.coverImage} alt={article.title} />
</div>
```

---

## Task 5 — Update `src/app/teams/[slug]/page.tsx`

**Modify:** `src/app/teams/[slug]/page.tsx`

Replace the team crest `<img>` with `<TeamCrest size="xl" priority>`. The `priority` prop tells Next.js to preload this image since it is above the fold on the team detail page.

```tsx
// Before
<img src={team.crest} alt={team.name} className="w-24 h-24 object-contain" />

// After
import { TeamCrest } from "@/components/team-crest";

<TeamCrest src={team.crest} alt={team.name} size="xl" priority />
```

---

## Task 6 — Update `src/app/teams/page.tsx`

**Modify:** `src/app/teams/page.tsx`

Replace crest `<img>` tags in the team listing grid with `<TeamCrest size="md">`. Only the first team gets `priority`; the rest use the default lazy behavior.

```tsx
// Before
<img src={team.crest} alt={team.name} className="w-12 h-12 object-contain" />

// After
import { TeamCrest } from "@/components/team-crest";

// Inside map — set priority only on index 0
<TeamCrest
  src={team.crest}
  alt={team.name}
  size="md"
  priority={index === 0}
/>
```

---

## Task 7 — Update `src/app/matches/[slug]/page.tsx`

**Modify:** `src/app/matches/[slug]/page.tsx`

Replace both home and away team crest `<img>` tags. Both are above the fold so both get `priority`.

```tsx
// Before
<img src={match.homeTeam.crest} alt={match.homeTeam.name} className="w-16 h-16" />
<img src={match.awayTeam.crest} alt={match.awayTeam.name} className="w-16 h-16" />

// After
import { TeamCrest } from "@/components/team-crest";

<TeamCrest src={match.homeTeam.crest} alt={match.homeTeam.name} size="lg" priority />
<TeamCrest src={match.awayTeam.crest} alt={match.awayTeam.name} size="lg" priority />
```

---

## Task 8 — TypeScript Check + Commit

**CLI commands:**

```bash
# Type-check the entire project
npx tsc --noEmit

# Expected output: (no errors)

# Stage and commit
git add src/components/team-crest.tsx \
        src/components/article-image.tsx \
        src/components/match-card.tsx \
        src/components/article-card.tsx \
        src/app/teams/page.tsx \
        src/app/teams/[slug]/page.tsx \
        src/app/matches/[slug]/page.tsx

git commit -m "feat: image optimization pipeline with TeamCrest and ArticleImage components

- Add TeamCrest component with blur placeholder, onError fallback SVG, and size variants (sm/md/lg/xl)
- Add ArticleImage component with fill layout, responsive sizes prop, and skeleton fallback
- Replace all raw <img> tags with Next.js Image-backed components across match-card, article-card, teams page, team detail page, and match detail page
- Set priority prop on above-the-fold images to enable LCP preloading"
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` exits with code 0
- [ ] No raw `<img>` tags remain in `src/components/` or `src/app/` (check with `grep -r '<img' src/`)
- [ ] Team detail page shows blur placeholder before crest loads (test on throttled connection in DevTools)
- [ ] Team listing page shows fallback SVG for teams with null crest
- [ ] Article cards show skeleton fallback when `coverImage` is null
- [ ] Lighthouse Performance score improves (run before/after in Chrome DevTools)
- [ ] No `<Image>` missing `width`/`height` TypeScript errors
