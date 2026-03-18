/**
 * Generate a URL-friendly slug from a string.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a match slug: "team1-vs-team2"
 */
export function matchSlug(homeTeam: string, awayTeam: string): string {
  return `${slugify(homeTeam)}-vs-${slugify(awayTeam)}`;
}
