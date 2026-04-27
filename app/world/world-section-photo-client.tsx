"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import type { WorldSectionSetting } from "@/lib/settings";

export function WorldSectionPhotoClient({ section }: { section: WorldSectionSetting }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <>
      {lightbox && (
        <div className="photo-lightbox" onClick={() => setLightbox(null)}>
          <button className="photo-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="大图" onClick={(e) => e.stopPropagation()} />
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
          {section.cover
            ? (
              <img
                src={section.cover}
                alt={section.title}
                style={{ cursor: "zoom-in" }}
                onClick={() => setLightbox(section.cover)}
              />
            )
            : <span className="world-sub-cover-placeholder">{section.icon} 封面图待上传</span>}
        </div>

        {section.tags.length > 0 && (
          <div className="world-tag-row">
            {section.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}

        {/* 段落块渲染：支持文字+照片交替 */}
        {(section.sections ?? []).length > 0 ? (
          <div className="world-content-blocks">
            {(section.sections ?? []).map((block, bi) => (
              <div key={bi} className="world-content-block">
                {block.caption && <p className="world-sub-desc">{block.caption}</p>}
                {block.photos.length > 0 && (
                  <div className="world-sub-photo-grid">
                    {block.photos.map((url, pi) => (
                      <img
                        key={pi}
                        src={url}
                        alt={`${section.title} ${bi + 1}-${pi + 1}`}
                        style={{ cursor: "zoom-in" }}
                        onClick={() => setLightbox(url)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* 兼容旧数据：desc + photos 单块 */
          <>
            {section.desc && <p className="world-sub-desc">{section.desc}</p>}
            {(section.photos ?? []).length > 0 ? (
              <div className="world-sub-photo-grid">
                {(section.photos ?? []).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`${section.title} ${i + 1}`}
                    style={{ cursor: "zoom-in" }}
                    onClick={() => setLightbox(url)}
                  />
                ))}
              </div>
            ) : (
              <div className="world-sub-photo-placeholder">
                <p>照片待上传，可在 <Link href="/admin/settings">后台设置</Link> 添加段落</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
