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
    event.eventStatus = "https://schema.org/EventPast";
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
  const result: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: team.name,
    url: `${BASE_URL}/teams/${team.slug}`,
    sport: "Football",
  };
  if (team.area) result.location = { "@type": "Place", name: team.area };
  if (team.coach) result.coach = { "@type": "Person", name: team.coach };
  if (team.founded) result.foundingDate = String(team.founded);
  return result;
}
