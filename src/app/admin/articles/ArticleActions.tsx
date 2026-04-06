"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  id: number;
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
