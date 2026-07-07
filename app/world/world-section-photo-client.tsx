"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import type { WorldSectionSetting } from "@/lib/settings";

function matchBlock(caption: string, blockTag: string | undefined, activeTag: string) {
  if (blockTag === activeTag) return true;
  return caption.includes(activeTag);
}

export function WorldSectionPhotoClient({
  section,
  initialTag,
}: {
  section: WorldSectionSetting;
  initialTag?: string;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(initialTag ?? null);

  const allBlocks = section.sections ?? [];
  const hasBlocks = allBlocks.length > 0;
  const filteredBlocks = activeTag
    ? allBlocks.filter((block) => matchBlock(block.caption, block.tag, activeTag))
    : allBlocks;

  return (
    <>
      {lightbox && (
        <div className="photo-lightbox" onClick={() => setLightbox(null)}>
          <button className="photo-lightbox-close" onClick={() => setLightbox(null)} type="button">
            ×
          </button>
          <img src={lightbox} alt="大图预览" onClick={(event) => event.stopPropagation()} />
        </div>
      )}

      <div className="world-sub-detail">
        <div className="world-sub-detail-header">
          <div>
            <h1>{section.title}</h1>
            <p className="world-sub-type">{section.eyebrow}</p>
          </div>
        </div>

        <div className="world-sub-cover">
          {section.cover ? (
            <img
              src={section.cover}
              alt={section.title}
              style={{ cursor: "zoom-in" }}
              onClick={() => setLightbox(section.cover)}
            />
          ) : (
            <span className="world-sub-cover-placeholder">{section.icon} 封面图待上传</span>
          )}
        </div>

        {section.tags.length > 0 && (
          <div className={`world-tag-row${hasBlocks ? " is-filter" : ""}`}>
            {section.tags.map((tag) => (
              <span
                key={tag}
                className={activeTag === tag ? "active" : undefined}
                onClick={hasBlocks ? () => setActiveTag(activeTag === tag ? null : tag) : undefined}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {allBlocks.length > 0 ? (
          <div className="world-content-blocks">
            {filteredBlocks.length === 0 && activeTag ? (
              <p className="world-sub-desc" style={{ opacity: 0.6 }}>
                暂无“{activeTag}”相关内容。
              </p>
            ) : (
              filteredBlocks.map((block, blockIndex) => (
                <div key={blockIndex} className="world-content-block">
                  {block.caption && <p className="world-sub-desc">{block.caption}</p>}
                  {block.photos.length > 0 && (
                    <div className="world-sub-photo-grid">
                      {block.photos.map((url, photoIndex) => (
                        <img
                          key={photoIndex}
                          src={url}
                          alt={`${section.title} ${blockIndex + 1}-${photoIndex + 1}`}
                          style={{ cursor: "zoom-in" }}
                          onClick={() => setLightbox(url)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {section.desc && <p className="world-sub-desc">{section.desc}</p>}
            {(section.photos ?? []).length > 0 ? (
              <div className="world-sub-photo-grid">
                {(section.photos ?? []).map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`${section.title} ${index + 1}`}
                    style={{ cursor: "zoom-in" }}
                    onClick={() => setLightbox(url)}
                  />
                ))}
              </div>
            ) : (
              <div className="world-sub-photo-placeholder">
                <p>
                  照片待上传，可在 <Link href="/admin/settings">后台设置</Link> 添加段落。
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
