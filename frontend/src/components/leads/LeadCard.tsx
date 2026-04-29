"use client";

import type { Lead } from "@/lib/types";
import type React from "react";
import styles from "./LeadCard.module.css";

interface Props {
  lead: Lead;
  selected: boolean;
  onClick: () => void;
}

const PLATFORM_ICONS: Record<string, React.ReactElement> = {
  x: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  facebook: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  ),
  reddit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  ),
};

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
            <span className={styles.xIcon}>{PLATFORM_ICONS[lead.platform] ?? PLATFORM_ICONS.x}</span>
          </div>
          <span className={styles.handle}>
            {lead.platform === "facebook" || lead.platform === "reddit"
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
