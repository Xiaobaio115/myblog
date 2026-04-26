"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const displayPhotos = useMemo(() => {
    if (photos.length > 0) return photos;

    return Array.from({ length: 8 }, (_, index) => ({
      _id: `demo-${index}`,
      url: `https://picsum.photos/500/360?random=${index + 1}`,
      caption: "示例照片",
      category: "示例",
    }));
  }, [photos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const carousel = carouselRef.current;

    if (!canvas || !scene || !camera || !carousel) return;

    const activeCanvas = canvas;
    const activeScene = scene;
    const activeCamera = camera;
    const activeCarousel = carousel;

    const ctx = activeCanvas.getContext("2d");
    if (!ctx) return;

    const activeCtx = ctx;

    activeCarousel.innerHTML = "";

    let currentRotY = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let targetRotX = 0;
    let currentZoom = 0;
    let targetZoom = 0;

    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let isHoveringCard = false;

    const photoCount = Math.max(28, displayPhotos.length);
    const radius = 460;

    const loopPhotos = Array.from({ length: photoCount }, (_, index) => {
      return displayPhotos[index % displayPhotos.length];
    });

    loopPhotos.forEach((photo, index) => {
      const img = document.createElement("img");

      img.src = photo.url;
      img.alt = photo.caption;
      img.className = styles.photoCard;

      const angle = (360 / photoCount) * index;
      const randomY = (Math.random() - 0.5) * 430;
      const currentRadius = radius + (Math.random() - 0.5) * 150;

      img.style.transform = `rotateY(${angle}deg) translateZ(${currentRadius}px) translateY(${randomY}px)`;

      img.addEventListener("mouseenter", () => {
        isHoveringCard = true;
      });

      img.addEventListener("mouseleave", () => {
        isHoveringCard = false;
      });

      img.addEventListener("click", (event) => {
        event.stopPropagation();

        if (hasDragged) {
          event.preventDefault();
          return;
        }

        setLightbox(photo);
      });

      carousel.appendChild(img);
    });

    const getPoint = (event: MouseEvent | TouchEvent) => {
      return "touches" in event ? event.touches[0] : event;
    };

    const dragStart = (event: MouseEvent | TouchEvent) => {
      isDragging = true;
      hasDragged = false;

      const point = getPoint(event);

      startX = point.clientX;
      startY = point.clientY;
      lastX = point.clientX;
      lastY = point.clientY;
    };

    const dragMove = (event: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const point = getPoint(event);

      if (
        Math.abs(point.clientX - startX) > 5 ||
        Math.abs(point.clientY - startY) > 5
      ) {
        hasDragged = true;
      }

      targetRotY += (point.clientX - lastX) * 0.35;
      targetRotX -= (point.clientY - lastY) * 0.15;
      targetRotX = Math.max(-20, Math.min(targetRotX, 20));

      lastX = point.clientX;
      lastY = point.clientY;
    };

    const dragEnd = () => {
      isDragging = false;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetZoom += event.deltaY * -1.2;
      targetZoom = Math.max(-600, Math.min(targetZoom, 800));
    };

    activeScene.addEventListener("mousedown", dragStart);
    window.addEventListener("mousemove", dragMove);
    window.addEventListener("mouseup", dragEnd);

    activeScene.addEventListener("touchstart", dragStart, { passive: true });
    window.addEventListener("touchmove", dragMove, { passive: true });
    window.addEventListener("touchend", dragEnd);

    activeScene.addEventListener("wheel", onWheel, { passive: false });

    let width = 0;
    let height = 0;
    let animationId = 0;

    type Particle = {
      x: number;
      y: number;
      size: number;
      alpha: number;
      speed: number;
      type: "star" | "snow";
      char?: string;
      angle: number;
      speedX?: number;
      speedY?: number;
      spinSpeed?: number;
    };

    let particles: Particle[] = [];

    function initCanvas() {
      width = activeCanvas.width = window.innerWidth;
      height = activeCanvas.height = window.innerHeight;
      particles = [];

      const starCount = Math.floor((width * height) / 900);

      for (let i = 0; i < starCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2 + 0.2,
          alpha: Math.random() * 0.5 + 0.15,
          speed: Math.random() * 0.02 + 0.005,
          type: "star",
          angle: Math.random() * Math.PI * 2,
        });
      }

      const snowChars = ["", "", ""];

      for (let i = 0; i < 120; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 10 + 8,
          alpha: Math.random() * 0.35 + 0.25,
          speed: 0,
          type: "snow",
          char: snowChars[Math.floor(Math.random() * snowChars.length)],
          angle: Math.random() * Math.PI * 2,
          speedX: Math.random() * 0.8 + 0.2,
          speedY: Math.random() * 1.2 + 0.5,
          spinSpeed: (Math.random() - 0.5) * 0.04,
        });
      }
    }

    function drawParticles() {
      activeCtx.setTransform(1, 0, 0, 1, 0, 0);
      activeCtx.fillStyle = "rgba(3, 3, 3, 0.72)";
      activeCtx.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        if (particle.type === "snow") {
          particle.x += particle.speedX || 0;
          particle.y += particle.speedY || 0;
          particle.angle += particle.spinSpeed || 0;

          if (particle.x > width + 40 || particle.y > height + 40) {
            particle.x = Math.random() * width;
            particle.y = -30;
          }

          activeCtx.save();
          activeCtx.translate(particle.x, particle.y);
          activeCtx.rotate(particle.angle);
          activeCtx.fillStyle = `rgba(255, 255, 255, ${particle.alpha})`;
          activeCtx.font = `${particle.size}px sans-serif`;
          activeCtx.textAlign = "center";
          activeCtx.textBaseline = "middle";
          activeCtx.shadowBlur = 4;
          activeCtx.shadowColor = "rgba(255, 255, 255, 0.45)";
          activeCtx.fillText(particle.char || "", 0, 0);
          activeCtx.restore();

          return;
        }

        particle.angle += particle.speed;
        const twinkle = particle.alpha + Math.sin(particle.angle) * 0.25;

        activeCtx.beginPath();
        activeCtx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.05, twinkle)})`;
        activeCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        activeCtx.fill();
      });
    }

    function animate() {
      if (!isDragging && !isHoveringCard) {
        targetRotY += 0.12;
      }

      currentRotY += (targetRotY - currentRotY) * 0.08;
      currentRotX += (targetRotX - currentRotX) * 0.08;
      currentZoom += (targetZoom - currentZoom) * 0.08;

      activeCamera.style.transform = `translateZ(${currentZoom}px) rotateX(${currentRotX}deg)`;
      activeCarousel.style.transform = `rotateY(${currentRotY}deg)`;

      drawParticles();

      animationId = requestAnimationFrame(animate);
    }

    initCanvas();
    animate();

    const onResize = () => {
      cancelAnimationFrame(animationId);
      initCanvas();
      animate();
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationId);

      activeScene.removeEventListener("mousedown", dragStart);
      window.removeEventListener("mousemove", dragMove);
      window.removeEventListener("mouseup", dragEnd);

      activeScene.removeEventListener("touchstart", dragStart);
      window.removeEventListener("touchmove", dragMove);
      window.removeEventListener("touchend", dragEnd);

      activeScene.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);

      activeCarousel.innerHTML = "";
    };
  }, [displayPhotos]);

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
                style={{ "--heart-z": `${index * 2 - 4}px` } as React.CSSProperties}
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

          <div ref={carouselRef} className={styles.carousel} />
        </div>
      </div>

      <div className={styles.hint}>
        拖拽旋转  滚轮缩放  点击照片放大
      </div>

      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <button className={styles.close}></button>

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
