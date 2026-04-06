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
      const res = await fetch(endpoint);
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
      aria-label={`${labelMap[status]}: ${label}`}
      className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${colorMap[status]}`}
    >
      {labelMap[status]}
    </button>
  );
}
