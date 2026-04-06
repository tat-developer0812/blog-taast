# Error Monitoring (Sentry) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Sentry into the Next.js 14 App Router project to capture and report unhandled exceptions, React component errors, and slow page performance in production.

**Architecture:** The official `@sentry/nextjs` SDK wraps the Next.js build via `withSentryConfig()` and provides three runtime-specific init files (client, server, edge) that are loaded by Next.js's `instrumentation.ts` hook. An `ErrorBoundary` React class component wraps the root `<main>` to catch rendering errors and display a Vietnamese fallback UI; a `global-error.tsx` page catches errors in React Server Components. Sentry is entirely disabled in development (guarded by `NODE_ENV` and presence of `SENTRY_DSN`) so local dev is never noisy.

**Tech Stack:** `@sentry/nextjs`, Next.js 14 App Router, TypeScript, TailwindCSS, Vercel

---

## Task 1 — Install `@sentry/nextjs`

**CLI command:**

```bash
npm install @sentry/nextjs
```

**Expected output:**

```
added N packages, and audited N packages in Xs
found 0 vulnerabilities
```

> Do **not** run `npx @sentry/wizard` — it overwrites `next.config.mjs` and adds boilerplate we do not want. Configure everything manually per the tasks below.

---

## Task 2 — Add Environment Variables

**Modify:** `.env` (and `.env.example` if it exists)

Add the following variables. The `NEXT_PUBLIC_` prefix makes the DSN available to client-side bundles. `SENTRY_ORG` and `SENTRY_PROJECT` are used by the Sentry webpack plugin at build time to upload source maps.

```env
# Sentry — error monitoring
SENTRY_DSN=https://YOUR_KEY@oXXXXXX.ingest.sentry.io/XXXXXXX
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_KEY@oXXXXXX.ingest.sentry.io/XXXXXXX
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=your-sentry-project-slug
```

**Vercel:** Add all four variables in the Vercel dashboard under **Settings → Environment Variables** for the Production environment.

> `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` should be identical values — the DSN from your Sentry project's **Settings → Client Keys**.

---

## Task 3 — Create `sentry.client.config.ts`

**Create:** `sentry.client.config.ts` (project root, alongside `next.config.mjs`)

Handles browser-side error and performance monitoring. Session replay is disabled (`sampleRate: 0`) to avoid recording user sessions without explicit consent — enable only after adding a consent banner.

```ts
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only run in production; no-op in local dev
  enabled: process.env.NODE_ENV === "production",

  // Capture 10 % of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Session replay disabled — enable after adding cookie consent
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Strip personal data from breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "console") return null;
    return breadcrumb;
  },
});
```

---

## Task 4 — Create `sentry.server.config.ts`

**Create:** `sentry.server.config.ts` (project root)

Handles Node.js server-side errors from API routes, Server Actions, cron jobs, and server components.

```ts
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  // 10 % of server transactions for performance tracing
  tracesSampleRate: 0.1,

  // Attach the user's IP and request URL to events for debugging
  // (ensure this complies with your privacy policy)
  sendDefaultPii: false,
});
```

---

## Task 5 — Create `sentry.edge.config.ts`

**Create:** `sentry.edge.config.ts` (project root)

Minimal config for the Vercel Edge Runtime (middleware, edge API routes). The Edge Runtime is a constrained environment — keep this config small.

```ts
// sentry.edge.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
});
```

---

## Task 6 — Create `instrumentation.ts`

**Create:** `instrumentation.ts` (project root — Next.js picks this up automatically when `experimental.instrumentationHook` is enabled, or in Next.js 14.1+ it is stable)

