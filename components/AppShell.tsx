"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

type Item = { href: string; label: string; soon?: boolean };

const CHANNELS: Item[] = [
  { href: "/shorts", label: "쇼츠 메이커" },
  { href: "/instagram", label: "인스타그램" },
  { href: "/threads", label: "스레드" },
  { href: "/facebook", label: "페이스북", soon: true },
];

function isActive(path: string, item: Item) {
  return path === item.href || path.startsWith(`${item.href}/`);
}

function Group({ title, links }: { title: string; links: Item[] }) {
  const path = usePathname();
  return (
    <div className="nav-group">
      <div className="nav-group-title">{title}</div>
      {links.map((link) =>
        link.soon ? (
          <span key={link.href} className="nav-link soon">
            {link.label}
          </span>
        ) : (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link${isActive(path, link) ? " active" : ""}`}
          >
            {link.label}
          </Link>
        ),
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={40} />
          <div className="brand-text">
            <strong>컨텐츠데스크</strong>
            <span>Marketing Studio</span>
          </div>
        </div>

        <nav className="nav-list">
          <Group title="채널" links={CHANNELS} />
          <Group title="설정" links={[{ href: "/settings", label: "설정" }]} />
        </nav>

        <div className="sidebar-cta">
          <Link className="btn primary" href="/shorts">
            + 쇼츠 만들기
          </Link>
        </div>

        <div className="sidebar-footer">
          <div style={{ marginBottom: 8 }}>
            혼자 쓰는 로컬 데스크
            <div style={{ marginTop: 6 }}>
              <span className="mode-pill">로컬 저장</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
