"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./AppShell.module.css";

type Page = "dashboard" | "analytics" | "saved" | "settings";

interface NavItem {
  id: Page;
  label: string;
  href: string;
  count?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "analytics", label: "Dashboard", href: "/analytics" },
  { id: "dashboard", label: "Leads",     href: "/dashboard" },
  { id: "saved",     label: "Saved",     href: "/saved" },
  { id: "settings",  label: "Settings",  href: "/settings" },
];

/* SVG icons matching the design */
function IcoChart() {
  return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 20h18M6 16V9M11 16V5M16 16v-7M21 16v-3"/></svg>;
}
function IcoInbox() {
  return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5 4h14l3 8v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/></svg>;
}
function IcoBookmark() {
  return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>;
}
function IcoSettings() {
  return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.1 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
}
function IcoLogout() {
  return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
}

const ICONS: Record<Page, () => React.ReactElement> = {
  analytics: IcoChart,
  dashboard: IcoInbox,
  saved:     IcoBookmark,
  settings:  IcoSettings,
};

interface AppShellProps {
  activePage: Page;
  children: React.ReactNode;
  leadCount?: number;
  savedCount?: number;
}

export function AppShell({ activePage, children, leadCount, savedCount }: AppShellProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("You");
  const [userCompany, setUserCompany] = useState("Starter plan");
  const [initials, setInitials] = useState("?");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("founderProfile");
      if (raw) {
        const p = JSON.parse(raw);
        const name: string = p.name || p.company || "";
        const company: string = p.company || "Starter plan";
        setUserName(name || company);
        setUserCompany(company);
        const parts = name.trim().split(" ").filter(Boolean);
        setInitials(parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0]?.[0] ?? company[0] ?? "?"));
      }
    } catch {}
  }, []);

  function handleLogout() {
    router.push("/login");
  }

  const counts: Partial<Record<Page, number>> = {
    dashboard: leadCount,
    saved: savedCount,
  };

  return (
    <div className={styles.app}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.brand}>
          filo<span className={styles.dot} />
        </Link>

        <div className={styles.section}>Workspace</div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const Ico = ICONS[item.id];
            const count = counts[item.id];
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`${styles.navItem} ${activePage === item.id ? styles.active : ""}`}
              >
                <Ico />
                {item.label}
                {mounted && count != null && count > 0 && (
                  <span className={styles.navCount}>{count}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className={styles.userFooter}>
          <div className={styles.userRow}>
            <div className={styles.avatar}>{initials.toUpperCase()}</div>
            <div className={styles.userMeta}>
              <div className={styles.userName}>{userName}</div>
              <div className={styles.userPlan}>{userCompany}</div>
            </div>
            <span className={styles.badge}>PRO</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <IcoLogout />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={styles.main}>{children}</div>
    </div>
  );
}
