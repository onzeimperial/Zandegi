import Link from "next/link";
import { Brand } from "./brand";
import { Icon, type IconName } from "./icons";

const navigation: ReadonlyArray<{ href: string; label: string; icon: IconName }> = [
  { href: "/path", label: "Path", icon: "path" },
  { href: "/crew", label: "Crew", icon: "crew" },
  { href: "/shop", label: "Shop", icon: "shop" },
  { href: "/profile", label: "Me", icon: "me" },
];

export function AppShell({ current, children, aside }: { current: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="side-nav">
        <Brand />
        <nav aria-label="Main">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={current === item.label ? "page" : undefined}>
              <Icon name={item.icon} /><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <Link className="d new-mission" href="/generate">+ New mission</Link>
      </aside>

      <main className="app-main">
        <div className="page-column">{children}</div>
      </main>

      {aside && <aside className="status-aside">{aside}</aside>}

      <nav className="mobile-nav" aria-label="Main">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href} aria-current={current === item.label ? "page" : undefined}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
