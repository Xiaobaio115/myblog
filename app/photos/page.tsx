export const dynamic = "force-dynamic";

import Link from "next/link";
import { SiteFrame } from "@/app/components/site-frame";
import { getLatestPhotos, getPhotoCategories } from "@/lib/content";
import { PhotosGalleryClient } from "./PhotosGalleryClient";
import styles from "./photos-page.module.css";

export default async function PhotosPage() {
  const photos = await getLatestPhotos(48);
  const categories = getPhotoCategories(photos);

  return (
    <SiteFrame>
      <header className={styles.intro}>
        <div className={styles.introTopline}>
          <span>Memory atlas</span>
          <span className={styles.introRule} aria-hidden="true" />
          <span>{photos.length.toString().padStart(2, "0")} frames</span>
        </div>
        <div className={styles.introCopy}>
          <h1>被光留下的日子</h1>
          <p>日常的微光、远行的风景，还有不愿从相机里删掉的瞬间。</p>
        </div>
        <div className={styles.introAside}>
          <span className={styles.introIndex}>01 / Archive</span>
          <p>按地点与年份翻阅一份不完整的私人影像档案。</p>
        </div>
      </header>
      <div>
        {photos.length > 0 ? (
          <PhotosGalleryClient photos={photos} categories={categories} />
        ) : (
          <div className={styles.empty}>
            <span aria-hidden>✦</span>
            <h2>相册还在慢慢积累</h2>
            <p>等下一段光影被收藏，再回来看看。</p>
            <Link href="/photos/3d" className={styles.emptyLink}>
              打开 3D 星空相册
            </Link>
          </div>
        )}
      </div>
    </SiteFrame>
  );
}
