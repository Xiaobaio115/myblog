"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import type { Photo } from "@/lib/content";

export function PhotoCard({ photo }: { photo: Photo }) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(photo.url) && !broken;

  const cardBody = (
    <>
      {showImage ? (
        <img
          src={photo.url}
          alt={photo.caption}
          className="photo-media"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="photo-fallback">
          <span>{photo.emoji || "✦"}</span>
        </div>
      )}

      <div className="photo-overlay">
        <div>
          <div className="photo-caption">{photo.caption}</div>
          <div className="photo-date">{photo.date}</div>
        </div>
      </div>
    </>
  );

  if (photo.sourceHref) {
    return (
      <Link href={photo.sourceHref} className="photo-card">
        {cardBody}
      </Link>
    );
  }

  return <article className="photo-card">{cardBody}</article>;
}
