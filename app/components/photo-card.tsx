/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { Photo } from "@/lib/content";

export function PhotoCard({ photo }: { photo: Photo }) {
  const cardBody = (
    <>
      {photo.url ? (
        <img src={photo.url} alt={photo.caption} className="photo-media" />
      ) : (
        <div className="photo-fallback">
          <span>{photo.emoji || "📷"}</span>
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
