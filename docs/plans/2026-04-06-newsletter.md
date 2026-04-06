# Newsletter Subscription Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use screenkit:executing-plans to implement this plan task-by-task.

**Goal:** Let visitors subscribe via email, store emails in PostgreSQL, and optionally send a Resend welcome email — the entire Resend integration degrades gracefully to a no-op when `RESEND_API_KEY` is absent.

**Architecture:** A new `Subscriber` Prisma model stores emails with an `unsubscribeToken`. Two API routes handle subscription (`POST /api/subscribe`) and opt-out (`GET /api/unsubscribe`). A client component `NewsletterForm` posts to the subscribe route and displays inline success/error states. The form is embedded in both the footer and the homepage; Resend is imported only when the env var exists, so the app deploys correctly without it.

**Tech Stack:** Next.js 14 App Router (Route Handlers, client component), TypeScript, Prisma 7.5, PostgreSQL (Supabase), TailwindCSS, Resend SDK (optional)

---

## Context

- Prisma singleton: `import { prisma } from "@/lib/db"`
- Footer component: `src/components/footer.tsx` (server component, three-column grid layout)
- Homepage: `src/app/page.tsx` — articles section ends around line 142 before the closing `</div>`
- No existing `Subscriber` model in `prisma/schema.prisma`
- `.env` is gitignored; `RESEND_API_KEY` is optional

---

## Tasks

### Task 1 — Add `Subscriber` model to Prisma schema

**Modify file:** `prisma/schema.prisma`

Append the following model **at the end of the file**, after `SyncLog`:

```prisma
model Subscriber {
  id               Int       @id @default(autoincrement())
  email            String    @unique
  confirmedAt      DateTime?
  unsubscribedAt   DateTime?
  unsubscribeToken String    @unique @default(cuid())
  createdAt        DateTime  @default(now()) @map("created_at")

  @@map("subscribers")
}
```

**Run migration:**

```bash
npx prisma migrate dev --name add_subscriber_model
# Expected output (last lines):
# The following migration(s) have been applied:
#   migrations/YYYYMMDDHHMMSS_add_subscriber_model/migration.sql
# Your database is now in sync with your schema.
```

**Regenerate Prisma client** (migrate dev does this automatically, but confirm):

```bash
npx prisma generate
# Expected: ✔ Generated Prisma Client
```

---

### Task 2 — Add `RESEND_API_KEY` to `.env`

**Modify file:** `.env`

Add the following line (leave value blank if not using Resend yet):

```env
RESEND_API_KEY=
```

> If you have a Resend account, paste the API key here. The app works correctly with an empty or absent value — the email sending step is skipped silently.

---

### Task 3 — Install Resend SDK

```bash
npm install resend
# Expected: added 1 package, updated package-lock.json
```

> The SDK is installed unconditionally; it is only *invoked* when `RESEND_API_KEY` is set. This avoids dynamic `require()` and keeps TypeScript happy.

---

### Task 4 — Create `src/lib/email.ts`

**Create file:** `src/lib/email.ts`

```ts
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = "WC2026 <noreply@wc2026.vn>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wc2026.vn";

export async function sendWelcomeEmail(
  email: string,
  unsubscribeToken: string
): Promise<void> {
  if (!resend) {
    // Resend not configured — skip silently
    return;
  }

  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${unsubscribeToken}`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: "Chào mừng bạn đến với WC2026!",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="color:#1d4ed8;margin-bottom:8px;">World Cup 2026</h1>
        <p style="color:#374151;">
          Cảm ơn bạn đã đăng ký nhận bản tin WC2026!
          Chúng tôi sẽ gửi cho bạn tin tức mới nhất, dự đoán và phân tích
          chuyên sâu về World Cup 2026.
        </p>
        <p style="margin-top:32px;font-size:12px;color:#9ca3af;">
          Nếu bạn không muốn nhận email nữa, hãy
          <a href="${unsubscribeUrl}" style="color:#6b7280;">hủy đăng ký tại đây</a>.
        </p>
      </div>
    `,
  });
}
```

---

### Task 5 — Create `POST /api/subscribe/route.ts`

