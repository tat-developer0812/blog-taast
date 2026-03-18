import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://wc2026.vn";
  const now = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/teams`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/matches`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/predictions`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/world-cup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  try {
    // Run all 3 DB queries concurrently
    const [teams, matches, predictions] = await Promise.all([
      prisma.team.findMany({
        select: { slug: true, updatedAt: true },
      }),
      prisma.match.findMany({
        select: { slug: true, updatedAt: true },
      }),
      prisma.article.findMany({
        where: { type: "prediction", status: "published" },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    // Team pages
    const teamPages: MetadataRoute.Sitemap = teams.map((team) => ({
      url: `${baseUrl}/teams/${team.slug}`,
      lastModified: team.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    // Match pages
    const matchPages: MetadataRoute.Sitemap = matches.map((match) => ({
      url: `${baseUrl}/matches/${match.slug}`,
      lastModified: match.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    // Prediction article pages
    const predictionPages: MetadataRoute.Sitemap = predictions.map((a) => ({
      url: `${baseUrl}/predictions/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...teamPages, ...matchPages, ...predictionPages];
  } catch (error) {
    console.error("sitemap: failed to fetch dynamic pages from DB, returning static pages only", error);
    return staticPages;
  }
}
