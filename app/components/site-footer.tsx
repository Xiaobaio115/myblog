import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">LQPP World</span>
          <p className="footer-tagline">
            生活、技术、旅行与游戏构成的个人宇宙。
          </p>
        </div>

        <div className="footer-nav-cols">
          <div className="footer-col">
            <strong>快捷导航</strong>
            <Link href="/">首页</Link>
            <Link href="/articles">文章</Link>
            <Link href="/photos">相册</Link>
            <Link href="/world">我的世界</Link>
            <Link href="/about">关于我</Link>
            <Link href="/guestbook">留言</Link>
          </div>
          <div className="footer-col">
            <strong>更多</strong>
            <Link href="/photos/3d">3D 星空相册</Link>
            <Link href="/projects">项目</Link>
            <Link href="/articles">思考碎片</Link>
            <Link href="/admin">后台入口</Link>
          </div>
          <div className="footer-col">
            <strong>联系</strong>
            <span>Email</span>
            <span>GitHub</span>
            <span>微博</span>
          </div>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>© {new Date().getFullYear()} LQPP World. Built with curiosity and code.</p>
      </div>
    </footer>
  );
}
