import Link from "next/link";
import { SignOut } from "./account";
import { Brand } from "./brand";
import { Icon, type IconName } from "./icons";

/* Only screens backed by real data. Crew, shop and profile return here when they
   stop being fixtures, so nothing in the nav makes a claim about a real person. */
const navigation: ReadonlyArray<{ href: string; label: string; icon: IconName }> = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/path", label: "Path", icon: "path" },
];

export function AppShell({
  current,
  children,
  aside,
}: {
  current: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="side-nav">
        <Brand />
        <nav aria-label="Main">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current === item.label ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <Link className="d new-mission" href="/generate">
          + New mission
        </Link>
        <SignOut className="flow-secondary side-sign-out" />
      </aside>

      <main className="app-main">
        <div className="page-column">{children}</div>
      </main>

      {aside && <aside className="status-aside">{aside}</aside>}

      <nav className="mobile-nav" aria-label="Main">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current === item.label ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        <Link href="/generate">
          <Icon name="plus" />
          <span>New mission</span>
        </Link>
        <SignOut className="mobile-sign-out" />
      </nav>
    </div>
  );
}
