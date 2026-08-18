"use client";

import { useState } from "react";
import styles from "./safe-image.module.css";

type SafeImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  fallback?: string;
  loading?: "eager" | "lazy";
};

export function SafeImage({
  src,
  alt,
  className = "",
  imageClassName = "",
  fallback = "影像待显影",
  loading = "lazy",
}: SafeImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const loaded = Boolean(src && loadedSrc === src);
  const failed = !src || failedSrc === src;

  return (
    <span className={`${styles.frame} ${className}`}>
      {!failed && src ? (
        // A native image is intentional: photo URLs are user-managed and can use arbitrary hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          className={`${styles.image} ${loaded ? styles.loaded : ""} ${imageClassName}`}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      ) : null}
      <span className={failed || !loaded ? styles.fallback : styles.hidden} aria-hidden="true">
        {fallback}
      </span>
    </span>
  );
}
