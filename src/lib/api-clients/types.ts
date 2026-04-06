// Unified schema that all API adapters must conform to

export interface UnifiedTeam {
  externalId: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
  area: string | null;
  founded: number | null;
  venue: string | null;
  coach: string | null;
}

export interface UnifiedPlayer {
  externalId: number;
  name: string;
  position: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  shirtNumber: number | null;
}

export interface UnifiedMatch {
  externalId: number;
  competitionExternalId: number;
  homeTeamExternalId: number;
  awayTeamExternalId: number;
  status: string;
  matchday: number | null;
  stage: string | null;
  group: string | null;
  utcDate: string;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
}

export interface UnifiedCompetition {
  externalId: number;
  name: string;
  code: string | null;
  type: string | null;
  emblem: string | null;
  area: string | null;
  season: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface UnifiedStanding {
  groupName: string;
  position: number;
  teamExternalId: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface FootballApiClient {
  name: string;
  getCompetition(id: number): Promise<UnifiedCompetition>;
  getTeams(competitionId: number): Promise<UnifiedTeam[]>;
  getMatches(competitionId: number): Promise<UnifiedMatch[]>;
  getTeamPlayers(teamId: number): Promise<UnifiedPlayer[]>;
  getStandings(competitionId: number): Promise<UnifiedStanding[]>;
}
