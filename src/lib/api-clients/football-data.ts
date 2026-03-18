import type {
  FootballApiClient,
  UnifiedCompetition,
  UnifiedTeam,
  UnifiedMatch,
  UnifiedPlayer,
} from "./types";
import { cached } from "@/lib/cache";

const BASE_URL = "https://api.football-data.org/v4";

async function fetchApi<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY is not set");

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "X-Auth-Token": apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`football-data.org ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// football-data.org response types (partial)
interface FdCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
  area: { name: string };
  currentSeason?: {
    startDate: string;
    endDate: string;
  };
}

interface FdTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  area: { name: string };
  founded: number;
  venue: string;
  coach?: { name: string };
}

interface FdPlayer {
  id: number;
  name: string;
  position: string;
  dateOfBirth: string;
  nationality: string;
  shirtNumber: number | null;
}

interface FdMatch {
  id: number;
  competition: { id: number };
  homeTeam: { id: number };
  awayTeam: { id: number };
  status: string;
  matchday: number;
  stage: string;
  group: string | null;
  utcDate: string;
  score: {
    fullTime: { home: number | null; away: number | null };
    winner: string | null;
  };
}

export const footballDataClient: FootballApiClient = {
  name: "football-data.org",

  async getCompetition(id: number): Promise<UnifiedCompetition> {
    return cached(`fd:competition:${id}`, 3600_000, async () => {
      const data = await fetchApi<FdCompetition>(`/competitions/${id}`);
      return {
        externalId: data.id,
        name: data.name,
        code: data.code,
        type: data.type,
        emblem: data.emblem,
        area: data.area?.name ?? null,
        season: data.currentSeason?.startDate?.slice(0, 4) ?? null,
        startDate: data.currentSeason?.startDate ?? null,
        endDate: data.currentSeason?.endDate ?? null,
      };
    });
  },

  async getTeams(competitionId: number): Promise<UnifiedTeam[]> {
    return cached(`fd:teams:${competitionId}`, 1800_000, async () => {
      const data = await fetchApi<{ teams: FdTeam[] }>(
        `/competitions/${competitionId}/teams`
      );
      return data.teams.map((t) => ({
        externalId: t.id,
        name: t.name,
        shortName: t.shortName,
        tla: t.tla,
        crest: t.crest,
        area: t.area?.name ?? null,
        founded: t.founded,
        venue: t.venue,
        coach: t.coach?.name ?? null,
      }));
    });
  },

  async getMatches(competitionId: number): Promise<UnifiedMatch[]> {
    return cached(`fd:matches:${competitionId}`, 300_000, async () => {
      const data = await fetchApi<{ matches: FdMatch[] }>(
        `/competitions/${competitionId}/matches`
      );
      return data.matches.map((m) => ({
        externalId: m.id,
        competitionExternalId: m.competition.id,
        homeTeamExternalId: m.homeTeam.id,
        awayTeamExternalId: m.awayTeam.id,
        status: m.status,
        matchday: m.matchday,
        stage: m.stage,
        group: m.group,
        utcDate: m.utcDate,
        homeScore: m.score?.fullTime?.home ?? null,
        awayScore: m.score?.fullTime?.away ?? null,
        winner: m.score?.winner ?? null,
      }));
    });
  },

  async getTeamPlayers(teamId: number): Promise<UnifiedPlayer[]> {
    return cached(`fd:players:${teamId}`, 1800_000, async () => {
      const data = await fetchApi<{ squad: FdPlayer[] }>(`/teams/${teamId}`);
      return (data.squad || []).map((p) => ({
        externalId: p.id,
        name: p.name,
        position: p.position,
        dateOfBirth: p.dateOfBirth,
        nationality: p.nationality,
        shirtNumber: p.shirtNumber,
      }));
    });
  },
};
