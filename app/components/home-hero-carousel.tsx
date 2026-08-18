"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HomeHeroSlideSetting } from "@/lib/settings";
import styles from "./home-hero-carousel.module.css";

type HeroProfile = {
  name: string;
  tagline?: string;
  status?: string;
  location?: string;
  avatarUrl?: string;
};

type HomeHeroCarouselProps = {
  profile: HeroProfile;
  slides: HomeHeroSlideSetting[];
  stats: Array<{ label: string; value: number }>;
};

function safeHref(value: string) {
  const href = value.trim();
  return /^(?:https?:\/\/|mailto:|tel:|\/|#)/i.test(href) ? href : "/world";
}

function isExternalHref(href: string) {
  return /^(?:https?:\/\/|mailto:|tel:)/i.test(href);
}

export function HomeHeroCarousel({ profile, slides, stats }: HomeHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const safeIndex = slides.length > 0 ? Math.min(activeIndex, slides.length - 1) : 0;
  const slide = slides[safeIndex];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (hovered || documentHidden || reducedMotion || slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 7200);
    return () => window.clearInterval(timer);
  }, [documentHidden, hovered, reducedMotion, slides.length]);

  useEffect(() => {
    const handleVisibility = () => setDocumentHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reducedMotion) return;
    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 64;
      const heroHeight = window.innerHeight - headerHeight;
      const travel = Math.max(stage.offsetHeight - heroHeight, 1);
      const distance = headerHeight - stage.getBoundingClientRect().top;
      const progress = Math.max(0, Math.min(1, distance / travel));
      stage.style.setProperty("--hero-progress", String(progress));
      stage.style.setProperty("--hero-copy-shift", `${progress * -42}px`);
      stage.style.setProperty("--hero-media-shift", `${progress * -18}px`);
      stage.style.setProperty("--hero-media-scale", String(1 + progress * 0.065));
      stage.style.setProperty("--hero-copy-opacity", String(1 - progress * 0.72));
    };

    const requestProgressUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };
    requestProgressUpdate();
    window.addEventListener("scroll", requestProgressUpdate, { passive: true });
    window.addEventListener("resize", requestProgressUpdate);
    return () => {
      window.removeEventListener("scroll", requestProgressUpdate);
      window.removeEventListener("resize", requestProgressUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);

  if (!slide) return null;

  const href = safeHref(slide.href);
  const primaryAction = isExternalHref(href) ? (
    <a href={href} className={styles.primaryAction} target="_blank" rel="noopener noreferrer">
      {slide.linkLabel || "继续浏览"}
      <span aria-hidden="true">↗</span>
    </a>
  ) : (
    <Link href={href} className={styles.primaryAction}>
      {slide.linkLabel || "继续浏览"}
      <span aria-hidden="true">↗</span>
    </Link>
  );

  return (
    <section ref={stageRef} className={styles.stage}>
      <div
        className={styles.hero}
        aria-label="LQPP World 首页导览"
        aria-roledescription="carousel"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false);
        }}
      >
        <div className={styles.media}>
          {slides.map((item, index) => (
            <div
              key={item.id}
              className={`${styles.slide} ${index === safeIndex ? styles.slideActive : ""}`}
              aria-hidden={index !== safeIndex}
            >
              {item.imageUrl.trim() ? (
                <img
                  src={item.imageUrl}
                  alt={index === safeIndex ? item.imageAlt : ""}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  className={styles.image}
                />
              ) : (
                <span className={styles.imageFallback} aria-hidden="true" />
              )}
            </div>
          ))}
          <div className={styles.shade} aria-hidden="true" />
        </div>

        <div className={styles.inner}>
          <div className={styles.topline}>
            <span>{profile.name || "LQPP"}</span>
            <span className={styles.toplineRule} aria-hidden="true" />
            <span>{profile.location || "Personal Digital Garden"}</span>
          </div>

          <div className={styles.copy} key={`${slide.id}-${safeIndex}`} aria-live="polite">
            <p className={styles.eyebrow}>{slide.eyebrow || "LQPP / FEATURED"}</p>
            <h1>{slide.title || "一段正在发生的故事"}</h1>
            {slide.description ? <p className={styles.description}>{slide.description}</p> : null}
            <div className={styles.actions}>
              {primaryAction}
              <Link href="/articles" className={styles.secondaryAction}>浏览全部文章</Link>
            </div>
          </div>

          <div className={styles.bottomline}>
            <div className={styles.profile}>
              <span className={styles.avatar}>
                {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{(profile.name || "LQ").slice(0, 2)}</span>}
              </span>
              <span className={styles.profileText}>
                <strong>{profile.name || "LQPP"}</strong>
                <span>{profile.status || profile.tagline || "Stay curious, stay kind."}</span>
              </span>
            </div>
            <div className={styles.stats} aria-label="公开内容统计">
              {stats.map((item) => <span key={item.label}><strong>{item.value}</strong> {item.label}</span>)}
            </div>
            <div className={styles.controls} aria-label="首页视觉切换">
              <span className={styles.slideCount}>{String(safeIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
              {slides.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className={`${styles.dot} ${index === safeIndex ? styles.dotActive : ""}`}
                  aria-label={`切换到第 ${index + 1} 张首页图片`}
                  aria-pressed={index === safeIndex}
                  aria-current={index === safeIndex ? "true" : undefined}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
          </div>
        </div>

        <a className={styles.scrollCue} href="#travel-map" aria-label="向下浏览 3D 中国旅行地图">
          <span>向下浏览</span>
          <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  );
}
