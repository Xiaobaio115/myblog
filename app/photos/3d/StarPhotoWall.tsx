/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./StarPhotoWall.module.css";
import CommentsPanel from "./CommentsPanel";

type Photo = {
  _id: string;
  url: string;
  caption: string;
  category: string;
};

export default function StarPhotoWall({ photos }: { photos: Photo[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const hasDraggedRef = useRef(false);
  const lightboxHistoryRef = useRef(false);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const lightboxTriggerRef = useRef<HTMLButtonElement | null>(null);
  const lightboxTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const animationWakeRef = useRef<() => void>(() => undefined);
  const pausedRef = useRef(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [compactScene, setCompactScene] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(() => new Set());

  const displayPhotos = useMemo(
    () => photos.filter((photo) => photo.url.trim()),
    [photos],
  );

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactQuery = window.matchMedia("(max-width: 700px)");
    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    const lowPowerDevice =
      (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ||
      (navigatorWithMemory.deviceMemory !== undefined && navigatorWithMemory.deviceMemory <= 4);

    const syncPreferences = () => {
      setReducedMotion(motionQuery.matches);
      setCompactScene(compactQuery.matches || lowPowerDevice);
    };

    syncPreferences();
    motionQuery.addEventListener("change", syncPreferences);
    compactQuery.addEventListener("change", syncPreferences);
    return () => {
      motionQuery.removeEventListener("change", syncPreferences);
      compactQuery.removeEventListener("change", syncPreferences);
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    animationWakeRef.current();
  }, [paused]);

  const cards = useMemo(() => {
    const count = displayPhotos.length;
    if (count === 0) return [];
    const baseRadius = compactScene ? 150 : 520;
    const radiusJitter = compactScene ? 40 : 110;
    const yRange = compactScene ? 180 : 360;

    return displayPhotos.map((photo, index) => {
      const angle = (360 / count) * index;
      const seed = index * 137.508;
      const radius = baseRadius + ((seed % radiusJitter) - radiusJitter / 2);
      const y = ((seed * 3.1) % yRange) - yRange / 2;

      return {
        key: photo._id,
        photo,
        style: {
          transform: `rotateY(${angle}deg) translateZ(${radius}px) translateY(${y}px)`,
        } as CSSProperties,
      };
    });
  }, [compactScene, displayPhotos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const carousel = carouselRef.current;
    if (!canvas || !scene || !camera || !carousel) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── rotation state ──
    let rotY = 0, tgtY = 0, rotX = 0, tgtX = 0, zoom = 0, tgtZoom = 0;
    let dragging = false, sx = 0, sy = 0, lx = 0, ly = 0;
    let hoveringCard = false;

    const onDown = (e: MouseEvent | TouchEvent) => {
      dragging = true;
      animationWakeRef.current();
      hasDraggedRef.current = false;
      const p = "touches" in e ? e.touches[0] : e;
      sx = lx = p.clientX; sy = ly = p.clientY;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return;
      const p = "touches" in e ? e.touches[0] : e;
      if (Math.abs(p.clientX - sx) > 5 || Math.abs(p.clientY - sy) > 5)
        hasDraggedRef.current = true;
      
      // More responsive on desktop, gentler on mobile
      const isTouch = "touches" in e;
      const dragMultiplier = isTouch ? 0.25 : 0.35;
      const tiltMultiplier = isTouch ? 0.08 : 0.15;
      
      tgtY += (p.clientX - lx) * dragMultiplier;
      tgtX -= (p.clientY - ly) * tiltMultiplier;
      tgtX = Math.max(-15, Math.min(tgtX, 15));
      lx = p.clientX; ly = p.clientY;
      animationWakeRef.current();
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const isTouch = e.type === "wheel" && (e.ctrlKey || e.deltaY % 1 !== 0);
      const zoomSensitivity = isTouch ? 0.8 : 1.2;
      const maxZoom = window.innerWidth < 700 ? 400 : 800;
      
      tgtZoom += e.deltaY * -zoomSensitivity;
      tgtZoom = Math.max(-400, Math.min(tgtZoom, maxZoom));
      animationWakeRef.current();
    };
    const onEnter = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === "IMG") hoveringCard = true;
    };
    const onLeave = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === "IMG") hoveringCard = false;
    };

    scene.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    scene.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    scene.addEventListener("wheel", onWheel, { passive: false });
    carousel.addEventListener("mouseover", onEnter);
    carousel.addEventListener("mouseout", onLeave);

    // ── canvas particle system (faithful port of 1.html) ──
    type Particle = {
      type: "star" | "tree" | "core" | "ring" | "snow";
      x: number; y: number; baseX: number; baseY: number;
      size: number; alpha: number; baseAlpha: number;
      angle: number; speed: number; floatAngle: number;
      speedX?: number; speedY?: number; char?: string; spinSpeed?: number;
      radiusX?: number; radiusY?: number; r?: number;
      speedMult?: number; elevation?: number; intrinsicAngle?: number;
    };

    const SNOW = ["❄", "❅", "❆"];
    let W = 0, H = 0, dpr = 1, parts: Particle[] = [], rafId = 0;
    let canvasScale = 1, treeBottomY = 250;

    const mkBase = (
      type: Particle["type"], x: number, y: number,
      size: number, alpha: number, speed: number,
    ): Particle => ({
      type, x, y, baseX: x, baseY: y,
      size, alpha, baseAlpha: alpha,
      angle: Math.random() * Math.PI * 2,
      speed,
      floatAngle: Math.random() * Math.PI * 2,
    });

    const initCanvas = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, compactScene ? 1.25 : 1.75);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const treeTopY = -180;
      treeBottomY = 250;
      const treeHeight = treeBottomY - treeTopY;
      parts = [];

      // Keep the atmosphere on constrained devices without spending the full
      // desktop particle budget.
      const scaleFactor = reducedMotion ? 0.12 : compactScene ? 0.28 : 1;
      const particleBudget = reducedMotion ? 700 : compactScene ? 3200 : 9000;

      // background stars
      const numStars = Math.min(
        compactScene ? 700 : 2200,
        Math.floor((W * H) / (1000 / scaleFactor)),
      );
      for (let i = 0; i < numStars && parts.length < particleBudget; i++) {
        parts.push(mkBase("star",
          (Math.random() * 2 - 1) * W,
          (Math.random() * 2 - 1) * H,
          Math.random() * 2 + 0.1,
          Math.random() * 0.4 + 0.1,
          Math.random() * 0.04 + 0.01,
        ));
      }

      // central tree (cone of stars)
      const treeCount = Math.floor(2500 * scaleFactor);
      for (let i = 0; i < treeCount && parts.length < particleBudget; i++) {
        const depth = Math.pow(Math.random(), 0.7);
        const y = treeTopY + depth * treeHeight;
        const offsetX = (Math.random() - 0.5) * depth * 180 * Math.pow(Math.random(), 0.5) * 2;
        parts.push(mkBase("tree", offsetX, y,
          Math.random() * 1.2 + 0.2,
          Math.random() * 0.5 + 0.2,
          Math.random() * 0.05,
        ));
      }

      // dense core
      const coreCount = Math.floor(800 * scaleFactor);
      for (let i = 0; i < coreCount && parts.length < particleBudget; i++) {
        const y = treeTopY + Math.random() * treeHeight;
        parts.push(mkBase("core",
          (Math.random() - 0.5) * 15, y,
          Math.random() * 1.5 + 0.5,
          Math.random() * 0.6 + 0.4,
          Math.random() * 0.1,
        ));
      }

      // 3 elliptical rings synced with carousel rotation
      const r1x = Math.min(W * 0.7, 900);
      const r1y = 200;
      const ringCfg: Array<{ count: number; rx: number; ry: number; sMin: number; sMax: number; aMin: number; aMax: number; sp: number; mult: number; elevation: number; rPow: number; }> = [
        { count: Math.floor(4000 * scaleFactor), rx: r1x,        ry: r1y,        sMin: 0.2, sMax: 1.4, aMin: 0.1, aMax: 0.5, sp: 0.02, mult: 0.8,  elevation: 0,   rPow: 1.5 },
        { count: Math.floor(2500 * scaleFactor), rx: r1x * 0.4,  ry: r1y * 0.4,  sMin: 0.5, sMax: 2.5, aMin: 0.3, aMax: 0.9, sp: 0.03, mult: 2.2,  elevation: -30, rPow: 1.2 },
        { count: Math.floor(1000 * scaleFactor), rx: r1x * 0.15, ry: r1y * 0.15, sMin: 0.5, sMax: 3.0, aMin: 0.2, aMax: 1.0, sp: 0.04, mult: -3.5, elevation: -60, rPow: 0.8 },
      ];
      for (const cfg of ringCfg) {
        for (let i = 0; i < cfg.count && parts.length < particleBudget; i++) {
          const r = Math.pow(Math.random(), cfg.rPow);
          const p = mkBase("ring", 0, 0,
            Math.random() * (cfg.sMax - cfg.sMin) + cfg.sMin,
            (1 - r) * (Math.random() * (cfg.aMax - cfg.aMin) + cfg.aMin),
            Math.random() * cfg.sp,
          );
          p.radiusX = cfg.rx; p.radiusY = cfg.ry; p.r = r;
          p.speedMult = cfg.mult; p.elevation = cfg.elevation;
          p.intrinsicAngle = Math.random() * Math.PI * 2;
          parts.push(p);
        }
      }

      // snowflakes
      const snowCount = Math.floor(200 * scaleFactor);
      for (let i = 0; i < snowCount && parts.length < particleBudget; i++) {
        const p = mkBase("snow", 0, 0, 0, Math.random() * 0.4 + 0.3, 0);
        p.size = Math.random() * 10 + 8;
        p.speedX = Math.random() * 1.0 + 0.5;
        p.speedY = Math.random() * 1.5 + 1.0;
        p.char = SNOW[Math.floor(Math.random() * SNOW.length)];
        p.angle = Math.random() * Math.PI * 2;
        p.spinSpeed = (Math.random() - 0.5) * 0.05;
        p.x = (Math.random() * 2 - 1) * W;
        p.y = (Math.random() * 2 - 1) * H;
        parts.push(p);
      }
    };

    const drawParticle = (p: Particle, shouldAdvance: boolean) => {
      if (p.type === "snow") {
        if (shouldAdvance) {
          p.x += p.speedX!;
          p.y += p.speedY!;
          p.angle += p.spinSpeed!;
        }
        const boundX = (W / 2) / canvasScale + 100;
        const boundY = (H / 2) / canvasScale + 100;
        if (shouldAdvance && (p.x > boundX || p.y > boundY)) {
          if (Math.random() > 0.3) { p.x = (Math.random() * 2 - 1) * boundX; p.y = -boundY - 20; }
          else { p.x = -boundX - 20; p.y = (Math.random() * 2 - 1) * boundY; }
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = `rgba(255,255,255,${p.baseAlpha})`;
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(255,255,255,0.4)";
        ctx.fillText(p.char!, 0, 0);
        ctx.restore();
        return;
      }
      if (p.type === "ring") {
        if (shouldAdvance) p.intrinsicAngle! -= 0.001 * p.speedMult!;
        const sync = rotY * (Math.PI / 180);
        const fa = p.intrinsicAngle! + sync;
        p.x = Math.cos(fa) * p.radiusX! * p.r!;
        p.y = treeBottomY + Math.sin(fa) * p.radiusY! * p.r! + p.elevation!;
        if (shouldAdvance) p.floatAngle += 0.02;
        p.y -= Math.sin(p.floatAngle) * 2;
        if (shouldAdvance) p.angle += p.speed;
        p.alpha = p.baseAlpha + Math.sin(p.angle) * 0.8;
      } else {
        if (shouldAdvance) p.angle += p.speed;
        p.alpha = p.baseAlpha + Math.sin(p.angle) * 0.8;
        if (p.type === "tree" || p.type === "core") {
          if (shouldAdvance) p.floatAngle += 0.02;
          p.y = p.baseY - Math.sin(p.floatAngle) * 3;
          p.x = p.baseX + Math.cos(p.floatAngle) * 2;
        }
      }
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, p.alpha)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      if (p.type === "star" && p.size > 1.8) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(255,255,255,0.6)";
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    };

    let documentVisible = !document.hidden;
    const wakeAnimation = () => {
      if (!documentVisible || rafId) return;
      rafId = requestAnimationFrame(animate);
    };
    const animate = () => {
      rafId = 0;
      if (!documentVisible) return;
      if (!dragging && !hoveringCard && !pausedRef.current && !reducedMotion) tgtY += 0.1875;
      rotY += (tgtY - rotY) * 0.08;
      rotX += (tgtX - rotX) * 0.08;
      zoom += (tgtZoom - zoom) * 0.08;
      canvasScale = 1200 / (1200 - zoom);

      camera.style.transform = `translateZ(${zoom}px) rotateX(${rotX}deg)`;
      carousel.style.transform = `rotateY(${rotY}deg)`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "rgba(3,3,3,0.7)";
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2);
      ctx.scale(canvasScale, canvasScale);
      ctx.translate(0, rotX * 5);

      const shouldAdvanceParticles = !pausedRef.current && !reducedMotion;
      for (const p of parts) drawParticle(p, shouldAdvanceParticles);

      const transformsMoving =
        Math.abs(tgtY - rotY) > 0.02 ||
        Math.abs(tgtX - rotX) > 0.02 ||
        Math.abs(tgtZoom - zoom) > 0.1;
      if (shouldAdvanceParticles || dragging || transformsMoving) wakeAnimation();
    };

    animationWakeRef.current = wakeAnimation;

    const onVisibilityChange = () => {
      documentVisible = !document.hidden;
      if (documentVisible) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        wakeAnimation();
      } else {
        cancelAnimationFrame(rafId);
      }
    };

    initCanvas();
    wakeAnimation();

    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
      initCanvas();
      wakeAnimation();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelAnimationFrame(rafId);
      animationWakeRef.current = () => undefined;
      scene.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      scene.removeEventListener("touchstart", onDown);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      scene.removeEventListener("wheel", onWheel);
      carousel.removeEventListener("mouseover", onEnter);
      carousel.removeEventListener("mouseout", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [compactScene, reducedMotion]);

  useEffect(() => {
    if (!lightbox) return;

    if (!lightboxHistoryRef.current) {
      const currentState =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      window.history.pushState(
        { ...currentState, starPhotoPreview: true },
        "",
        window.location.href
      );
      lightboxHistoryRef.current = true;
    }

    const onPopState = () => {
      lightboxHistoryRef.current = false;
      setLightbox(null);
      window.setTimeout(() => lightboxTriggerRef.current?.focus(), 0);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [lightbox]);

  const showAdjacentPhoto = useCallback((direction: -1 | 1) => {
    if (!lightbox || displayPhotos.length < 2) return;
    const currentIndex = displayPhotos.findIndex((photo) => photo._id === lightbox._id);
    const nextIndex = (currentIndex + direction + displayPhotos.length) % displayPhotos.length;
    setLightbox(displayPhotos[nextIndex]);
  }, [displayPhotos, lightbox]);

  const closeLightbox = useCallback(() => {
    if (lightboxHistoryRef.current) {
      lightboxHistoryRef.current = false;
      setLightbox(null);
      window.history.back();
      window.setTimeout(() => lightboxTriggerRef.current?.focus(), 0);
      return;
    }

    setLightbox(null);
    window.setTimeout(() => lightboxTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => lightboxRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      const target = event.target as HTMLElement | null;
      const isEditing = target?.matches("input, textarea, [contenteditable='true']");
      if (!isEditing && event.key === "ArrowLeft") {
        event.preventDefault();
        showAdjacentPhoto(-1);
      }
      if (!isEditing && event.key === "ArrowRight") {
        event.preventDefault();
        showAdjacentPhoto(1);
      }

      if (event.key === "Tab" && lightboxRef.current) {
        const focusable = Array.from(
          lightboxRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])',
          ),
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
    };
  }, [closeLightbox, lightbox, showAdjacentPhoto]);

  return (
    <section className={styles.wall}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <header className={styles.hud}>
        <div>
          <span>MEMORY ORBIT</span>
          <strong>星空漫游</strong>
          <small>{displayPhotos.length} 张记忆 · {compactScene ? "轻量星轨" : "完整星轨"}</small>
        </div>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
        >
          {paused ? "继续漫游" : "暂停星轨"}
        </button>
      </header>

      <div ref={sceneRef} className={styles.scene}>
        <div ref={cameraRef} className={styles.camera}>
          <div className={styles.heart}>
            {[0, 1, 2, 3].map((index) => (
              <svg
                key={index}
                className={styles.heartLayer}
                style={{ "--heart-z": `${index * 2 - 4}px` } as CSSProperties}
                viewBox="0 0 24 24"
              >
                <defs>
                  <linearGradient
                    id={`heartGrad-${index}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#777777" />
                    <stop offset="100%" stopColor="#ffffff" />
                  </linearGradient>
                </defs>
                <path
                  fill="none"
                  stroke={`url(#heartGrad-${index})`}
                  strokeWidth="1.2"
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                />
              </svg>
            ))}
          </div>

          <div ref={carouselRef} className={styles.carousel}>
            {cards.map((card) => (
              <button
                key={card.key}
                className={styles.photoCard}
                style={card.style}
                type="button"
                aria-label={`查看照片：${card.photo.caption}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasDraggedRef.current) {
                    lightboxTriggerRef.current = e.currentTarget;
                    setLightbox(card.photo);
                  }
                }}
              >
                {failedPhotos.has(card.key) ? (
                  <span className={styles.photoFallback} aria-hidden="true">
                    <b>影像暂离轨</b>
                    <small>{card.photo.caption}</small>
                  </span>
                ) : (
                  <img
                    src={card.photo.url}
                    alt=""
                    draggable={false}
                    onError={() => {
                      setFailedPhotos((current) => new Set(current).add(card.key));
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>


      {displayPhotos.length === 0 && (
        <div className={styles.emptyState} role="status">
          <span>NO PHOTOS IN ORBIT</span>
          <strong>星轨还在等待第一张照片</strong>
          <p>可以先浏览普通照片墙，或在后台选择要进入 3D 星空的影像。</p>
          <Link href="/photos?view=static">返回照片墙</Link>
        </div>
      )}

      <div className={styles.hint}>
        {reducedMotion ? "已按系统偏好减少动态效果" : "拖拽旋转 · 滚轮缩放 · 点击照片放大"}
      </div>

      {lightbox && (
        <div
          ref={lightboxRef}
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`照片预览：${lightbox.caption}`}
          tabIndex={-1}
          onClick={closeLightbox}
        >
          <button
            className={styles.close}
            type="button"
            aria-label="关闭照片预览"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
          >
            ×
          </button>

          {displayPhotos.length > 1 && (
            <>
              <button className={`${styles.lightboxNav} ${styles.previous}`} type="button" onClick={(event) => { event.stopPropagation(); showAdjacentPhoto(-1); }} aria-label="上一张照片">‹</button>
              <button className={`${styles.lightboxNav} ${styles.next}`} type="button" onClick={(event) => { event.stopPropagation(); showAdjacentPhoto(1); }} aria-label="下一张照片">›</button>
            </>
          )}

          <div
            className={styles.lightboxStage}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              lightboxTouchStartRef.current = touch
                ? { x: touch.clientX, y: touch.clientY }
                : null;
            }}
            onTouchEnd={(event) => {
              const start = lightboxTouchStartRef.current;
              const touch = event.changedTouches[0];
              lightboxTouchStartRef.current = null;
              if (!start || !touch || displayPhotos.length < 2) return;
              const deltaX = touch.clientX - start.x;
              const deltaY = touch.clientY - start.y;
              if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
              showAdjacentPhoto(deltaX < 0 ? 1 : -1);
            }}
          >
            {failedPhotos.has(lightbox._id) ? (
              <div className={styles.lightboxFallback} role="status">影像暂时无法加载</div>
            ) : (
              <img src={lightbox.url} alt={lightbox.caption} onError={() => setFailedPhotos((current) => new Set(current).add(lightbox._id))} />
            )}
            <div className={styles.caption}>
              <strong>{lightbox.caption}</strong>
              <span>{lightbox.category}</span>
            </div>
          </div>

          <CommentsPanel photoId={lightbox._id} />
        </div>
      )}
    </section>
  );
}
