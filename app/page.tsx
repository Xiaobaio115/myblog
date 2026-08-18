export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { HomeHeroCarousel } from "@/app/components/home-hero-carousel";
import { SafeImage } from "@/app/components/safe-image";
import { SiteFrame } from "@/app/components/site-frame";
import { getLatestPhotos, getPublishedPosts } from "@/lib/content";
import { getPublicContentCounts } from "@/lib/content";
import { getHomeHeroSetting, getProfileSetting } from "@/lib/settings";
import { getTravelMapData, resolveCoords } from "@/lib/travel-map";
import ChinaTravelMap from "@/app/world/travel-map/ChinaTravelMap";
import styles from "./home-editorial.module.css";

export default async function HomePage() {
  const [posts, photos, profile, contentCounts, homeHero, travelMapData] = await Promise.all([
    getPublishedPosts(4),
    getLatestPhotos(8),
    getProfileSetting(),
    getPublicContentCounts(),
    getHomeHeroSetting(),
    getTravelMapData(),
  ]);

  const latestPosts = posts.slice(0, 4);
  const featuredPhotos = photos
    .flatMap((photo) => {
      const url = String(photo.url || "").trim();
      return url ? [{ ...photo, url }] : [];
    })
    .slice(0, 8);
  const resolvedTravelMap = resolveCoords(travelMapData);
  const travelPlaceCount = Object.values(resolvedTravelMap).reduce(
    (count, province) => count + province.places.length,
    0,
  );
  const stats = [
    { label: "文章", value: contentCounts.posts },
    { label: "照片", value: contentCounts.photos },
    { label: "足迹", value: travelPlaceCount },
  ];

  return (
    <SiteFrame>
      <HomeHeroCarousel
        profile={profile}
        slides={homeHero}
        stats={stats}
      />

      <div className={styles.homeBody}>
        <section id="travel-map" className={styles.mapSection}>
          <div className={`${styles.mapIntro} container`}>
            <div className={styles.sectionHeading}>
              <p className={styles.sectionEyebrow}>01 / TRAVEL ARCHIVE</p>
              <h2>把走过的中国，铺成一张会呼吸的地图</h2>
              <p>拖动地图看见山河，选择一座城，打开留在那里的照片和故事。</p>
            </div>
            <div className={styles.mapAside}>
              <span>{Object.keys(resolvedTravelMap).length} 个省份</span>
              <span>{travelPlaceCount} 处足迹</span>
              <Link href="/world/travel-map">进入完整地图 <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
          <div className={styles.mapStage}>
            <ChinaTravelMap data={resolvedTravelMap} />
          </div>
        </section>

        <section className={`${styles.storySection} container`}>
          <div className={styles.sectionHeadingRow}>
            <div className={styles.sectionHeading}>
              <p className={styles.sectionEyebrow}>02 / WRITING</p>
              <h2>新近落下的文字</h2>
              <p>把来不及说完的想法，写成可以再次抵达的坐标。</p>
            </div>
            <Link href="/articles" className={styles.sectionLink}>查看全部文章 <span aria-hidden="true">↗</span></Link>
          </div>
          {latestPosts.length > 0 ? (
            <div className={styles.storyGrid}>
              {latestPosts.slice(0, 1).map((post) => (
                <article key={post._id} className={styles.storyLead}>
                  <Link href={`/posts/${post.slug}`} className={styles.storyMedia}>
                    <SafeImage src={post.coverUrl} alt={post.title} fallback="文字正在显影" className={styles.storyImage} imageClassName={styles.storyImageElement} loading="eager" />
                  </Link>
                  <div className={styles.storyMeta}><span>{post.date || "刚刚"}</span><span>{(post.tags || []).slice(0, 2).join(" / ") || "记录"}</span></div>
                  <h3><Link href={`/posts/${post.slug}`}>{post.title}</Link></h3>
                  <p>{post.excerpt || "一篇尚未写下摘要的记录。"}</p>
                </article>
              ))}
              <div className={styles.storyList}>
                {latestPosts.slice(1, 4).map((post, index) => (
                  <article key={post._id} className={styles.storyListItem}>
                    <span className={styles.storyNumber}>0{index + 2}</span>
                    <div><div className={styles.storyMeta}><span>{post.date || "刚刚"}</span></div><h3><Link href={`/posts/${post.slug}`}>{post.title}</Link></h3><p>{post.excerpt || "一篇尚未写下摘要的记录。"}</p></div>
                    <span className={styles.indexArrow} aria-hidden="true">↗</span>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.emptyStory}><span className={styles.emptyMark}>✎</span><h3>还没有发布文章</h3><p>第一篇思考碎片很快就会出现。也可以先去我的世界逛逛。</p><Link href="/world" className={styles.sectionLink}>先去看看我的世界 <span aria-hidden="true">↗</span></Link></div>
          )}
        </section>

        <section className={`${styles.memorySection} container`}>
          <div className={styles.sectionHeadingRow}>
            <div className={styles.sectionHeading}><p className={styles.sectionEyebrow}>03 / MEMORY</p><h2>被光留下的片刻</h2><p>有些瞬间不必解释，只需要被好好收藏。</p></div>
            <div className={styles.memoryLinks}><Link href="/photos">普通相册 ↗</Link><Link href="/photos/3d">3D 星空墙 ↗</Link></div>
          </div>
          {featuredPhotos.length > 0 ? (
            <div className={styles.memoryGrid}>{featuredPhotos.slice(0, 5).map((photo, index) => <Link href={photo.sourceHref || "/photos"} key={photo._id} className={`${styles.memoryItem} ${styles[`memoryItem${index + 1}`]}`}><SafeImage src={photo.url} alt={photo.caption || "精选瞬间"} fallback={photo.caption || "精选瞬间"} className={styles.memoryImage} imageClassName={styles.memoryImageElement} loading="lazy" /><span>{photo.caption || "精选瞬间"}</span></Link>)}</div>
          ) : (
            <div className={styles.memoryFallback}><Image src="/poetic-images/hero-photos.jpg" alt="被光留下的生活片段" fill sizes="100vw" /><span className={styles.visualShade} aria-hidden="true" /><p>相册正在等待下一束光。</p></div>
          )}
        </section>

      </div>
    </SiteFrame>
  );
}
