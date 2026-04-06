"use client";

import { useCallback } from "react";

export function usePlausible() {
  const trackEvent = useCallback(
    (
      event: string,
      props?: Record<string, string | number | boolean>
    ): void => {
      if (
        typeof window !== "undefined" &&
        typeof window.plausible === "function"
      ) {
        window.plausible(event, { props });
      }
    },
    []
  );

  return { trackEvent };
}
