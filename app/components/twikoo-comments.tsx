"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    twikoo?: {
      init: (options: {
        envId: string;
        el: string;
        path: string;
        lang?: string;
      }) => void;
    };
  }
}

const CONTAINER_ID = "twikoo-thread";

export function TwikooComments({
  envId,
  path,
}: {
  envId?: string;
  path: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!envId || !ready || !window.twikoo) {
      return;
    }

    const container = document.getElementById(CONTAINER_ID);

    if (container) {
      container.innerHTML = "";
    }

    window.twikoo.init({
      envId,
      el: `#${CONTAINER_ID}`,
      path,
      lang: "zh-CN",
    });
  }, [envId, path, ready]);

  if (!envId) {
    return (
      <div className="comment-placeholder">
        还没有配置 Twikoo。部署后可在环境变量里补上 `TWIKOO_ENV_ID`。
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/twikoo@1.6.39/dist/twikoo.all.min.js"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
        onReady={() => setReady(true)}
      />
      <div id={CONTAINER_ID} className="comment-shell" />
    </>
  );
}
