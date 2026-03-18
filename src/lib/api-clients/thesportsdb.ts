import type {
  FootballApiClient,
  UnifiedCompetition,
  UnifiedTeam,
  UnifiedMatch,
  UnifiedPlayer,
} from "./types";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";

function getApiKey(): string {
  return process.env.THESPORTSDB_API_KEY || "3"; // "3" is the free tier key
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}/${getApiKey()}${endpoint}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TheSportsDB ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// TheSportsDB uses string IDs internally; we convert to numbers
// World Cup league ID in TheSportsDB = 4429

interface TsdbTeam {
  idTeam: string;
  strTeam: string;
  strTeamShort: string | null;
  strTeamBadge: string | null;
  strCountry: string | null;
  intFormedYear: string | null;
  strStadium: string | null;
  strManager: string | null;
}

interface TsdbPlayer {
  idPlayer: string;
  strPlayer: string;
  strPosition: string | null;
  dateBorn: string | null;
  strNationality: string | null;
  strNumber: string | null;
}

interface TsdbEvent {
  idEvent: string;
  idLeague: string;
  idHomeTeam: string;
  idAwayTeam: string;
  strStatus: string | null;
  intRound: string | null;
  dateEvent: string;
  strTime: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
}

interface TsdbLeague {
  idLeague: string;
  strLeague: string;
  strLeagueAlternate: string | null;
  strSport: string;
  strBadge: string | null;
  strCountry: string | null;
}

export const theSportsDbClient: FootballApiClient = {
  name: "TheSportsDB",

  async getCompetition(id: number): Promise<UnifiedCompetition> {
    const data = await fetchApi<{ leagues: TsdbLeague[] }>(
      `/lookupleague.php?id=${id}`
    );
    const league = data.leagues?.[0];
    if (!league) throw new Error(`Competition ${id} not found on TheSportsDB`);

    return {
      externalId: parseInt(league.idLeague),
      name: league.strLeague,
      code: league.strLeagueAlternate,
      type: league.strSport === "Soccer" ? "CUP" : null,
      emblem: league.strBadge,
      area: league.strCountry,
      season: null,
      startDate: null,
      endDate: null,
    };
  },

  async getTeams(competitionId: number): Promise<UnifiedTeam[]> {
    const data = await fetchApi<{ teams: TsdbTeam[] | null }>(
      `/lookup_all_teams.php?id=${competitionId}`
    );
    return (data.teams || []).map((t) => ({
      externalId: parseInt(t.idTeam),
      name: t.strTeam,
      shortName: t.strTeamShort,
      tla: t.strTeamShort?.slice(0, 3)?.toUpperCase() ?? null,
      crest: t.strTeamBadge,
      area: t.strCountry,
      founded: t.intFormedYear ? parseInt(t.intFormedYear) : null,
      venue: t.strStadium,
      coach: t.strManager,
    }));
  },

  async getMatches(competitionId: number): Promise<UnifiedMatch[]> {
    // TheSportsDB free tier: past events
    const data = await fetchApi<{ events: TsdbEvent[] | null }>(
      `/eventsseason.php?id=${competitionId}&s=2026`
    );
    return (data.events || []).map((e) => ({
      externalId: parseInt(e.idEvent),
      competitionExternalId: parseInt(e.idLeague),
      homeTeamExternalId: parseInt(e.idHomeTeam),
      awayTeamExternalId: parseInt(e.idAwayTeam),
      status: e.strStatus || "SCHEDULED",
      matchday: e.intRound ? parseInt(e.intRound) : null,
      stage: null,
      group: null,
      utcDate: `${e.dateEvent}T${e.strTime || "00:00:00"}Z`,
      homeScore: e.intHomeScore ? parseInt(e.intHomeScore) : null,
      awayScore: e.intAwayScore ? parseInt(e.intAwayScore) : null,
      winner:
        e.intHomeScore && e.intAwayScore
          ? parseInt(e.intHomeScore) > parseInt(e.intAwayScore)
            ? "HOME_TEAM"
            : parseInt(e.intHomeScore) < parseInt(e.intAwayScore)
              ? "AWAY_TEAM"
              : "DRAW"
          : null,
    }));
  },

  async getTeamPlayers(teamId: number): Promise<UnifiedPlayer[]> {
    const data = await fetchApi<{ player: TsdbPlayer[] | null }>(
      `/lookup_all_players.php?id=${teamId}`
    );
    return (data.player || []).map((p) => ({
      externalId: parseInt(p.idPlayer),
      name: p.strPlayer,
      position: p.strPosition,
      dateOfBirth: p.dateBorn,
      nationality: p.strNationality,
      shirtNumber: p.strNumber ? parseInt(p.strNumber) : null,
    }));
  },
};
