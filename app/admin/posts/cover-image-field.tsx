"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type CoverImageFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
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

export function CoverImageField({
  value,
  onChange,
  disabled = false,
}: CoverImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpload(file: File | null) {
    if (!file) {
      return;
    }

    const password = localStorage.getItem("admin_password") || "";

    if (!password) {
      setMessage("后台密码已丢失，请重新进入后台。");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setMessage("");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-admin-password": password,
        },
        body: formData,
      });

      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "封面图上传失败。"
        );
      }

      const imageUrl = typeof data?.url === "string" ? data.url : "";

      if (!imageUrl) {
        throw new Error("上传成功，但没有拿到封面图地址。");
      }

      onChange(imageUrl);
      setMessage("封面图已上传并回填。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "封面图上传失败。");
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="cover-field-shell post-form-span-2">
      <div className="cover-field">
        <input
          className="admin-input"
          placeholder="封面图 URL"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || uploading}
        />
        <button
          type="button"
          className="secondary-link cover-upload-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? "上传中…" : "上传封面图"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => void handleUpload(event.target.files?.[0] || null)}
        />
      </div>

      {message ? <div className="status-banner">{message}</div> : null}

      {value ? (
        <div className="cover-preview-card">
          <Image
            src={value}
            alt="封面预览"
            width={1200}
            height={720}
            sizes="(max-width: 720px) calc(100vw - 24px), 60vw"
            unoptimized
            className="cover-preview-image"
          />
        </div>
      ) : null}
    </div>
  );
}
