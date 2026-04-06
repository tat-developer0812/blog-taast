# Admin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Build a password-protected admin panel at `/admin` for managing articles, triggering manual data syncs, and viewing SyncLog history — with no user accounts, using a single shared password via env var.

**Architecture:** Session auth is handled via a signed JWT stored in an `httpOnly` cookie, signed with `ADMIN_SECRET` using `jose` (HS256). A Next.js middleware guards all `/admin/*` routes, redirecting to `/admin/login` when no valid session cookie is present. All admin pages are Server Components that query Prisma directly, while mutations go through lightweight API routes.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 7.5, `jose`, TailwindCSS, Vercel

---

## Task 1 — Add `ADMIN_SECRET` to `.env`

**Modify:** `.env`

Add the following line (generate a strong random string for production):

```
ADMIN_SECRET=replace-with-a-strong-random-secret-min-32-chars
```

Expected: env var is readable at runtime via `process.env.ADMIN_SECRET`.

---

## Task 2 — Install `jose`

**CLI command:**

```bash
npm install jose
```

**Expected output:**

```
added 1 package, and audited N packages in Xs
```

`jose` provides `SignJWT` and `jwtVerify` with native Web Crypto — no Node.js crypto polyfills needed in Edge middleware.

---

## Task 3 — Create `src/lib/admin-auth.ts`

**Create:** `src/lib/admin-auth.ts`

```ts
import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

export async function createSession(secret: string): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(encoder.encode(secret));
}

export async function verifySession(
  token: string,
  secret: string
): Promise<boolean> {
  try {
    await jwtVerify(token, encoder.encode(secret));
    return true;
  } catch {
    return false;
  }
}
```

---

## Task 4 — Update `src/middleware.ts`

**Modify:** `src/middleware.ts`

Extend the existing middleware to protect `/admin/:path*`. If the request path matches `/admin` (except `/admin/login`), read the `admin_session` cookie and call `verifySession`. Redirect to `/admin/login` on failure.

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/admin-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin routes except the login page itself
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get("admin_session")?.value;
    const secret = process.env.ADMIN_SECRET ?? "";

    const valid = token ? await verifySession(token, secret) : false;

    if (!valid) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Add admin routes; preserve any existing matchers below
    "/admin/:path*",
  ],
};
```

> If the project already has a `src/middleware.ts`, merge the admin block into it and extend the `matcher` array rather than replacing the file.

---

## Task 5 — Create `POST /api/admin/login/route.ts`

**Create:** `src/app/api/admin/login/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const secret = process.env.ADMIN_SECRET ?? "";

  if (!secret || password !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await createSession(secret);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return response;
}
```

---

## Task 6 — Create `GET /api/admin/logout/route.ts`

**Create:** `src/app/api/admin/logout/route.ts`

```ts
import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect(
    new URL("/admin/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
  );
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return response;
}
```

---

## Task 7 — Create `src/app/admin/login/page.tsx`

**Create:** `src/app/admin/login/page.tsx`

```tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setError("Sai mật khẩu. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Admin Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm text-gray-400 mb-1"
            >
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition disabled:opacity-50"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </main>
  );
}
```

---

## Task 8 — Create `src/app/admin/layout.tsx`

**Create:** `src/app/admin/layout.tsx`

```tsx
import Link from "next/link";
import { ReactNode } from "react";

const navLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/articles", label: "Bài viết" },
  { href: "/admin/sync", label: "Sync Logs" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-gray-900 flex flex-col py-6 px-4">
        <div className="text-lg font-bold text-white mb-8 px-2">
          ⚽ WC2026 Admin
        </div>

        <nav className="flex-1 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition text-sm"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <a
          href="/api/admin/logout"
          className="block px-3 py-2 rounded-lg text-red-400 hover:bg-gray-800 transition text-sm mt-4"
        >
          Đăng xuất
        </a>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
```

---

## Task 9 — Create `src/app/admin/page.tsx`

**Create:** `src/app/admin/page.tsx`

```tsx
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const [totalArticles, publishedArticles, lastSync] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: "published" } }),
    prisma.syncLog.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const draftArticles = totalArticles - publishedArticles;

  const cards = [
    {
      label: "Tổng bài viết",
      value: totalArticles,
      href: "/admin/articles",
      color: "bg-blue-600",
    },
    {
      label: "Đã xuất bản",
      value: publishedArticles,
      href: "/admin/articles",
      color: "bg-green-600",
    },
    {
      label: "Bản nháp",
      value: draftArticles,
      href: "/admin/articles",
      color: "bg-yellow-600",
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`${card.color} rounded-2xl p-6 flex flex-col gap-2 hover:opacity-90 transition`}
          >
            <span className="text-sm text-white/80">{card.label}</span>
            <span className="text-4xl font-bold text-white">{card.value}</span>
          </Link>
        ))}
      </div>

      <div className="bg-gray-900 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-3">Sync gần nhất</h2>
        {lastSync ? (
          <div className="text-sm text-gray-400 space-y-1">
            <p>
              <span className="text-gray-200 font-medium">Loại:</span>{" "}
              {lastSync.type}
            </p>
            <p>
              <span className="text-gray-200 font-medium">Trạng thái:</span>{" "}
              <span
                className={
                  lastSync.status === "success"
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {lastSync.status}
              </span>
            </p>
            <p>
              <span className="text-gray-200 font-medium">Thời gian:</span>{" "}
              {new Date(lastSync.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Chưa có sync nào.</p>
        )}
        <Link
          href="/admin/sync"
          className="inline-block mt-4 text-blue-400 hover:underline text-sm"
        >
          Xem tất cả sync logs →
        </Link>
      </div>
    </div>
  );
}
```

---

## Task 10 — Create `src/app/admin/articles/page.tsx`

**Create:** `src/app/admin/articles/page.tsx`

```tsx
import { prisma } from "@/lib/db";
import ArticleActions from "./ArticleActions";

export default async function AdminArticlesPage() {
  const articles = await prisma.article.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      type: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Bài viết</h1>

      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">Tiêu đề</th>
              <th className="text-left px-4 py-3">Loại</th>
              <th className="text-left px-4 py-3">Trạng thái</th>
              <th className="text-left px-4 py-3">Ngày tạo</th>
              <th className="text-left px-4 py-3">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {articles.map((article) => (
              <tr key={article.id} className="hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium text-white max-w-xs truncate">
                  {article.title}
                </td>
                <td className="px-4 py-3 text-gray-400">{article.type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      article.status === "published"
                        ? "bg-green-900 text-green-300"
                        : "bg-yellow-900 text-yellow-300"
                    }`}
                  >
                    {article.status === "published" ? "Đã xuất bản" : "Nháp"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(article.createdAt).toLocaleDateString("vi-VN")}
                </td>
                <td className="px-4 py-3">
                  <ArticleActions
                    id={article.id}
                    status={article.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {articles.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            Chưa có bài viết nào.
          </p>
        )}
      </div>
    </div>
  );
}
```

**Create:** `src/app/admin/articles/ArticleActions.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  id: string;
  status: string;
}

export default function ArticleActions({ id, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleStatus() {
    setLoading(true);
    await fetch(`/api/admin/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: status === "published" ? "draft" : "published",
      }),
    });
    router.refresh();
    setLoading(false);
  }

  async function deleteArticle() {
    if (!confirm("Xoá bài viết này?")) return;
    setLoading(true);
    await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={toggleStatus}
        disabled={loading}
        className={`px-3 py-1 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
          status === "published"
            ? "bg-yellow-700 hover:bg-yellow-600 text-white"
            : "bg-green-700 hover:bg-green-600 text-white"
        }`}
      >
        {status === "published" ? "Ẩn" : "Xuất bản"}
      </button>
      <button
        onClick={deleteArticle}
        disabled={loading}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-red-800 hover:bg-red-700 text-white transition disabled:opacity-50"
      >
        Xoá
      </button>
    </div>
  );
}
```

---

## Task 11 — Create `PATCH /api/admin/articles/[id]/route.ts`

**Create:** `src/app/api/admin/articles/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { status } = await request.json();

  if (!["draft", "published"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const article = await prisma.article.update({
    where: { id: params.id },
    data: {
      status,
      publishedAt: status === "published" ? new Date() : null,
    },
  });

  return NextResponse.json(article);
}
```

---

## Task 12 — Create `DELETE /api/admin/articles/[id]/route.ts`

**Modify:** `src/app/api/admin/articles/[id]/route.ts` (add `DELETE` export to the same file created in Task 11)

```ts
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.article.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
```

---

## Task 13 — Create `src/app/admin/sync/page.tsx`

**Create:** `src/app/admin/sync/page.tsx`

```tsx
import { prisma } from "@/lib/db";
import SyncTrigger from "./SyncTrigger";

const SYNC_TYPES = [
  { type: "matches", label: "Sync Trận đấu", endpoint: "/api/cron/sync-matches" },
  { type: "standings", label: "Sync Bảng xếp hạng", endpoint: "/api/cron/sync-standings" },
  { type: "articles", label: "Tạo bài viết tự động", endpoint: "/api/cron/generate-articles" },
];

export default async function AdminSyncPage() {
  // Get last SyncLog per type
  const logs = await Promise.all(
    SYNC_TYPES.map(({ type }) =>
      prisma.syncLog.findFirst({
        where: { type },
        orderBy: { createdAt: "desc" },
      })
    )
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Sync & Cron Jobs</h1>

      <div className="space-y-4">
        {SYNC_TYPES.map(({ type, label, endpoint }, i) => {
          const log = logs[i];
          return (
            <div key={type} className="bg-gray-900 rounded-2xl p-6 flex items-center justify-between gap-6">
              <div className="flex-1">
                <p className="font-semibold text-white">{label}</p>
                {log ? (
                  <p className="text-xs text-gray-400 mt-1">
                    Lần cuối:{" "}
                    {new Date(log.createdAt).toLocaleString("vi-VN")} —{" "}
                    <span
                      className={
                        log.status === "success"
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {log.status}
                    </span>
                    {log.duration ? ` (${log.duration}ms)` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Chưa chạy lần nào.</p>
                )}
              </div>
              <SyncTrigger endpoint={endpoint} label={label} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Create:** `src/app/admin/sync/SyncTrigger.tsx`

```tsx
"use client";

import { useState } from "react";

interface Props {
  endpoint: string;
  label: string;
}

export default function SyncTrigger({ endpoint, label }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function trigger() {
    setStatus("loading");
    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ""}`,
        },
      });
      setStatus(res.ok ? "ok" : "error");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 3000);
  }

  const colorMap = {
    idle: "bg-blue-700 hover:bg-blue-600",
    loading: "bg-gray-600",
    ok: "bg-green-700",
    error: "bg-red-700",
  };

  const labelMap = {
    idle: "Chạy ngay",
    loading: "Đang chạy...",
    ok: "Thành công!",
    error: "Lỗi",
  };

  return (
    <button
      onClick={trigger}
      disabled={status === "loading"}
      className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${colorMap[status]}`}
    >
      {labelMap[status]}
    </button>
  );
}
```

---

## Task 14 — TypeScript check and commit

**CLI command:**

```bash
npx tsc --noEmit
```

**Expected output:** No errors. Fix any type mismatches before committing.

**Git commit:**

```bash
git add \
  src/lib/admin-auth.ts \
  src/middleware.ts \
  src/app/api/admin/login/route.ts \
  src/app/api/admin/logout/route.ts \
  src/app/api/admin/articles/[id]/route.ts \
  src/app/admin/login/page.tsx \
  src/app/admin/layout.tsx \
  src/app/admin/page.tsx \
  src/app/admin/articles/page.tsx \
  src/app/admin/articles/ArticleActions.tsx \
  src/app/admin/sync/page.tsx \
  src/app/admin/sync/SyncTrigger.tsx

git commit -m "feat: add password-protected admin dashboard with session auth"
```

---

## Notes

- `ADMIN_SECRET` must be at least 32 characters for adequate HMAC-HS256 security.
- The `SyncTrigger` component calls cron endpoints directly from the browser. If those endpoints require `CRON_SECRET` via `Authorization` header, consider proxying the call through a server-side admin API route instead of exposing `NEXT_PUBLIC_CRON_SECRET`.
- All `/admin/*` routes are excluded from public SEO (add `robots.txt` rule or `noindex` meta in `AdminLayout` if needed).
- Cookie `secure` flag is set only in production to allow local HTTP development.
