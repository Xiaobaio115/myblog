export const dynamic = "force-dynamic";

import Link from "next/link";
import { PhotoCard } from "@/app/components/photo-card";
import { SiteFrame } from "@/app/components/site-frame";
import { getLatestPhotos } from "@/lib/content";

export default async function PhotosPage() {
  const photos = await getLatestPhotos(24);

  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">相册页</p>
        <h1 className="hero-title">把生活片段单独放进一个可浏览的画廊。</h1>
        <p className="hero-copy">
          模板里的相册页不再只是一个空链接。这里优先显示已上传照片，没有数据时会回退到文章封面或示例卡片。
        </p>
        <div className="hero-actions">
          <Link href="/admin/photos" className="primary-link">
            上传照片
          </Link>
          <Link href="/" className="secondary-link">
            返回首页
          </Link>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <h2 className="section-title">最近照片</h2>
            <p className="section-copy">支持独立相册页展示，不再和首页挤在一起。</p>
          </div>
        </div>

        <div className="photo-grid">
          {photos.map((photo) => (
            <PhotoCard key={photo._id} photo={photo} />
          ))}
        </div>
      </section>
    </SiteFrame>
  );
}
