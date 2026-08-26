import type { ReactNode } from "react";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";
import { getProfileSetting, getNavSetting } from "@/lib/settings";
import { visibleNavItems } from "@/lib/nav-items";
import { getPublishedPosts, getLatestPhotos } from "@/lib/content";

export async function SiteFrame({ children }: { children: ReactNode }) {
  const [profile, nav, posts, photos] = await Promise.all([
    getProfileSetting(),
    getNavSetting(),
    getPublishedPosts(100),
    getLatestPhotos(999),
  ]);

  return (
    <main className="site-shell">
      <SiteHeader
        navItems={visibleNavItems(nav)}
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
