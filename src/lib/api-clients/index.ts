import { footballDataClient } from "./football-data";
import { theSportsDbClient } from "./thesportsdb";
import type { FootballApiClient } from "./types";

export type { FootballApiClient } from "./types";
export type {
  UnifiedTeam,
  UnifiedMatch,
  UnifiedPlayer,
  UnifiedCompetition,
  UnifiedStanding,
} from "./types";

// Registry of all available API clients
const clients: Record<string, FootballApiClient> = {
  "football-data": footballDataClient,
  thesportsdb: theSportsDbClient,
};

/**
 * Get the primary API client (football-data.org).
 * Falls back to TheSportsDB if primary is unavailable.
 */
export function getApiClient(
  name?: string
): FootballApiClient {
  if (name && clients[name]) return clients[name];
  return footballDataClient;
}

export function getAvailableClients(): string[] {
  return Object.keys(clients);
}

/**
 * Register a new API client at runtime.
 * Use this to add new data sources without modifying existing code.
 */
export function registerApiClient(
  name: string,
  client: FootballApiClient
): void {
  clients[name] = client;
}
