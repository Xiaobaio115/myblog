"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";

type HomePhotoItemProps = {
  href?: string;
  url: string;
  caption?: string;
};

export function HomePhotoItem({ href = "/photos", url, caption = "精选瞬间" }: HomePhotoItemProps) {
  const [broken, setBroken] = useState(false);

  return (
    <Link href={href} className={`home-photo-item${broken ? " is-broken" : ""}`}>
      {!broken ? (
        <img
          src={url}
          alt={caption}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : null}
      <span className="home-photo-caption">{caption}</span>
    </Link>
  );
}
