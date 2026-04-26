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
    const count = displayPhotos.length;
    if (count === 0) return [];
    const baseRadius = 450;

    return displayPhotos.map((photo, index) => {
      const angle = (360 / count) * index;
      const seed = index * 137.508;
      const radius = baseRadius + ((seed % 150) - 75);
      const y = ((seed * 3.1) % 450) - 225;

      return {
        key: photo._id,
        photo,
        style: {
          transform: `rotateY(${angle}deg) translateZ(${radius}px) translateY(${y}px)`,
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
    let W = 0, H = 0, parts: Particle[] = [], rafId = 0;
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
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const treeTopY = -180;
      treeBottomY = 250;
      const treeHeight = treeBottomY - treeTopY;
      parts = [];

      // background stars
      const numStars = Math.floor((W * H) / 1000);
      for (let i = 0; i < numStars; i++) {
        parts.push(mkBase("star",
          (Math.random() * 2 - 1) * W,
          (Math.random() * 2 - 1) * H,
          Math.random() * 2 + 0.1,
          Math.random() * 0.4 + 0.1,
          Math.random() * 0.04 + 0.01,
        ));
      }

      // central tree (cone of stars)
      for (let i = 0; i < 2500; i++) {
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
      for (let i = 0; i < 800; i++) {
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
      const ringCfg: Array<{ count: number; rx: number; ry: number; sMin: number; sMax: number; aMin: number; aMax: number; sp: number; mult: number; elev: number; rPow: number; }> = [
        { count: 4000, rx: r1x,        ry: r1y,        sMin: 0.2, sMax: 1.4, aMin: 0.1, aMax: 0.5, sp: 0.02, mult: 0.8,  elev: 0,   rPow: 1.5 },
        { count: 2500, rx: r1x * 0.4,  ry: r1y * 0.4,  sMin: 0.5, sMax: 2.5, aMin: 0.3, aMax: 0.9, sp: 0.03, mult: 2.2,  elev: -30, rPow: 1.2 },
        { count: 1000, rx: r1x * 0.15, ry: r1y * 0.15, sMin: 0.5, sMax: 3.0, aMin: 0.2, aMax: 1.0, sp: 0.04, mult: -3.5, elev: -60, rPow: 0.8 },
      ];
      for (const cfg of ringCfg) {
        for (let i = 0; i < cfg.count; i++) {
          const r = Math.pow(Math.random(), cfg.rPow);
          const p = mkBase("ring", 0, 0,
            Math.random() * (cfg.sMax - cfg.sMin) + cfg.sMin,
            (1 - r) * (Math.random() * (cfg.aMax - cfg.aMin) + cfg.aMin),
            Math.random() * cfg.sp,
          );
          p.radiusX = cfg.rx; p.radiusY = cfg.ry; p.r = r;
          p.speedMult = cfg.mult; p.elevation = cfg.elev;
          p.intrinsicAngle = Math.random() * Math.PI * 2;
          parts.push(p);
        }
      }

      // snowflakes
      for (let i = 0; i < 200; i++) {
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

    const drawParticle = (p: Particle) => {
      if (p.type === "snow") {
        p.x += p.speedX!;
        p.y += p.speedY!;
        p.angle += p.spinSpeed!;
        const boundX = (W / 2) / canvasScale + 100;
        const boundY = (H / 2) / canvasScale + 100;
        if (p.x > boundX || p.y > boundY) {
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
        p.intrinsicAngle! -= 0.001 * p.speedMult!;
        const sync = rotY * (Math.PI / 180);
        const fa = p.intrinsicAngle! + sync;
        p.x = Math.cos(fa) * p.radiusX! * p.r!;
        p.y = treeBottomY + Math.sin(fa) * p.radiusY! * p.r! + p.elevation!;
        p.floatAngle += 0.02;
        p.y -= Math.sin(p.floatAngle) * 2;
        p.angle += p.speed;
        p.alpha = p.baseAlpha + Math.sin(p.angle) * 0.8;
      } else {
        p.angle += p.speed;
        p.alpha = p.baseAlpha + Math.sin(p.angle) * 0.8;
        if (p.type === "tree" || p.type === "core") {
          p.floatAngle += 0.02;
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

    const animate = () => {
      if (!dragging && !hoveringCard) tgtY += 0.12;
      rotY += (tgtY - rotY) * 0.08;
      rotX += (tgtX - rotX) * 0.08;
      zoom += (tgtZoom - zoom) * 0.08;
      canvasScale = 1200 / (1200 - zoom);

      camera.style.transform = `translateZ(${zoom}px) rotateX(${rotX}deg)`;
      carousel.style.transform = `rotateY(${rotY}deg)`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "rgba(3,3,3,0.7)";
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2);
      ctx.scale(canvasScale, canvasScale);
      ctx.translate(0, rotX * 5);

      for (const p of parts) drawParticle(p);

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


      <div className={styles.hint}>拖拽旋转 · 滚轮缩放 · 点击照片放大</div>

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
