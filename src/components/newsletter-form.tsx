"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "success" | "error";

interface NewsletterFormProps {
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
