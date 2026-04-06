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
                <td className="px-4 py-3 font-medium text-white max-w-xs truncate">{article.title}</td>
                <td className="px-4 py-3 text-gray-400">{article.type}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    article.status === "published" ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"
                  }`}>
                    {article.status === "published" ? "Đã xuất bản" : "Nháp"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(article.createdAt).toLocaleDateString("vi-VN")}
                </td>
                <td className="px-4 py-3">
                  <ArticleActions id={article.id} status={article.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {articles.length === 0 && (
          <p className="text-center text-gray-500 py-12">Chưa có bài viết nào.</p>
        )}
      </div>
    </div>
  );
}
