export type ArticleType =
  | "match_preview"
  | "prediction"
  | "team_history"
  | "h2h"
  | "world_cup_history"
  | "tournament_analysis";

export interface GeneratedArticle {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  type: ArticleType;
  seoTitle: string;
  seoDescription: string;
  teamId?: number;
  matchId?: number;
}

export interface MatchData {
  id: number;
  slug: string;
  status: string;
  matchday: number | null;
  stage: string | null;
  group: string | null;
  utcDate: Date;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  homeTeam: TeamData;
  awayTeam: TeamData;
  competition: { name: string };
}

export interface TeamData {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  slug: string;
  crest: string | null;
  area: string | null;
  founded: number | null;
  venue: string | null;
  coach: string | null;
  players?: PlayerData[];
}

export interface PlayerData {
  name: string;
  position: string | null;
  nationality: string | null;
  shirtNumber: number | null;
}

export interface H2HData {
  team1: TeamData;
  team2: TeamData;
  totalMatches: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  team1Goals: number;
  team2Goals: number;
  recentMatches: MatchData[];
}
