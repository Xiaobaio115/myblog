import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="site-footer pink-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-logo pink-brand">
            <span className="pink-brand-mark" aria-hidden="true">
              <Image src="/brand-mark.png" alt="" width={36} height={36} />
            </span>
            <span>LQPP World</span>
          </span>
          <p className="footer-tagline">
            在代码、远方与星光之间，收藏缓慢发亮的日子。
          </p>
        </div>

        <div className="footer-nav-cols">
          <div className="footer-col">
            <strong>快速导航</strong>
            <Link href="/">首页</Link>
            <Link href="/articles">文章</Link>
            <Link href="/series">系列</Link>
            <Link href="/photos">相册</Link>
            <Link href="/world">我的世界</Link>
            <Link href="/about">关于我</Link>
            <Link href="/guestbook">留言</Link>
          </div>
          <div className="footer-col">
            <strong>更多入口</strong>
            <Link href="/photos/3d">3D 星空相册</Link>
            <Link href="/world/travel-map">旅行地图</Link>
            <Link href="/projects">项目</Link>
            <Link href="/guestbook">留言板</Link>
          </div>
          <div className="footer-col">
            <strong>后台</strong>
            <Link href="/admin">管理入口</Link>
            <span className="footer-note">不在主导航公开</span>
          </div>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>© {new Date().getFullYear()} LQPP World · 写给时间，也写给远方。</p>
      </div>
    </footer>
  );
}
