import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./poetic-page-hero.module.css";

const BACKGROUNDS = {
  articles: "/poetic-images/hero-articles.jpg",
  world: "/poetic-images/hero-world.jpg",
  photos: "/poetic-images/hero-photos.jpg",
  hometown: "/poetic-images/world-hometown.jpg",
  school: "/poetic-images/world-school.jpg",
  travel: "/poetic-images/world-travel.jpg",
  games: "/poetic-images/world-games.jpg",
} as const;

type PoeticPageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  background: keyof typeof BACKGROUNDS;
  children?: ReactNode;
};

export function PoeticPageHero({
  eyebrow,
  title,
  description,
  background,
  children,
}: PoeticPageHeroProps) {
  return (
    <section className={styles.hero}>
      <Image
        className={styles.image}
        src={BACKGROUNDS[background]}
        alt=""
        fill
        sizes="100vw"
        preload
      />
      <div className={styles.shade} aria-hidden="true" />
      <div className={`container ${styles.inner}`}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
        {children ? <div className={styles.actions}>{children}</div> : null}
      </div>
    </section>
  );
}
