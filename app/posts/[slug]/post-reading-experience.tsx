"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./post-detail.module.css";

export type TocItem = {
  id: string;
  text: string;
  depth: number;
};

type LightboxImage = {
  src: string;
  alt: string;
};

export function PostReadingExperience({
  html,
  toc,
}: {
  html: string;
  toc: TocItem[];
}) {
  const articleRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLImageElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState(toc[0]?.id || "");
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxOpen = lightboxIndex !== null;

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    const updateProgress = () => {
      const rect = article.getBoundingClientRect();
      const travelled = Math.max(0, -rect.top + window.innerHeight * 0.2);
      const available = Math.max(1, rect.height - window.innerHeight * 0.55);
      setProgress(Math.min(100, Math.max(0, (travelled / available) * 100)));
    };

    const narrativeBlocks = Array.from(article.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    narrativeBlocks.forEach((block) => block.classList.add(styles.narrativeBlock));
    const hasNativeViewTimeline = CSS.supports("animation-timeline: view()");

    const updateNarrativeBlocks = () => {
      if (hasNativeViewTimeline) return;
      const viewportHeight = window.innerHeight;

      narrativeBlocks.forEach((block) => {
        const rect = block.getBoundingClientRect();
        if (rect.bottom < -viewportHeight || rect.top > viewportHeight * 2) return;

        let opacity = 1;
        let shift = 0;

        if (rect.top > viewportHeight * 0.62) {
          const entry = Math.max(0, Math.min(1, (viewportHeight * 0.94 - rect.top) / (viewportHeight * 0.32)));
          opacity = 0.08 + entry * 0.92;
          shift = (1 - entry) * 36;
        } else if (rect.bottom < viewportHeight * 0.2) {
          const exit = Math.max(0, Math.min(1, (viewportHeight * 0.2 - rect.bottom) / (viewportHeight * 0.24)));
          opacity = 1 - exit * 0.72;
          shift = exit * -20;
        }

        block.style.setProperty("--narrative-opacity", String(opacity));
        block.style.setProperty("--narrative-shift", `${shift}px`);
      });
    };

    let narrativeFrame = 0;
    const updateOnScroll = () => {
      updateProgress();
      if (narrativeFrame) cancelAnimationFrame(narrativeFrame);
      narrativeFrame = requestAnimationFrame(updateNarrativeBlocks);
    };

    const articleImages = Array.from(article.querySelectorAll("img"));

    const classifyImage = (image: HTMLImageElement) => {
      image.loading = image.loading || "lazy";
      image.decoding = "async";
      image.removeAttribute("width");
      image.removeAttribute("height");
      image.style.height = "auto";
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `${image.alt || "正文图片"}，点击放大`);

      const applyShape = () => {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) return;
        const ratio = width / height;
        if (ratio >= 1.55) image.dataset.shape = "wide";
        else if (ratio <= 0.78) image.dataset.shape = "tall";
        else image.dataset.shape = "regular";
      };

      if (image.complete && image.naturalWidth > 0) applyShape();
      else image.addEventListener("load", applyShape, { once: true });
    };

    articleImages.forEach(classifyImage);
    setImages(articleImages.map((image) => ({ src: image.currentSrc || image.src, alt: image.alt })));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveHeading(visible.target.id);
      },
      { rootMargin: "-18% 0px -68%", threshold: [0, 1] },
    );

    toc.forEach(({ id }) => {
      const heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    });
    updateOnScroll();
    window.addEventListener("scroll", updateOnScroll, { passive: true });
    window.addEventListener("resize", updateOnScroll);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateOnScroll);
      window.removeEventListener("resize", updateOnScroll);
      cancelAnimationFrame(narrativeFrame);
      narrativeBlocks.forEach((block) => {
        block.classList.remove(styles.narrativeBlock);
        block.style.removeProperty("--narrative-opacity");
        block.style.removeProperty("--narrative-shift");
      });
    };
  }, [html, toc]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setLightboxIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setLightboxIndex((current) => current === null ? null : (current + 1) % images.length);
      }
      if (event.key === "Tab") {
        const controls = Array.from(lightboxRef.current?.querySelectorAll<HTMLButtonElement>("button") || []);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
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
      triggerRef.current?.focus();
    };
  }, [images.length, lightboxOpen]);

  function openImage(image: HTMLImageElement) {
    const index = Array.from(articleRef.current?.querySelectorAll("img") || []).indexOf(image);
    if (index >= 0) {
      triggerRef.current = image;
      setLightboxIndex(index);
    }
  }

  const selectedImage = lightboxIndex === null ? null : images[lightboxIndex];

  return (
    <>
      <div className={styles.progress} aria-hidden="true">
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <div className={styles.readingGrid}>
        {toc.length > 0 ? (
          <aside className={styles.toc} aria-label="文章目录">
            <span className={styles.tocLabel}>本文目录</span>
            <ol>
              {toc.map((item) => (
                <li key={item.id} data-depth={item.depth}>
                  <a className={activeHeading === item.id ? styles.tocActive : ""} href={`#${item.id}`}>
                    {item.text}
                  </a>
                </li>
              ))}
            </ol>
          </aside>
        ) : null}
        <div
          ref={articleRef}
          className={styles.content}
          onClick={(event) => {
            if (event.target instanceof HTMLImageElement) openImage(event.target);
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLImageElement) {
              event.preventDefault();
              openImage(event.target);
            }
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {selectedImage ? (
        <div ref={lightboxRef} className={styles.lightbox} role="dialog" aria-modal="true" aria-label="正文图片预览" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setLightboxIndex(null);
        }}>
          <button ref={closeButtonRef} className={styles.lightboxClose} type="button" onClick={() => setLightboxIndex(null)} aria-label="关闭预览">×</button>
          {images.length > 1 ? (
            <button className={`${styles.lightboxNav} ${styles.lightboxPrev}`} type="button" onClick={() => setLightboxIndex((current) => current === null ? null : (current - 1 + images.length) % images.length)} aria-label="上一张">←</button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedImage.src} alt={selectedImage.alt} />
          {images.length > 1 ? (
            <button className={`${styles.lightboxNav} ${styles.lightboxNext}`} type="button" onClick={() => setLightboxIndex((current) => current === null ? null : (current + 1) % images.length)} aria-label="下一张">→</button>
          ) : null}
          <span className={styles.lightboxCount} aria-live="polite">{(lightboxIndex ?? 0) + 1} / {images.length}</span>
        </div>
      ) : null}
    </>
  );
}
