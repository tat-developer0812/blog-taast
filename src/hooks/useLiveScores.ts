"use client";

import { useState, useEffect } from "react";

export interface LiveMatch {
  id: number;
  slug: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: number;
  awayTeamId: number;
  updatedAt: string; // ISO string from JSON parse
}

export function useLiveScores() {
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch("/api/live-scores");
        if (res.ok) {
          const data: LiveMatch[] = await res.json();
          setLiveMatches(data);
        }
      } catch {
        // Silently ignore network errors — stale data stays visible
      }
    };

    const startPolling = () => {
      if (intervalId !== null) return;
      poll();
      intervalId = setInterval(poll, 30_000);
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return liveMatches;
}
