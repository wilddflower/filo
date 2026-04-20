"use client";

import type { Lead, LeadFilters } from "@/lib/types";
import { LeadCard } from "./LeadCard";
import styles from "./LeadListPanel.module.css";

interface Props {
  leads: Lead[];
  selectedId: string;
  onSelect: (id: string) => void;
  filters: LeadFilters;
  setFilters: (f: LeadFilters) => void;
}

const SCORE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "7–10", value: "hi" },
  { label: "5–6", value: "md" },
  { label: "1–4", value: "lo" },
] as const;

const FOLLOWER_OPTIONS = [
  { value: "any", label: "Any followers" },
  { value: "1k", label: "1K+" },
  { value: "10k", label: "10K+" },
] as const;

export function LeadListPanel({ leads, selectedId, onSelect, filters, setFilters }: Props) {
  return (
    <div className={styles.col}>
      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.segmented}>
            {SCORE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.seg} ${filters.score === opt.value ? styles.active : ""}`}
                onClick={() => setFilters({ ...filters, score: opt.value as LeadFilters["score"] })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            className={styles.dropdown}
            value={filters.followers}
            onChange={(e) => setFilters({ ...filters, followers: e.target.value as LeadFilters["followers"] })}
          >
            {FOLLOWER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterMeta}>
          <span>{leads.length} leads match your filters</span>
          <span className={styles.live}>
            <span className={styles.liveDot} /> Live · updated 2m ago
          </span>
        </div>
      </div>

      <div className={styles.list}>
        {leads.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            selected={selectedId === l.id}
            onClick={() => onSelect(l.id)}
          />
        ))}
        {leads.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No leads match your filters</div>
            <div className={styles.emptySub}>Try adjusting your score filter or time range</div>
          </div>
        )}
      </div>
    </div>
  );
}
