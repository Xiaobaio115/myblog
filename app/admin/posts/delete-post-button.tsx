"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeletePostButtonProps = {
  slug: string;
  postId: string;
};

async function parseJsonSafely(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
}

export function DeletePostButton({ slug, postId }: DeletePostButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "确定删除这篇文章吗？文章和本地访问记录会一起删除。"
    );

    if (!confirmed) {
      return;
    }

    const password = window.localStorage.getItem("admin_password") || "";

    if (!password) {
      window.alert("后台密码已丢失，请重新进入后台。");
      router.push("/admin");
      return;
    }

    setDeleting(true);

    try {
      const slugPart = slug || "__no_slug__";
      const idParam = postId ? `?_id=${encodeURIComponent(postId)}` : "";
      const response = await fetch(`/api/posts/${encodeURIComponent(slugPart)}${idParam}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": password,
        },
      });
      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "删除文章失败。"
        );
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "删除文章失败。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      className="danger-btn post-row-delete"
      onClick={() => void handleDelete()}
      disabled={deleting}
    >
      {deleting ? "删除中..." : "删除"}
    </button>
  );
}