**Create file:** `src/app/api/subscribe/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof (body as Record<string, unknown>).email === "string"
      ? ((body as Record<string, unknown>).email as string).trim().toLowerCase()
      : "";

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Địa chỉ email không hợp lệ." },
      { status: 422 }
    );
  }

  // Check for existing active subscriber
  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing && existing.unsubscribedAt === null && existing.confirmedAt !== null) {
    return NextResponse.json(
      { error: "Email này đã được đăng ký." },
      { status: 409 }
    );
  }

  // Upsert: re-subscribe if previously unsubscribed, or create new
  const subscriber = await prisma.subscriber.upsert({
    where: { email },
    update: {
      unsubscribedAt: null,
      confirmedAt: new Date(),
    },
    create: {
      email,
      confirmedAt: new Date(),
    },
  });

  // Fire-and-forget welcome email — errors are non-fatal
  sendWelcomeEmail(email, subscriber.unsubscribeToken).catch((err) => {
    console.error("[newsletter] Failed to send welcome email:", err);
  });

  return NextResponse.json(
    { message: "Đăng ký thành công! Cảm ơn bạn." },
    { status: 200 }
  );
}
```

---

### Task 6 — Create `GET /api/unsubscribe/route.ts`

**Create file:** `src/app/api/unsubscribe/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(renderPage("Lỗi", "Thiếu token hủy đăng ký."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { unsubscribeToken: token },
  });

  if (!subscriber) {
    return new NextResponse(
      renderPage("Không tìm thấy", "Token không hợp lệ hoặc đã hết hạn."),
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  if (subscriber.unsubscribedAt !== null) {
    return new NextResponse(
      renderPage("Đã hủy", "Bạn đã hủy đăng ký trước đó rồi."),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  await prisma.subscriber.update({
    where: { unsubscribeToken: token },
    data: { unsubscribedAt: new Date(), confirmedAt: null },
  });

  return new NextResponse(
    renderPage(
      "Hủy đăng ký thành công",
      "Bạn đã hủy đăng ký nhận bản tin WC2026. Hẹn gặp lại!"
    ),
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — WC2026</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0;
           background: #f9fafb; color: #111827; }
    .card { background: #fff; border-radius: 12px; padding: 40px 48px;
            box-shadow: 0 1px 6px rgba(0,0,0,.08); text-align: center;
            max-width: 480px; }
    h1 { color: #1d4ed8; margin-bottom: 12px; }
    a { color: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top:24px"><a href="/">Quay về trang chủ</a></p>
  </div>
</body>
</html>`;
}
```

---

### Task 7 — Create `src/components/newsletter-form.tsx`

**Create file:** `src/components/newsletter-form.tsx`

```tsx
"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "success" | "error";

interface NewsletterFormProps {
  /** Compact mode for footer; full mode for standalone block */
  compact?: boolean;
}

