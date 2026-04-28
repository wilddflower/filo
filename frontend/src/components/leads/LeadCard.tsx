"use client";

import type { Lead } from "@/lib/types";
import styles from "./LeadCard.module.css";

interface Props {
  lead: Lead;
  selected: boolean;
  onClick: () => void;
}

const PLATFORM_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const HEART_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const RETWEET_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);

const REPLY_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function LeadCard({ lead, selected, onClick }: Props) {
  const initials = lead.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const scoreClass = lead.scoreTier === "hi" ? styles.scoreHi : lead.scoreTier === "md" ? styles.scoreMd : styles.scoreLo;

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ""}`}
      onClick={onClick}
    >
      {/* Header: avatar + identity on left, category + score on right */}
      <div className={styles.header}>
        <div
          className={styles.avatar}
          style={{
            background: `linear-gradient(135deg, oklch(0.72 0.13 ${lead.avatarHue}), oklch(0.48 0.15 ${lead.avatarHue + 30}))`,
          }}
        >
          {initials}
        </div>
        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{lead.name}</span>
            <span className={styles.xIcon}>{PLATFORM_ICON}</span>
          </div>
          <span className={styles.handle}>
            {lead.platform === "facebook"
              ? (lead.groupName ?? `@${lead.handle}`)
              : `@${lead.handle}`}
            <span className={styles.timeSep}>·</span>
            {lead.time}
          </span>
        </div>
        <div className={styles.badges}>
          <span className={styles.category}>{lead.primaryKeyword}</span>
          <div className={`${styles.score} ${scoreClass}`}>
            <span className={styles.scoreNum}>{lead.score}</span>
            <span className={styles.scoreMax}>/10</span>
          </div>
        </div>
      </div>

      {/* Tweet body */}
      <p className={styles.text}>{lead.post}</p>

      {/* Footer: engagement stats + reply CTA */}
      <div className={styles.footer}>
        <div className={styles.stats}>
          <span className={styles.stat}>
            {HEART_ICON}
            {fmt(lead.hearts)}
          </span>
          <span className={styles.stat}>
            {RETWEET_ICON}
            {fmt(lead.reposts)}
          </span>
          <span className={styles.stat}>
            {REPLY_ICON}
            {fmt(lead.replies)}
          </span>
        </div>
        <button
          className={styles.replyBtn}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          Reply →
        </button>
      </div>
    </div>
  );
}
