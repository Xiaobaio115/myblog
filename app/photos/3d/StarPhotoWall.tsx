/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./StarPhotoWall.module.css";

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
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const displayPhotos = useMemo(() => {
    if (photos.length > 0) {
      return photos;
    }

    return Array.from({ length: 8 }, (_, index) => ({
      _id: `demo-${index}`,
      url: `https://picsum.photos/500/360?random=${index + 1}`,
      caption: "示例照片",
      category: "示例",
    }));
  }, [photos]);

  const cards = useMemo(() => {
    const count = Math.max(16, Math.min(28, displayPhotos.length * 2));

    return Array.from({ length: count }, (_, index) => {
      const photo = displayPhotos[index % displayPhotos.length];
      const angle = (360 / count) * index;
      const radius = 320 + ((index * 37) % 120);
      const y = ((index * 53) % 180) - 90;
      const tilt = ((index * 29) % 12) - 6;

      return {
        key: `${photo._id}-${index}`,
        photo,
        style: {
          transform: `rotateY(${angle}deg) translateZ(${radius}px) translateY(${y}px) rotateZ(${tilt}deg)`,
        } as CSSProperties,
      };
    });
  }, [displayPhotos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const carousel = carouselRef.current;
    if (!canvas || !scene || !camera || !carousel) return;

    const ctx = canvas.getContext("2d")!;

    // ── rotation state ──
    let rotY = 0, tgtY = 0, rotX = 0, tgtX = 0, zoom = 0, tgtZoom = 0;
    let dragging = false, sx = 0, sy = 0, lx = 0, ly = 0;
    let hoveringCard = false;

    const onDown = (e: MouseEvent | TouchEvent) => {
      dragging = true;
      hasDraggedRef.current = false;
      const p = "touches" in e ? e.touches[0] : e;
      sx = lx = p.clientX; sy = ly = p.clientY;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return;
      const p = "touches" in e ? e.touches[0] : e;
      if (Math.abs(p.clientX - sx) > 5 || Math.abs(p.clientY - sy) > 5)
        hasDraggedRef.current = true;
      tgtY += (p.clientX - lx) * 0.35;
      tgtX -= (p.clientY - ly) * 0.15;
      tgtX = Math.max(-20, Math.min(tgtX, 20));
      lx = p.clientX; ly = p.clientY;
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      tgtZoom += e.deltaY * -1.2;
      tgtZoom = Math.max(-600, Math.min(tgtZoom, 800));
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

    // ── canvas particles ──
    type Particle = { x: number; y: number; size: number; alpha: number; angle: number; speed: number; };
    let W = 0, H = 0, parts: Particle[] = [], rafId = 0;

    const initCanvas = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      parts = [];
      const n = Math.max(120, Math.floor((W * H) / 9000));
      for (let i = 0; i < n; i++)
        parts.push({ x: Math.random()*W, y: Math.random()*H,
          size: Math.random()*1.8+0.3, alpha: Math.random()*0.5+0.12,
          angle: Math.random()*Math.PI*2, speed: Math.random()*0.025+0.005 });
    };

    const animate = () => {
      // auto-rotate unless user is interacting
      if (!dragging && !hoveringCard) tgtY += 0.12;
      rotY += (tgtY - rotY) * 0.08;
      rotX += (tgtX - rotX) * 0.08;
      zoom += (tgtZoom - zoom) * 0.08;

      camera.style.transform = `translateZ(${zoom}px) rotateX(${rotX}deg)`;
      carousel.style.transform = `rotateY(${rotY}deg)`;

      // draw stars
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "rgba(3,3,3,0.72)";
      ctx.fillRect(0, 0, W, H);
      for (const p of parts) {
        p.angle += p.speed;
        const tw = p.alpha + Math.sin(p.angle) * 0.22;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0.05, tw)})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(animate);
    };

    initCanvas();
    animate();

    const onResize = () => { cancelAnimationFrame(rafId); initCanvas(); animate(); };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
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
    };
  }, []);

  return (
    <section className={styles.wall}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <div ref={sceneRef} className={styles.scene}>
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

        <div ref={cameraRef} className={styles.camera}>
          <div ref={carouselRef} className={styles.carousel}>
            {cards.map((card) => (
              <img
                key={card.key}
                src={card.photo.url}
                alt={card.photo.caption}
                className={styles.photoCard}
                style={card.style}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasDraggedRef.current) setLightbox(card.photo);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.hint}>自动旋转 · 点击照片放大</div>

      <div className={styles.debugStrip}>
        {displayPhotos.slice(0, 10).map((photo) => (
          <button
            key={photo._id}
            className={styles.debugThumb}
            onClick={() => setLightbox(photo)}
            type="button"
          >
            <img src={photo.url} alt={photo.caption} />
            <span>{photo.caption}</span>
          </button>
        ))}
      </div>

      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <button className={styles.close} type="button">
            ×
          </button>

          <img src={lightbox.url} alt={lightbox.caption} />

          <div className={styles.caption}>
            <strong>{lightbox.caption}</strong>
            <span>{lightbox.category}</span>
          </div>
        </div>
      )}
    </section>
  );
}
