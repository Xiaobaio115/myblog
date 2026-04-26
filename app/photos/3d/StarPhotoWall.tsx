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

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    type Particle = {
      x: number;
      y: number;
      size: number;
      alpha: number;
      angle: number;
      speed: number;
    };

    let width = 0;
    let height = 0;
    let animationId = 0;
    let particles: Particle[] = [];

    const initCanvas = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      particles = [];

      const count = Math.max(120, Math.floor((width * height) / 9000));

      for (let i = 0; i < count; i += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.8 + 0.3,
          alpha: Math.random() * 0.5 + 0.12,
          angle: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.025 + 0.005,
        });
      }
    };

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "rgba(3, 3, 3, 0.92)";
      ctx.fillRect(0, 0, width, height);

      for (const particle of particles) {
        particle.angle += particle.speed;
        const twinkle = particle.alpha + Math.sin(particle.angle) * 0.22;

        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0.05, twinkle)})`;
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    initCanvas();
    draw();

    const onResize = () => {
      cancelAnimationFrame(animationId);
      initCanvas();
      draw();
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section className={styles.wall}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <div className={styles.scene}>
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

        <div className={styles.camera}>
          <div className={styles.carousel}>
            {cards.map((card) => (
              <img
                key={card.key}
                src={card.photo.url}
                alt={card.photo.caption}
                className={styles.photoCard}
                style={card.style}
                onClick={() => setLightbox(card.photo)}
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
