"use client";

import Link from "next/link";
import styles from "./AppShell.module.css";

type Page = "dashboard" | "analytics" | "saved" | "settings";

const NAV_ITEMS: { id: Page; label: string; href: string; icon: string }[] = [
  { id: "dashboard", label: "Lead Feed", href: "/dashboard", icon: "⚡" },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: "📊" },
  { id: "saved", label: "Saved", href: "/saved", icon: "🔖" },
  { id: "settings", label: "Settings", href: "/settings", icon: "⚙️" },
];

interface AppShellProps {
  activePage: Page;
  children: React.ReactNode;
}

export function AppShell({ activePage, children }: AppShellProps) {
  return (
    <div className={styles.app}>
      <aside className={styles.rail}>
        <div className={styles.brandMark}>RR</div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`${styles.railIcon} ${activePage === item.id ? styles.active : ""}`}
            title={item.label}
          >
            <span>{item.icon}</span>
            <span className={styles.pop}>{item.label}</span>
          </Link>
        ))}
        <div className={styles.railSpacer} />
      </aside>

      <header className={styles.topnav}>
        <div className={styles.brandWordmark}>
          RedRover <span className={styles.dim}>for X</span>
        </div>
        <nav className={styles.topnavPills}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.navPill} ${activePage === item.id ? styles.active : ""}`}
            >
              {item.label}
              {item.id === "dashboard" && <span className={styles.dotNotif} />}
            </Link>
          ))}
        </nav>
        <div className={styles.topnavRight}>
          <div className={styles.userChip}>
            <div className={styles.avatar}>PL</div>
            <div className={styles.meta}>
              <span className={styles.name}>Pavni L.</span>
              <span className={styles.handle}>Starter plan</span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
