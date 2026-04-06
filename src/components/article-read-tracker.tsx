"use client";

import { useEffect, useRef } from "react";
import { usePlausible } from "@/hooks/usePlausible";

interface Props {
  slug: string;
}

export function ArticleReadTracker({ slug }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const { trackEvent } = usePlausible();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          trackEvent("Article Read", { slug });
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [slug, trackEvent]);

  return <div ref={sentinelRef} aria-hidden="true" />;
}
