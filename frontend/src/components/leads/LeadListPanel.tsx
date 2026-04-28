"use client";

import { useState } from "react";
import type { Lead, LeadFilters } from "@/lib/types";
import { LeadCard } from "./LeadCard";
import styles from "./LeadListPanel.module.css";

interface Props {
  leads: Lead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: LeadFilters;
  setFilters: (f: LeadFilters) => void;
}

const SCORE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Hot 🔥", value: "hi" },
  { label: "Warm", value: "md" },
  { label: "Low", value: "lo" },
] as const;

const PLATFORM_OPTIONS = [
  { label: "All", value: "all" },
  { label: "𝕏", value: "x" },
  { label: "Facebook", value: "facebook" },
] as const;

function extractCompetitor(lead: Lead): string | null {
  return lead.matched.find((kw) => /^[A-Z]/.test(kw)) ?? null;
}

export function LeadListPanel({ leads, selectedId, onSelect, filters, setFilters }: Props) {
  const [grouped, setGrouped] = useState(false);

  const clusters = grouped
    ? leads.reduce<Map<string, Lead[]>>((map, lead) => {
        const key = extractCompetitor(lead) ?? "Other";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(lead);
        return map;
      }, new Map())
    : null;

  const renderCard = (l: Lead, index: number) => (
    <LeadCard key={l.id} lead={l} selected={selectedId === l.id} onClick={() => onSelect(l.id)} />
  );

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
          <div className={styles.segmented}>
            {PLATFORM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.seg} ${filters.platform === opt.value ? styles.active : ""}`}
                onClick={() => setFilters({ ...filters, platform: opt.value as LeadFilters["platform"] })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            className={`${styles.groupToggle} ${grouped ? styles.groupToggleActive : ""}`}
            onClick={() => setGrouped((g) => !g)}
            title="Group by competitor"
          >
            {grouped ? "Grouped ✓" : "Group"}
          </button>
          <span className={styles.count}>{leads.length} signals</span>
        </div>
      </div>

      <div className={styles.list}>
        {leads.length === 0 && (
          <div className={styles.empty}>No leads match this filter</div>
        )}

        {!grouped && leads.map((l, i) => renderCard(l, i))}

        {grouped && clusters && Array.from(clusters.entries()).map(([competitor, group]) => (
          <div key={competitor}>
            <div className={styles.clusterHead}>
              {competitor === "Other" ? "Other" : `Switching from ${competitor}`}
              <span className={styles.clusterCount}>{group.length}</span>
            </div>
            {group.map((l, i) => renderCard(l, i))}
          </div>
        ))}
      </div>
    </div>
  );
}
