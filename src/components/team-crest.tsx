"use client";

import Image from "next/image";
import { useState } from "react";

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const SIZES = { sm: 32, md: 48, lg: 64, xl: 96 } as const;

interface TeamCrestProps {
  src: string | null | undefined;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
}

function FallbackIcon({ px, className, alt }: { px: number; className?: string; alt: string }) {
  return (
    <div
      role="img"
      aria-label={alt}
      style={{ width: px, height: px }}
      className={`bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 ${className ?? ""}`}
    >
      <svg
        width={px * 0.6}
        height={px * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="text-gray-400"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path
          d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

export function TeamCrest({
  src,
  alt,
  size = "md",
  className,
  priority = false,
}: TeamCrestProps) {
  const [errored, setErrored] = useState(false);
  const px = SIZES[size];

  if (!src || errored) {
    return <FallbackIcon px={px} className={className} alt={alt} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={px}
      height={px}
      placeholder="blur"
      blurDataURL={BLUR_DATA_URL}
      priority={priority}
      onError={() => setErrored(true)}
      className={`object-contain flex-shrink-0 ${className ?? ""}`}
    />
  );
}
