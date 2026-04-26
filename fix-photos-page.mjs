import { writeFileSync } from 'fs';

const content = `export const dynamic = "force-dynamic";

import Link from "next/link";
import { PhotosViewSwitcher } from "@/app/components/photos-view-switcher";
import { SiteFrame } from "@/app/components/site-frame";
import { getLatestPhotos, getPhotoCategories } from "@/lib/content";

export default async function PhotosPage() {
  const photos = await getLatestPhotos(48);
  const categories = getPhotoCategories(photos);

  return (
    <SiteFrame>
      <section className="hero container">
        <p className="eyebrow">PHOTO GALLERY</p>
        <h1 className="hero-title">把生活片段放进一个可以浏览的画廊。</h1>
        <p className="hero-copy">
          在这里欣赏精选相册内容，切换视图体验不同的浏览方式。
        </p>
        <div className="hero-actions">
          <Link href="/articles" className="secondary-link">
            查看文章
          </Link>
        </div>
      </section>

      <section className="container section">
        <PhotosViewSwitcher photos={photos} categories={categories} />
      </section>
    </SiteFrame>
  );
}
`;

writeFileSync('app/photos/page.tsx', content, 'utf8');
console.log('✅ app/photos/page.tsx updated');
