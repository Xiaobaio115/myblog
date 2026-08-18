"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import type { Photo } from "@/lib/content";
import styles from "./photo-gallery.module.css";

interface Props {
  photos: Photo[];
  categories: string[];
}

const ALL = "全部";
const UNDATED = "未标年份";
const UNCATEGORIZED = "未分类";
const UNLOCATED = "未标地点";

function getYear(date: string) {
  return date.match(/(?:19|20)\d{2}/)?.[0] || UNDATED;
}

function getCategory(photo: Photo) {
  return photo.category?.trim() || UNCATEGORIZED;
}

function getLocation(photo: Photo) {
  return photo.location?.trim() || UNLOCATED;
}

function ArchiveImage({
  src,
  alt,
  fallback,
  className,
  loading = "lazy",
  adaptive = false,
}: {
  src?: string;
  alt: string;
  fallback: string;
  className: string;
  loading?: "eager" | "lazy";
  adaptive?: boolean;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>();
  const loaded = Boolean(src && loadedSrc === src);
  const failed = !src || failedSrc === src;

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    setLoadedSrc(src || null);

    if (!adaptive) return;

    const { naturalHeight, naturalWidth } = event.currentTarget;
    if (!naturalHeight || !naturalWidth) return;

    // Keep the original orientation while preventing extreme panoramas or
    // portrait screenshots from overwhelming the surrounding masonry column.
    const measuredRatio = naturalWidth / naturalHeight;
    const galleryRatio = Math.min(1.85, Math.max(0.62, measuredRatio));
    setAspectRatio(galleryRatio.toFixed(4));
  }

  return (
    <span
      className={`${styles.mediaFrame} ${className} ${failed ? styles.mediaMissing : ""}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {!failed && src ? (
        // Photo URLs are user-managed and may come from arbitrary Blob hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          className={loaded ? styles.mediaLoaded : ""}
          onLoad={handleLoad}
          onError={() => setFailedSrc(src)}
        />
      ) : null}
      {failed || !loaded ? (
        <span className={styles.mediaFallback} aria-hidden="true">
          {fallback}
        </span>
      ) : null}
    </span>
  );
}

export function PhotoGallery({ photos, categories }: Props) {
  const [category, setCategory] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const categoryOptions = useMemo(() => {
    const normalized = [
      ...categories.map((item) => item.trim()),
      ...photos.map(getCategory),
    ].filter((item) => Boolean(item) && item !== ALL);

    return Array.from(new Set(normalized));
  }, [categories, photos]);

  const years = useMemo(() => {
    return Array.from(new Set(photos.map((photo) => getYear(photo.date)))).sort(
      (left, right) => {
        if (left === UNDATED) return 1;
        if (right === UNDATED) return -1;
        return Number(right) - Number(left);
      },
    );
  }, [photos]);

  const locations = useMemo(() => {
    return Array.from(new Set(photos.map(getLocation))).sort((left, right) =>
      left === UNLOCATED ? 1 : right === UNLOCATED ? -1 : left.localeCompare(right, "zh-CN"),
    );
  }, [photos]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const photo of photos) {
      const key = getCategory(photo);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [photos]);

  const yearCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const photo of photos) {
      const key = getYear(photo.date);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [photos]);

  const locationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const photo of photos) {
      const key = getLocation(photo);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [photos]);

  const displayed = useMemo(
    () =>
      photos.filter(
        (photo) =>
          (category === ALL || getCategory(photo) === category) &&
          (location === ALL || getLocation(photo) === location) &&
          (year === ALL || getYear(photo.date) === year),
      ),
    [category, location, photos, year],
  );

  function openPreview(index: number) {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPreviewIndex(index);
  }

  function resetFilters() {
    setCategory(ALL);
    setLocation(ALL);
    setYear(ALL);
  }

  const closePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  const showPrevious = useCallback(() => {
    setPreviewIndex((value) =>
      value === null
        ? null
        : (value - 1 + displayed.length) % displayed.length,
    );
  }, [displayed.length]);

  const showNext = useCallback(() => {
    setPreviewIndex((value) =>
      value === null ? null : (value + 1) % displayed.length,
    );
  }, [displayed.length]);

  const previewOpen = previewIndex !== null;

  useEffect(() => {
    if (!previewOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
      if (event.key === "ArrowRight") showNext();
      if (event.key === "ArrowLeft") showPrevious();

      if (event.key === "Tab") {
        const focusable = Array.from(
          lightboxRef.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]), a[href]",
          ) ?? [],
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [closePreview, previewOpen, showNext, showPrevious]);

  const preview = previewIndex === null ? null : displayed[previewIndex];
  const isFiltered = category !== ALL || location !== ALL || year !== ALL;
  const selectionLabel = [category, location, year]
    .filter((item) => item !== ALL)
    .join(" · ");

  return (
    <div className={styles.archive}>
      <div className={styles.indexHeader}>
        <div>
          <span className={styles.indexEyebrow}>Browse archive</span>
          <h2 className={styles.indexTitle}>影像索引</h2>
        </div>
        <p className={styles.indexTotal}>
          <strong>{photos.length.toString().padStart(2, "0")}</strong>
          <span>帧公开照片</span>
        </p>
      </div>

      {categoryOptions.length > 0 ? (
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>分类</span>
          <div className={styles.filters} role="group" aria-label="按分类筛选">
            {[ALL, ...categoryOptions].map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                className={`${styles.filter} ${category === item ? styles.active : ""}`}
                onClick={() => setCategory(item)}
              >
                <span>{item}</span>
                <span className={styles.filterCount} aria-hidden="true">
                  {item === ALL ? photos.length : categoryCounts.get(item) || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>地点</span>
        <div className={styles.filters} role="group" aria-label="按地点筛选">
          {[ALL, ...locations].map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={location === item}
              className={`${styles.filter} ${location === item ? styles.active : ""}`}
              onClick={() => setLocation(item)}
            >
              <span>{item}</span>
              <span className={styles.filterCount} aria-hidden="true">
                {item === ALL ? photos.length : locationCounts.get(item) || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>年份</span>
        <div className={styles.filters} role="group" aria-label="按年份筛选">
          {[ALL, ...years].map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={year === item}
              className={`${styles.filter} ${year === item ? styles.active : ""}`}
              onClick={() => setYear(item)}
            >
              <span>{item}</span>
              <span className={styles.filterCount} aria-hidden="true">
                {item === ALL ? photos.length : yearCounts.get(item) || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.resultRow} aria-live="polite" aria-atomic="true">
        <p className={styles.count}>
          {isFiltered ? `${selectionLabel}，` : "全部影像，"}
          正在展示 {displayed.length} 张
        </p>
        {isFiltered ? (
          <button type="button" className={styles.reset} onClick={resetFilters}>
            重置筛选
          </button>
        ) : null}
      </div>

      {displayed.length > 0 ? (
        <div className={styles.grid}>
          {displayed.map((photo, index) => (
            <figure
              key={photo._id}
              className={styles.item}
              style={{ animationDelay: `${Math.min(index * 32, 320)}ms` }}
            >
              <button
                type="button"
                className={styles.button}
                onClick={() => openPreview(index)}
                aria-label={`放大查看：${photo.caption || "相册照片"}`}
              >
                <ArchiveImage
                  src={photo.url}
                  alt={photo.caption || "相册照片"}
                  fallback={photo.emoji || "影像待显影"}
                  className={styles.media}
                  adaptive
                />
                <span className={styles.overlay}>
                  <span className={styles.caption}>
                    {photo.caption || "相册照片"}
                  </span>
                  <span className={styles.details}>
                    <span>{getCategory(photo)} · {getLocation(photo)}</span>
                    <time>{photo.date}</time>
                  </span>
                </span>
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <div className={styles.empty} role="status">
          <span className={styles.emptyIndex} aria-hidden="true">
            00
          </span>
          <div>
            <h3>这个组合暂时没有照片</h3>
            <p>换一个年份或分类，继续翻阅影像档案。</p>
          </div>
          <button type="button" className={styles.emptyAction} onClick={resetFilters}>
            查看全部照片
          </button>
        </div>
      )}

      {preview && previewIndex !== null ? (
        <div
          ref={lightboxRef}
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-lightbox-title"
          aria-describedby="photo-lightbox-meta"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            touchStartRef.current = touch
              ? { x: touch.clientX, y: touch.clientY }
              : null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartRef.current;
            const touch = event.changedTouches[0];
            touchStartRef.current = null;
            if (!start || !touch || displayed.length < 2) return;

            const deltaX = touch.clientX - start.x;
            const deltaY = touch.clientY - start.y;
            if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) {
              return;
            }
            if (deltaX < 0) showNext();
            else showPrevious();
          }}
        >
          <div className={styles.dialog}>
            <ArchiveImage
              src={preview.url}
              alt={preview.caption || "相册照片"}
              fallback={preview.emoji || "影像待显影"}
              className={styles.preview}
              loading="eager"
            />
            <div className={styles.info}>
              <span className={styles.infoIndex}>
                {(previewIndex + 1).toString().padStart(2, "0")} /{" "}
                {displayed.length.toString().padStart(2, "0")}
              </span>
              <strong id="photo-lightbox-title">
                {preview.caption || "相册照片"}
              </strong>
              <span id="photo-lightbox-meta">
                {getCategory(preview)} · {getLocation(preview)} · {preview.date}
              </span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={closePreview}
            aria-label="关闭图片预览"
          >
            ×
          </button>
          {displayed.length > 1 ? (
            <>
              <button
                type="button"
                className={`${styles.nav} ${styles.previous}`}
                onClick={showPrevious}
                aria-label="上一张"
              >
                ←
              </button>
              <button
                type="button"
                className={`${styles.nav} ${styles.next}`}
                onClick={showNext}
                aria-label="下一张"
              >
                →
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
