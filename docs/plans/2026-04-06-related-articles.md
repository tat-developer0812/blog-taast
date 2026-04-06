# Related Articles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Show 3 dynamically relevant articles at the bottom of each team, match, and prediction detail page, falling back to most-recent published articles when there are not enough context-matched results.

**Architecture:** A single server-side query function `getRelatedArticles` in `src/lib/content/related.ts` queries the `articles` table using Prisma `OR` conditions on `teamId`, `matchId`, and `type`, then an async server component `RelatedArticles` calls that function and renders a three-column `ArticleCard` grid. The component is dropped into the three existing detail pages with no changes to routing or ISR config.

**Tech Stack:** Next.js 14 App Router (server components, ISR), TypeScript, Prisma 7.5, PostgreSQL (Supabase), TailwindCSS

---

## Context

- Prisma singleton exported as `prisma` from `src/lib/db.ts` — **not** `db`
- `ArticleCard` in `src/components/article-card.tsx` expects props: `title`, `excerpt`, `slug`, `type`, `publishedAt`
- Detail pages all use `import { prisma } from "@/lib/db"`
- `src/lib/content/` directory already exists (contains `generator.ts`, `seo.ts`, `types.ts`)

---

## Tasks

### Task 1 — Create `src/lib/content/related.ts`

**Create file:** `src/lib/content/related.ts`

```ts
import { prisma } from "@/lib/db";
import type { Article } from "@prisma/client";

export async function getRelatedArticles(
  currentId: number,
  opts: {
    teamId?: number | null;
    matchId?: number | null;
    type?: string;
    limit?: number;
  }
): Promise<Article[]> {
  const { teamId, matchId, type, limit = 3 } = opts;

  // Build OR clauses — only include non-empty conditions
  const orClauses: object[] = [];
  if (teamId) orClauses.push({ teamId });
  if (matchId) orClauses.push({ matchId });
  if (type) orClauses.push({ type });

  // If no context is available, return most-recent published articles
  if (orClauses.length === 0) {
    return prisma.article.findMany({
      where: { id: { not: currentId }, status: "published" },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
  }

  const results = await prisma.article.findMany({
    where: {
      id: { not: currentId },
      status: "published",
      OR: orClauses,
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  // Fallback: top up with most-recent articles if fewer than `limit` matched
  if (results.length < limit) {
    const existingIds = results.map((a) => a.id);
    existingIds.push(currentId);

    const extras = await prisma.article.findMany({
      where: {
        id: { notIn: existingIds },
        status: "published",
      },
      orderBy: { publishedAt: "desc" },
      take: limit - results.length,
    });

    return [...results, ...extras];
  }

  return results;
}
```

**Verify TypeScript compiles:**

```bash
npx tsc --noEmit
# Expected: no errors
```

---

### Task 2 — Create `src/components/related-articles.tsx`

**Create file:** `src/components/related-articles.tsx`

```tsx
import { getRelatedArticles } from "@/lib/content/related";
import { ArticleCard } from "@/components/article-card";

interface RelatedArticlesProps {
  currentId: number;
  teamId?: number | null;
  matchId?: number | null;
  type?: string;
}

export async function RelatedArticles({
  currentId,
  teamId,
  matchId,
  type,
}: RelatedArticlesProps) {
  const articles = await getRelatedArticles(currentId, {
    teamId,
    matchId,
    type,
    limit: 3,
  });

  if (articles.length === 0) return null;

  return (
    <section className="mt-12 border-t border-[var(--border)] pt-10">
      <h2 className="mb-6 text-2xl font-bold">Bài viết liên quan</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            title={article.title}
            excerpt={article.excerpt}
            slug={article.slug}
            type={article.type}
            publishedAt={article.publishedAt}
          />
        ))}
      </div>
    </section>
  );
}
```

---

### Task 3 — Inject `<RelatedArticles>` into `src/app/teams/[slug]/page.tsx`

**Modify file:** `src/app/teams/[slug]/page.tsx`

**Step 3a — Add import** at the top alongside the other component imports:

