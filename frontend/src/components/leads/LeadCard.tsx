import type { Lead } from "@/lib/types";
import styles from "./LeadCard.module.css";

interface Props {
  lead: Lead;
  selected: boolean;
  onClick: () => void;
}

export function LeadCard({ lead, selected, onClick }: Props) {
  const scoreColorClass = lead.scoreTier === "hi" ? styles.scoreHi : lead.scoreTier === "md" ? styles.scoreMd : styles.scoreLo;

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ""}`}
      onClick={onClick}
    >
      <div className={styles.topRow}>
        <div
          className={styles.avatar}
          style={{ background: `linear-gradient(135deg, oklch(0.7 0.12 ${lead.avatarHue}), oklch(0.5 0.14 ${lead.avatarHue + 20}))` }}
        >
          {lead.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </div>
        <span className={styles.name}>{lead.name}</span>
        <span className={styles.handle}>@{lead.handle}</span>
        <span className={styles.followers}>{lead.followers}</span>
        <span className={styles.time}>{lead.time}</span>
      </div>
      <div className={styles.excerpt}>{lead.post.split("\n")[0]}</div>
      <div className={styles.bottomRow}>
        <span className={styles.keyword}>{lead.primaryKeyword}</span>
        <span className={`${styles.score} ${scoreColorClass}`}>
          {lead.score}<span className={styles.slash}>/10</span>
        </span>
        <div className={styles.actions}>
          <button onClick={(e) => e.stopPropagation()} title="Reply">↩</button>
          <button onClick={(e) => e.stopPropagation()} title="Save">🔖</button>
          <button onClick={(e) => e.stopPropagation()} title="Dismiss">✕</button>
        </div>
      </div>
    </div>
  );
}
