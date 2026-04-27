import type { ReactNode } from "react";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";
import { getProfileSetting } from "@/lib/settings";
import { getPublishedPosts, getLatestPhotos } from "@/lib/content";

export async function SiteFrame({ children }: { children: ReactNode }) {
  const [profile, posts, photos] = await Promise.all([
    getProfileSetting(),
    getPublishedPosts(100),
    getLatestPhotos(999),
  ]);

  return (
    <main className="site-shell">
      <SiteHeader
        profileName={profile.name}
        profileTagline={profile.tagline}
        profileAvatarUrl={profile.avatarUrl}
        profileLocation={profile.location}
        postCount={posts.length}
        photoCount={photos.length}
      />
      {children}
      <SiteFooter />
    </main>
  );
}