```ts
import { RelatedArticles } from "@/components/related-articles";
```

**Step 3b — Replace** the existing static "Bài viết liên quan" section (the `<section>` containing the two plain `<Link>` buttons for `/predictions` and `/teams`):

```tsx
      {/* Related articles */}
      <RelatedArticles
        currentId={article?.id ?? 0}
        teamId={team.id}
        type="team_history"
      />
```

> Note: `article?.id ?? 0` is safe — `getRelatedArticles` excludes `id: 0` which never exists in the DB, so no real article is incorrectly excluded when no team article exists yet.

---

### Task 4 — Inject `<RelatedArticles>` into `src/app/matches/[slug]/page.tsx`

**Modify file:** `src/app/matches/[slug]/page.tsx`

**Step 4a — Add import:**

```ts
import { RelatedArticles } from "@/components/related-articles";
```

**Step 4b — Append** inside the return's outermost `<div>`, after the article content block (after the closing `{article ? ... : ...}` expression):

```tsx
      <RelatedArticles
        currentId={article?.id ?? 0}
        matchId={match.id}
        teamId={match.homeTeamId}
        type="match_preview"
      />
```

The full end of the return JSX will look like:

```tsx
      {/* Article content */}
      {article ? (
        <MarkdownRenderer content={article.content} />
      ) : (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="text-[var(--muted)]">
            Bài nhận định cho trận đấu này sẽ sớm được cập nhật.
          </p>
        </div>
      )}

      <RelatedArticles
        currentId={article?.id ?? 0}
        matchId={match.id}
        teamId={match.homeTeamId}
        type="match_preview"
      />
    </div>
  );
```

> `match.homeTeamId` is available via the `prisma.match.findUnique` call that already `include`s `homeTeam`. The raw FK field is directly on the `match` object.

---

### Task 5 — Inject `<RelatedArticles>` into `src/app/predictions/[slug]/page.tsx`

**Modify file:** `src/app/predictions/[slug]/page.tsx`

**Step 5a — Add import:**

```ts
import { RelatedArticles } from "@/components/related-articles";
```

**Step 5b — Append** after the published-date `<p>` block (end of the return div):

```tsx
      <RelatedArticles
        currentId={article.id}
        matchId={article.matchId}
        teamId={article.match?.homeTeam?.id ?? null}
        type="prediction"
      />
```

The full end of the return JSX will look like:

```tsx
      <MarkdownRenderer content={article.content} />

      {article.publishedAt && (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Cập nhật:{" "}
          {new Intl.DateTimeFormat("vi-VN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(article.publishedAt)}
        </p>
      )}

      <RelatedArticles
        currentId={article.id}
        matchId={article.matchId}
        teamId={article.match?.homeTeam?.id ?? null}
        type="prediction"
      />
    </div>
  );
```

> `article.match` already includes `homeTeam` and `awayTeam` via the existing `include` in `prisma.article.findUnique`.

---

### Task 6 — Final TypeScript check

```bash
npx tsc --noEmit
# Expected: exit 0, no errors
```

If errors appear, resolve them before committing.

---

### Task 7 — Git commit

```bash
git add src/lib/content/related.ts \
        src/components/related-articles.tsx \
        src/app/teams/\[slug\]/page.tsx \
        src/app/matches/\[slug\]/page.tsx \
        src/app/predictions/\[slug\]/page.tsx

git commit -m "feat: add related articles section to team, match, and prediction pages"
# Expected: commit hash printed, no hook failures
```

---

## Summary of file changes

| File | Action |
|------|--------|
| `src/lib/content/related.ts` | Create — Prisma query with OR + fallback |
| `src/components/related-articles.tsx` | Create — async server component |
| `src/app/teams/[slug]/page.tsx` | Modify — replace static links section with `<RelatedArticles>` |
| `src/app/matches/[slug]/page.tsx` | Modify — append `<RelatedArticles>` after article content |
| `src/app/predictions/[slug]/page.tsx` | Modify — append `<RelatedArticles>` after published date |

No schema changes, no migrations, no new dependencies.
