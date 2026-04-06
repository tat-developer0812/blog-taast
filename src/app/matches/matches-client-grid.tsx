"use client";

import { useLiveScores } from "@/hooks/useLiveScores";
import { MatchCard } from "@/components/match-card";

interface StaticMatch {
  id: number;
  slug: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: { name: string; tla: string | null };
  awayTeam: { name: string; tla: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  utcDate: string; // serialized from Date in server component
  stage: string | null;
  group: string | null;
}

interface Props {
  grouped: Record<string, StaticMatch[]>;
  orderedStages: string[];
  stageLabelMap: Record<string, string>;
}

export function MatchesClientGrid({ grouped, orderedStages, stageLabelMap }: Props) {
  const liveMatches = useLiveScores();
  const liveById = new Map(liveMatches.map((m) => [m.id, m]));

  return (
    <>
      {orderedStages.map((stage) => (
        <section key={stage} className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">
            {stageLabelMap[stage] || stage}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[stage].map((match) => {
              const live = liveById.get(match.id);
              return (
                <MatchCard
                  key={match.id}
                  slug={match.slug}
                  homeTeam={match.homeTeam.name}
                  awayTeam={match.awayTeam.name}
                  homeTla={match.homeTeam.tla}
                  awayTla={match.awayTeam.tla}
                  homeScore={match.homeScore}
                  awayScore={match.awayScore}
                  status={match.status}
                  utcDate={new Date(match.utcDate)}
                  stage={match.stage}
                  group={match.group}
                  isLive={!!live}
                  liveHomeScore={live?.homeScore}
                  liveAwayScore={live?.awayScore}
                  liveStatus={live?.status}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
