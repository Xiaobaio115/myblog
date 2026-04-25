"use client";

import { useEffect, useState } from "react";

type PostViewTrackerProps = {
  slug: string;
  initialViews: number;
};

async function parseJsonSafely(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function PostViewTracker({
  slug,
  initialViews,
}: PostViewTrackerProps) {
  const [views, setViews] = useState(initialViews);

  useEffect(() => {
    let active = true;

    async function recordView() {
      try {
        const response = await fetch(`/api/posts/${encodeURIComponent(slug)}/view`, {
          method: "POST",
          cache: "no-store",
        });

        const data = await parseJsonSafely(response);

        if (!active || !response.ok) {
          return;
        }

        if (typeof data?.views === "number") {
          setViews(data.views);
        }
      } catch {
        // Ignore client-side tracking failures and keep the initial count.
      }
    }

    void recordView();

    return () => {
      active = false;
    };
  }, [slug]);

  return <span>{views} 次阅读</span>;
}
