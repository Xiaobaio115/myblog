"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import type { ContentBlock } from "@/lib/content";

type Props = {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  disabled?: boolean;
};

type ApiPhoto = { _id: string; url?: string; caption?: string };

export function ContentBlocksEditor({ blocks, onChange, disabled }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBlockIdx, setPickerBlockIdx] = useState<number | null>(null);
  const [photos, setPhotos] = useState<ApiPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  async function openPhotoPicker(blockIdx: number) {
    setPickerBlockIdx(blockIdx);
    setPickerOpen(true);
    if (photos.length === 0) {
      setLoadingPhotos(true);
      try {
        const data = await adminFetch<ApiPhoto[]>("/api/photos?limit=200", {
          fallbackError: "读取照片失败。",
        });
        setPhotos(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      } finally {
        setLoadingPhotos(false);
      }
    }
  }

  function togglePhoto(blockIdx: number, url: string) {
    const next = [...blocks];
    const block = { ...next[blockIdx] };
    if (block.photos.includes(url)) {
      block.photos = block.photos.filter((p) => p !== url);
    } else {
      block.photos = [...block.photos, url];
    }
    next[blockIdx] = block;
    onChange(next);
  }

  function addBlock() {
    onChange([...blocks, { caption: "", photos: [] }]);
  }

  function removeBlock(idx: number) {
    onChange(blocks.filter((_, i) => i !== idx));
  }

  function updateBlock(idx: number, patch: Partial<ContentBlock>) {
    const next = [...blocks];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function moveBlock(idx: number, direction: "up" | "down") {
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === blocks.length - 1) return;
    const next = [...blocks];
    const target = direction === "up" ? idx - 1 : idx + 1;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-soft)", fontWeight: 700 }}>
          内容段落（可选，用于旅行图文等富媒体内容）
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>
          {blocks.length} 个段落
        </span>
      </div>

      {blocks.map((block, idx) => (
        <div
          key={idx}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 14,
            display: "grid",
            gap: 10,
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 700 }}>
              段落 {idx + 1}
            </span>
            <button
              type="button"
              onClick={() => moveBlock(idx, "up")}
              disabled={idx === 0 || disabled}
              style={{
                fontSize: "0.7rem",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "1px 8px",
                cursor: idx === 0 ? "default" : "pointer",
                opacity: idx === 0 ? 0.4 : 1,
              }}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveBlock(idx, "down")}
              disabled={idx === blocks.length - 1 || disabled}
              style={{
                fontSize: "0.7rem",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "1px 8px",
                cursor: idx === blocks.length - 1 ? "default" : "pointer",
                opacity: idx === blocks.length - 1 ? 0.4 : 1,
              }}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => removeBlock(idx)}
              disabled={disabled}
              style={{
                marginLeft: "auto",
                fontSize: "0.75rem",
                color: "#ef4444",
                background: "none",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                padding: "2px 10px",
                cursor: "pointer",
              }}
            >
              删除段落
            </button>
          </div>

          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>描述文字</label>
            <textarea
              className="admin-input"
              rows={2}
              placeholder="这一段的描述文字…（可留空）"
              value={block.caption}
              onChange={(e) => updateBlock(idx, { caption: e.target.value })}
              disabled={disabled}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>关联标签（可选，用于前台筛选）</label>
            <input
              className="admin-input"
              placeholder="如 火锅"
              value={block.tag ?? ""}
              onChange={(e) => updateBlock(idx, { tag: e.target.value || undefined })}
              disabled={disabled}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-soft)", fontWeight: 700 }}>
                照片 {block.photos.length} 张
              </span>
              <button
                type="button"
                className="secondary-link"
                onClick={() => openPhotoPicker(idx)}
                disabled={disabled}
                style={{ fontSize: "0.78rem" }}
              >
                从相册选择
              </button>
            </div>

            {block.photos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {block.photos.map((url, pi) => (
                  <div
                    key={pi}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      overflow: "hidden",
                      position: "relative",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <img
                      src={url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...block, photos: block.photos.filter((_, i) => i !== pi) };
                        updateBlock(idx, next);
                      }}
                      disabled={disabled}
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "none",
                        fontSize: 10,
                        cursor: "pointer",
                        lineHeight: "18px",
                        textAlign: "center",
                        padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                className="admin-input"
                placeholder="或粘贴照片 URL 后回车添加"
                style={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const url = (e.target as HTMLInputElement).value.trim();
                    if (url) {
                      updateBlock(idx, { photos: [...block.photos, url] });
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addBlock}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "10px",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          background: "transparent",
          color: "var(--text-soft)",
          cursor: "pointer",
          fontSize: "0.88rem",
          fontWeight: 600,
        }}
      >
        + 添加段落
      </button>

      {/* Photo picker modal */}
      {pickerOpen && pickerBlockIdx !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setPickerOpen(false)}
        >
          <div
            style={{
              background: "var(--bg)",
              borderRadius: 20,
              padding: 24,
              maxWidth: 640,
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>选择照片</h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                style={{ marginLeft: "auto", background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--text-soft)" }}
              >
                ✕
              </button>
            </div>

            {loadingPhotos && <p style={{ color: "var(--text-soft)" }}>加载中…</p>}

            {!loadingPhotos && photos.length === 0 && (
              <p style={{ color: "var(--text-soft)" }}>暂无上传的照片</p>
            )}

            {!loadingPhotos && photos.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                {photos.map((photo) => {
                  const url = photo.url ?? "";
                  const selected = blocks[pickerBlockIdx].photos.includes(url);
                  return (
                    <div
                      key={photo._id}
                      onClick={() => togglePhoto(pickerBlockIdx, url)}
                      style={{
                        aspectRatio: "1",
                        borderRadius: 8,
                        overflow: "hidden",
                        cursor: "pointer",
                        border: selected ? "2px solid var(--pink)" : "1px solid var(--border)",
                        position: "relative",
                      }}
                    >
                      <img
                        src={url}
                        alt={photo.caption ?? ""}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      {selected && (
                        <span
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            background: "var(--pink)",
                            color: "#fff",
                            borderRadius: "50%",
                            width: 20,
                            height: 20,
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}