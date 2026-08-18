import Link from "next/link";
import { PhotoGallery } from "./photo-gallery";
import { SafeImage } from "./safe-image";
import type { Photo } from "@/lib/content";
import styles from "./photos-view-switcher.module.css";

interface Props {
  photos: Photo[];
  categories: string[];
}

const PREVIEW_COUNT = 5;

export function PhotosViewSwitcher({ photos, categories }: Props) {
  const orderedPhotos = [...photos].sort((left, right) => {
    const leftHasImage = Boolean(left.url?.trim());
    const rightHasImage = Boolean(right.url?.trim());
    return Number(rightHasImage) - Number(leftHasImage);
  });
  const realPhotos = orderedPhotos.filter((photo) => photo.url?.trim());
  const selected3d = realPhotos.filter((photo) => photo.showIn3d);
  const hasExplicitSelection = realPhotos.some((photo) => photo.showIn3d !== undefined);
  const preview3d = selected3d.length > 0 || hasExplicitSelection
    ? selected3d.slice(0, PREVIEW_COUNT)
    : realPhotos.slice(0, PREVIEW_COUNT);
  const bg3d = preview3d[0]?.url ?? null;

  return (
    <div className={styles.layout}>
      <section className={styles.archive} aria-labelledby="photo-archive-title">
        <h2 id="photo-archive-title" className={styles.srOnly}>照片档案</h2>
        <PhotoGallery photos={orderedPhotos} categories={categories} />
      </section>
      <Link href="/photos/3d" className={styles.portal}>
        {bg3d ? <SafeImage src={bg3d} alt="3D 星空相册入口" className={styles.portalMedia} imageClassName={styles.portalImage} /> : <span className={styles.portalFallback} />}
        <span className={styles.portalShade} />
        <div className={styles.portalBody}>
          <div className={styles.portalCopy}>
            <span className={styles.portalIndex}>Immersive / 3D</span>
            <h2>让照片悬浮在星空里</h2>
            <p>这是独立的沉浸式入口。拖动、旋转，在记忆之间自由漫游。</p>
            <span className={styles.portalCta}>进入星空相册 <span aria-hidden>↗</span></span>
          </div>
          {preview3d.length > 0 && (
            <div className={styles.thumbs} aria-hidden="true">
              {preview3d.map((photo) => (
                <SafeImage key={photo._id} src={photo.url} alt="" className={styles.thumb} />
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