export function NewsletterForm({ compact = false }: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as { message?: string; error?: string };

      if (res.ok) {
        setStatus("success");
        setMessage(data.message ?? "Đăng ký thành công!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Đã có lỗi xảy ra. Vui lòng thử lại.");
      }
    } catch {
      setStatus("error");
      setMessage("Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.");
    }
  }

  if (compact) {
    return (
      <div>
        <h4 className="mb-3 font-semibold">Nhận bản tin</h4>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email của bạn"
            required
            disabled={status === "loading" || status === "success"}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {status === "loading" ? "..." : "Đăng ký"}
          </button>
        </form>
        {message && (
          <p
            className={`mt-2 text-xs ${
              status === "success" ? "text-green-600" : "text-red-500"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    );
  }

  // Full / standalone block
  return (
    <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white sm:p-10">
      <h2 className="mb-2 text-2xl font-bold">Nhận bản tin WC2026</h2>
      <p className="mb-6 text-blue-100">
        Đăng ký để nhận tin tức, dự đoán và phân tích mới nhất về World Cup
        2026 ngay trong hộp thư của bạn.
      </p>

      {status === "success" ? (
        <p className="rounded-xl bg-white/20 px-6 py-4 font-medium">
          {message}
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Nhập địa chỉ email của bạn"
            required
            disabled={status === "loading"}
            className="flex-1 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-blue-700 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {status === "loading" ? "Đang xử lý..." : "Đăng ký miễn phí"}
          </button>
        </form>
      )}

      {status === "error" && (
        <p className="mt-3 text-sm text-red-300">{message}</p>
      )}
    </section>
  );
}
```

---

### Task 8 — Add compact `NewsletterForm` to footer

**Modify file:** `src/components/footer.tsx`

**Step 8a — Add import** at the top:

```ts
import { NewsletterForm } from "@/components/newsletter-form";
```

**Step 8b — Replace** the third column block (currently titled "Thông tin" with the single "Tin tức mới nhất" link) with the newsletter form. The column becomes:

```tsx
          <div>
            <NewsletterForm compact />
          </div>
```

The full updated three-column grid will be:

```tsx
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h3 className="mb-3 text-lg font-bold text-[var(--primary)]">
              WC2026
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Trang tin bóng đá World Cup 2026 hàng đầu cho người hâm mộ Việt
              Nam. Cập nhật tin tức, dự đoán và phân tích chuyên sâu.
            </p>
          </div>

          <div>
            <h4 className="mb-3 font-semibold">Danh mục</h4>
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              <li>
                <Link href="/teams" className="hover:text-[var(--primary)]">
                  Đội tuyển
                </Link>
              </li>
              <li>
                <Link href="/matches" className="hover:text-[var(--primary)]">
                  Lịch thi đấu
                </Link>
              </li>
              <li>
                <Link
                  href="/predictions"
                  className="hover:text-[var(--primary)]"
                >
                  Dự đoán
                </Link>
              </li>
              <li>
                <Link
                  href="/world-cup"
                  className="hover:text-[var(--primary)]"
                >
                  World Cup
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <NewsletterForm compact />
          </div>
        </div>
```

> The footer is a server component but `NewsletterForm` is a client component — this is valid in Next.js 14; client components can be imported and rendered inside server components.

---

### Task 9 — Add standalone `NewsletterForm` to homepage

**Modify file:** `src/app/page.tsx`

**Step 9a — Add import** at the top alongside other component imports:

```ts
import { NewsletterForm } from "@/components/newsletter-form";
```

**Step 9b — Append** a newsletter section after the "Bài viết mới nhất" section (before the closing `</div>` of the page wrapper). Insert between the closing `)}` of the articles section and the final `</div>`:

```tsx
      {/* Newsletter */}
      <section className="mb-12">
        <NewsletterForm />
      </section>
```

The end of the return JSX becomes:

```tsx
      {/* Latest Articles */}
      {articles.length > 0 && (
        <section className="mb-12">
          {/* ... existing articles grid ... */}
        </section>
      )}

      {/* Newsletter */}
      <section className="mb-12">
        <NewsletterForm />
      </section>
    </div>
  );
```

---

### Task 10 — Final TypeScript check

```bash
npx tsc --noEmit
# Expected: exit 0, no errors
```

Common issues to watch for:
- `Subscriber` not recognized → run `npx prisma generate` again
- `resend` types missing → confirm `npm install resend` completed

---

### Task 11 — Git commit

```bash
git add prisma/schema.prisma \
        prisma/migrations/ \
        src/lib/email.ts \
        src/components/newsletter-form.tsx \
        src/app/api/subscribe/route.ts \
        src/app/api/unsubscribe/route.ts \
        src/components/footer.tsx \
        src/app/page.tsx \
        package.json \
        package-lock.json

git commit -m "feat: add newsletter subscription with Resend welcome email and unsubscribe flow"
# Expected: commit hash printed, no hook failures
```

---

## Summary of file changes

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — add `Subscriber` model |
| `prisma/migrations/…_add_subscriber_model/` | Auto-created by `prisma migrate dev` |
| `.env` | Modify — add `RESEND_API_KEY=` placeholder |
| `src/lib/email.ts` | Create — `sendWelcomeEmail` with Resend, no-op when key absent |
| `src/app/api/subscribe/route.ts` | Create — POST handler: validate, upsert, send welcome email |
| `src/app/api/unsubscribe/route.ts` | Create — GET handler: token lookup, mark unsubscribed, HTML response |
| `src/components/newsletter-form.tsx` | Create — client component, compact + full modes |
| `src/components/footer.tsx` | Modify — replace "Thông tin" column with `<NewsletterForm compact />` |
| `src/app/page.tsx` | Modify — append `<NewsletterForm />` section after articles |
| `package.json` / `package-lock.json` | Modified by `npm install resend` |

## Environment variables required

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (already set) | Supabase PostgreSQL connection string |
| `RESEND_API_KEY` | No | Resend API key; omit or leave blank to skip email sending |
| `NEXT_PUBLIC_SITE_URL` | No (defaults to `https://wc2026.vn`) | Used to build the unsubscribe link in the welcome email |

## Resend free-tier limits

Resend free tier allows 100 emails/day and 3,000/month. For a World Cup blog this is sufficient for welcome emails. Match-day digest emails (future feature) would require a scheduled task (e.g., Vercel Cron) and a separate send loop — not in scope here.
