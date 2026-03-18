# Phase 5: SEO Optimization - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Make every page fully optimized for search engines — auto-generated sitemap, robots.txt, JSON-LD structured data, Open Graph tags, and canonical URLs — to maximize organic traffic from Vietnamese football fans.

**Architecture:** Next.js App Router metadata API for per-page meta tags and OG. Dynamic `sitemap.xml` route that queries the database for all published slugs. JSON-LD injected as `<script>` in page components for Article, SportsEvent, and BreadcrumbList schema types. Static `robots.txt` via Next.js metadata file convention.

**Tech Stack:** Next.js 14 metadata API, schema.org JSON-LD (no external library), Next.js `sitemap.ts` / `robots.ts` file conventions.

---

### Task 1: robots.txt

**Files:**

- Create: `src/app/robots.ts`

**Step 1: Create robots.ts**

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://wc2026.vn";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/robots.ts
git commit -m "feat(seo): add robots.txt with sitemap reference"
```

---

### Task 2: Dynamic sitemap.xml

**Files:**

- Create: `src/app/sitemap.ts`

**Step 1: Create sitemap.ts**

```ts
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://wc2026.vn";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/teams`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/matches`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/predictions`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/world-cup`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];

  // Team pages
  const teams = await prisma.team.findMany({
    select: { slug: true, updatedAt: true },
  });
  const teamPages: MetadataRoute.Sitemap = teams.map((team) => ({
    url: `${baseUrl}/teams/${team.slug}`,
    lastModified: team.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Match pages
  const matches = await prisma.match.findMany({
    select: { slug: true, updatedAt: true },
  });
  const matchPages: MetadataRoute.Sitemap = matches.map((match) => ({
    url: `${baseUrl}/matches/${match.slug}`,
    lastModified: match.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Prediction article pages
  const predictions = await prisma.article.findMany({
    where: { type: "prediction", status: "published" },
    select: { slug: true, updatedAt: true },
  });
  const predictionPages: MetadataRoute.Sitemap = predictions.map((a) => ({
    url: `${baseUrl}/predictions/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...teamPages, ...matchPages, ...predictionPages];
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): add dynamic sitemap.xml from database"
```

---

### Task 3: Add NEXT_PUBLIC_BASE_URL to environment

**Files:**

- Modify: `.env` — add `NEXT_PUBLIC_BASE_URL`

**Step 1: Append to .env**

Add this line to `.env`:

```
# Public base URL for sitemap and canonical links
NEXT_PUBLIC_BASE_URL="https://wc2026.vn"
```

**Step 2: Commit**

```bash
git add .env
git commit -m "chore: add NEXT_PUBLIC_BASE_URL env variable"
```

> Note: The actual domain should be updated before production deploy.

---

### Task 4: JSON-LD structured data helper

**Files:**

- Create: `src/lib/seo/json-ld.ts`

**Step 1: Create the JSON-LD builder**

```ts
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://wc2026.vn";

export function articleJsonLd(article: {
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  type: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt || "",
    url: `${BASE_URL}/blog/${article.slug}`,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    publisher: {
      "@type": "Organization",
      name: "WC2026",
      url: BASE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/${article.slug}`,
    },
  };
}

export function sportsEventJsonLd(match: {
  homeTeam: string;
  awayTeam: string;
  utcDate: Date;
  slug: string;
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}) {
  const event: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.homeTeam} vs ${match.awayTeam}`,
    startDate: match.utcDate.toISOString(),
    url: `${BASE_URL}/matches/${match.slug}`,
    homeTeam: { "@type": "SportsTeam", name: match.homeTeam },
    awayTeam: { "@type": "SportsTeam", name: match.awayTeam },
    sport: "Football",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  };

  if (match.venue) {
    event.location = { "@type": "Place", name: match.venue };
  }

  if (match.status === "FINISHED" && match.homeScore !== null) {
    event.eventStatus = "https://schema.org/EventScheduled";
  }

  return event;
}

export function breadcrumbJsonLd(
  items: { name: string; href: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${BASE_URL}${item.href}`,
    })),
  };
}

export function teamJsonLd(team: {
  name: string;
  slug: string;
  area: string | null;
  coach: string | null;
  founded: number | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: team.name,
    url: `${BASE_URL}/teams/${team.slug}`,
    sport: "Football",
    location: team.area ? { "@type": "Place", name: team.area } : undefined,
    coach: team.coach
      ? { "@type": "Person", name: team.coach }
      : undefined,
    foundingDate: team.founded ? String(team.founded) : undefined,
  };
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/seo/json-ld.ts
git commit -m "feat(seo): add JSON-LD structured data builders"
```

---

### Task 5: JsonLd component

**Files:**

- Create: `src/components/json-ld.tsx`

**Step 1: Create the component**

```tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/components/json-ld.tsx
git commit -m "feat(seo): add JsonLd script injection component"
```

---

### Task 6: Inject JSON-LD into team detail page

**Files:**

- Modify: `src/app/teams/[slug]/page.tsx`

**Step 1: Add imports at top of file**

```ts
import { teamJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { JsonLd } from "@/components/json-ld";
```

**Step 2: Add JSON-LD inside the `TeamPage` component return, right after the opening `<div>`**

Insert immediately after `<div className="mx-auto max-w-4xl px-4 py-8">`:

```tsx
<JsonLd data={teamJsonLd(team)} />
<JsonLd
  data={breadcrumbJsonLd([
    { name: "Trang chủ", href: "/" },
    { name: "Đội tuyển", href: "/teams" },
    { name: team.name, href: `/teams/${team.slug}` },
  ])}
/>
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/teams/[slug]/page.tsx
git commit -m "feat(seo): add JSON-LD structured data to team pages"
```

---

### Task 7: Inject JSON-LD into match detail page

**Files:**

- Modify: `src/app/matches/[slug]/page.tsx`

**Step 1: Add imports at top of file**

```ts
import { sportsEventJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { JsonLd } from "@/components/json-ld";
```

**Step 2: Add JSON-LD inside the `MatchDetailPage` component return, right after the opening `<div>`**

Insert immediately after `<div className="mx-auto max-w-4xl px-4 py-8">`:

```tsx
<JsonLd
  data={sportsEventJsonLd({
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    utcDate: match.utcDate,
    slug: match.slug,
    venue: match.homeTeam.venue,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
  })}
/>
<JsonLd
  data={breadcrumbJsonLd([
    { name: "Trang chủ", href: "/" },
    { name: "Lịch thi đấu", href: "/matches" },
    { name: `${match.homeTeam.name} vs ${match.awayTeam.name}`, href: `/matches/${match.slug}` },
  ])}
/>
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/matches/[slug]/page.tsx
git commit -m "feat(seo): add SportsEvent JSON-LD to match pages"
```

---

### Task 8: Inject JSON-LD into prediction detail page

**Files:**

- Modify: `src/app/predictions/[slug]/page.tsx`

**Step 1: Add imports at top of file**

```ts
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { JsonLd } from "@/components/json-ld";
```

**Step 2: Add JSON-LD inside the `PredictionPage` component return, right after the opening `<div>`**

Insert immediately after `<div className="mx-auto max-w-4xl px-4 py-8">`:

```tsx
<JsonLd data={articleJsonLd(article)} />
<JsonLd
  data={breadcrumbJsonLd([
    { name: "Trang chủ", href: "/" },
    { name: "Dự đoán", href: "/predictions" },
    {
      name: article.match
        ? `${article.match.homeTeam.name} vs ${article.match.awayTeam.name}`
        : article.title,
      href: `/predictions/${article.slug}`,
    },
  ])}
/>
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/predictions/[slug]/page.tsx
git commit -m "feat(seo): add Article JSON-LD to prediction pages"
```

---

### Task 9: Open Graph & canonical metadata in layout

**Files:**

- Modify: `src/app/layout.tsx`

**Step 1: Extend the existing `metadata` object**

Replace the current `metadata` export with:

```ts
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://wc2026.vn";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "World Cup 2026 - Tin tức, Dự đoán & Phân tích bóng đá",
    template: "%s | World Cup 2026",
  },
  description:
    "Cập nhật tin tức World Cup 2026, dự đoán kết quả, phân tích đội tuyển và lịch sử đối đầu. Trang tin bóng đá hàng đầu cho người hâm mộ Việt Nam.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "WC2026 - World Cup 2026",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: baseUrl,
  },
};
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(seo): add Open Graph, Twitter card, and canonical URL metadata"
```

---

### Task 10: Per-page Open Graph metadata for team pages

**Files:**

- Modify: `src/app/teams/[slug]/page.tsx`

**Step 1: Update the `generateMetadata` function**

Replace the current `generateMetadata` function with:

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = await prisma.team.findUnique({ where: { slug: params.slug } });
  if (!team) return { title: "Đội tuyển" };

  const article = await prisma.article.findFirst({
    where: { type: "team_history", teamId: team.id },
  });

  const title = article?.seoTitle || `${team.name} - World Cup 2026`;
  const description =
    article?.seoDescription ||
    `Thông tin đội tuyển ${team.name} tại World Cup 2026`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: team.crest ? [{ url: team.crest, alt: team.name }] : [],
    },
    alternates: {
      canonical: `/teams/${team.slug}`,
    },
  };
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/teams/[slug]/page.tsx
git commit -m "feat(seo): add Open Graph and canonical to team detail pages"
```

---

### Task 11: Per-page Open Graph metadata for match pages

**Files:**

- Modify: `src/app/matches/[slug]/page.tsx`

**Step 1: Update the `generateMetadata` function**

Replace the current `generateMetadata` function with:

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const match = await prisma.match.findUnique({
    where: { slug: params.slug },
    include: { homeTeam: true, awayTeam: true },
  });

  if (!match) return { title: "Trận đấu" };

  const article = await prisma.article.findFirst({
    where: { type: "match_preview", matchId: match.id },
  });

  const title =
    article?.seoTitle ||
    `${match.homeTeam.name} vs ${match.awayTeam.name} - World Cup 2026`;
  const description =
    article?.seoDescription ||
    `Nhận định trận đấu ${match.homeTeam.name} vs ${match.awayTeam.name} tại World Cup 2026`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    alternates: {
      canonical: `/matches/${match.slug}`,
    },
  };
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/matches/[slug]/page.tsx
git commit -m "feat(seo): add Open Graph and canonical to match detail pages"
```

---

### Task 12: Per-page Open Graph metadata for prediction pages

**Files:**

- Modify: `src/app/predictions/[slug]/page.tsx`

**Step 1: Update the `generateMetadata` function**

Replace the current `generateMetadata` function with:

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
  });

  if (!article) return { title: "Dự đoán" };

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt || "";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    alternates: {
      canonical: `/predictions/${article.slug}`,
    },
  };
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/predictions/[slug]/page.tsx
git commit -m "feat(seo): add Open Graph and canonical to prediction pages"
```

---

### Task 13: Final verification

**Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Dev server smoke test**

Run: `npm run dev` (then stop after confirming it starts)
Expected: `Ready in Xms`

**Step 3: Final commit (if any unstaged changes)**

```bash
git add -A
git commit -m "feat(seo): phase 5 complete — sitemap, robots, JSON-LD, Open Graph, canonical"
```
