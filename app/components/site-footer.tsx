import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">Luna Notes</span>
          <p className="footer-tagline">
            记录生活与思考，珍藏每一个美好瞬间。
          </p>
        </div>

        <div className="footer-nav-cols">
          <div className="footer-col">
            <strong>快捷导航</strong>
            <Link href="/">首页</Link>
            <Link href="/articles">文章</Link>
            <Link href="/photos">相册</Link>
            <Link href="/admin">后台</Link>
          </div>
          <div className="footer-col">
            <strong>更多</strong>
            <Link href="/articles">归档</Link>
            <Link href="/articles">标签</Link>
            <Link href="/photos">相册</Link>
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
        <p>© {new Date().getFullYear()} Luna Notes. All rights reserved.</p>
      </div>
    </footer>
  );
}
