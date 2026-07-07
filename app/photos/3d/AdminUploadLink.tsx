"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AdminUploadLink() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const password = localStorage.getItem("admin_password") || "";
    if (!password) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/auth", {
          headers: { "x-admin-password": password },
          cache: "no-store",
        });

        if (!cancelled) {
          setVisible(response.ok);
          if (!response.ok) localStorage.removeItem("admin_password");
        }
      } catch {
        if (!cancelled) setVisible(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return <Link href="/admin/photos">上传照片</Link>;
}