This file is the official Next.js hook for running code once at server startup. It loads the correct Sentry config based on the current runtime.

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
```

> **Note:** If the project root is `src/`, place this file at `src/instrumentation.ts` instead and adjust import paths accordingly.

---

## Task 7 — Update `next.config.mjs`

**Modify:** `next.config.mjs`

Wrap the existing config with `withSentryConfig()`. The Sentry webpack plugin uploads source maps to Sentry at build time and then strips them from the Vercel deployment so stack traces in Sentry are readable but source maps are not publicly accessible.

```mjs
// next.config.mjs
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // --- your existing config below, unchanged ---
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "crests.football-data.org" },
      { protocol: "https", hostname: "www.thesportsdb.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
  // Keep instrumentation hook enabled (required for Next.js < 14.1)
  experimental: {
    instrumentationHook: true,
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project slugs (read from env at build time)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Silent during local builds to avoid noisy output
  silent: !process.env.CI,

  // Upload source maps and hide them from the public bundle
  hideSourceMaps: true,

  // Tree-shake Sentry logger statements from production bundle
  disableLogger: true,

  // Automatically annotate React components with their display name
  // (improves readability of component stack traces in Sentry)
  reactComponentAnnotation: {
    enabled: true,
  },
});
```

> **Important:** If `next.config.mjs` already has an `experimental` block, merge `instrumentationHook: true` into it rather than replacing the whole block.

---

## Task 8 — Create `src/components/error-boundary.tsx`

**Create:** `src/components/error-boundary.tsx`

React class component (required for `componentDidCatch`). Captures the error to Sentry and renders a Vietnamese-language fallback UI. Accepts an optional `fallback` prop for custom per-section fallbacks.

```tsx
// src/components/error-boundary.tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Custom fallback UI. Defaults to the Vietnamese error card below. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, eventId: null };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const eventId = Sentry.captureException(error);
    this.setState({ eventId });
  }

  private handleReset = () => {
    this.setState({ hasError: false, eventId: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
          <div className="text-4xl mb-4" aria-hidden="true">
            ⚠️
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Đã xảy ra lỗi
          </h2>
          <p className="text-gray-500 text-sm mb-6 max-w-sm">
            Trang này gặp sự cố không mong muốn. Vui lòng thử tải lại.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm font-medium text-green-700 border border-green-600 rounded-md hover:bg-green-50 transition-colors"
            >
              Thử lại
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            >
              Tải lại trang
            </button>
          </div>
          {this.state.eventId && (
            <p className="mt-4 text-xs text-gray-400">
              Mã lỗi: {this.state.eventId}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## Task 9 — Wrap `<main>` in `src/app/layout.tsx`

**Modify:** `src/app/layout.tsx`

Import `ErrorBoundary` and wrap the `<main>` (or the children slot) so any rendering error in a page is caught without crashing the entire shell (header/footer remain visible).

```tsx
// src/app/layout.tsx
import { ErrorBoundary } from "@/components/error-boundary";

// Inside the returned JSX — wrap only the content area, not the whole <html>:
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Header />
        <main>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        <Footer />
      </body>
    </html>
  );
}
```

> Adjust to match the actual structure in the file — the key change is adding `<ErrorBoundary>` around `{children}` inside `<main>`.

---

## Task 10 — Create `src/app/global-error.tsx`

**Create:** `src/app/global-error.tsx`

Next.js 14 requires this file to handle errors thrown by the root layout itself or React Server Components that escape the `ErrorBoundary`. It replaces the entire page, so it must include `<html>` and `<body>`.

```tsx
// src/app/global-error.tsx
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
          <div className="text-5xl mb-6" aria-hidden="true">
            🚨
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Lỗi nghiêm trọng
          </h1>
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
```

---

## Task 11 — TypeScript Check + Commit

**CLI commands:**

```bash
# Type-check the full project
npx tsc --noEmit

# Expected output: (no errors)

# Verify Sentry config files exist
ls sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts instrumentation.ts

# Stage all new and modified files
git add sentry.client.config.ts \
        sentry.server.config.ts \
        sentry.edge.config.ts \
        instrumentation.ts \
        next.config.mjs \
        src/components/error-boundary.tsx \
        src/app/layout.tsx \
        src/app/global-error.tsx

git commit -m "feat: integrate Sentry error monitoring for production

- Install @sentry/nextjs and configure client, server, and edge runtime init files
- Register Sentry via Next.js instrumentation hook (runs once at server startup)
- Wrap next.config.mjs with withSentryConfig (source maps uploaded, hidden from public bundle)
- Add ErrorBoundary React class component with Vietnamese fallback UI and Sentry capture
- Wrap root layout <main> with ErrorBoundary to prevent full-page crashes
- Add global-error.tsx for RSC-level error capture (required by Next.js 14)
- Sentry is no-op in development; only active when SENTRY_DSN is set in production"
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` exits with code 0
- [ ] `npm run build` completes without errors (Sentry plugin logs source map upload if `SENTRY_DSN` is set)
- [ ] In Vercel dashboard: all four env vars (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`) are set for Production
- [ ] Trigger a test error in development by temporarily throwing inside a Server Component — confirm Sentry is **not** called (no-op in dev)
- [ ] Deploy to Vercel Preview, trigger a test error, confirm the event appears in the Sentry dashboard within ~30 seconds
- [ ] `ErrorBoundary` renders the Vietnamese fallback UI when a child component throws
- [ ] `global-error.tsx` page renders correctly (simulate by throwing in `layout.tsx` temporarily)
- [ ] Source maps are **not** publicly accessible (verify `/_next/static/chunks/*.js.map` returns 404 in production)
