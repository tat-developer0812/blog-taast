"use client";

import Image from "next/image";
import { useState } from "react";

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

interface ArticleImageProps {
  src: string | null | undefined;
  alt: string;
  priority?: boolean;
  className?: string;
}

export function ArticleImage({
  src,
  alt,
  priority = false,
  className,
}: ArticleImageProps) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center ${className ?? ""}`}
        aria-hidden="true"
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="text-gray-300"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
          <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
          <path d="M21 15l-5-5L5 21" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      priority={priority}
      placeholder="blur"
      blurDataURL={BLUR_DATA_URL}
      loading={priority ? undefined : "lazy"}
      onError={() => setErrored(true)}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
