"use client";

import { useState, useMemo } from "react";
import { MOCK_LEADS } from "@/lib/data/mockLeads";
import type { Lead, LeadFilters } from "@/lib/types";
import { LeadListPanel } from "./LeadListPanel";
import { LeadDetail } from "./LeadDetail";
import styles from "./LeadDashboard.module.css";

export function LeadDashboard() {
  const [selectedId, setSelectedId] = useState<string>("l1");
  const [filters, setFilters] = useState<LeadFilters>({ score: "all", time: "today", followers: "any" });

  const leads = useMemo(() => {
    return MOCK_LEADS.filter((l) => {
      if (filters.score === "hi" && l.score < 7) return false;
      if (filters.score === "md" && (l.score < 4 || l.score > 6)) return false;
      if (filters.score === "lo" && l.score > 3) return false;
      if (filters.followers === "1k" && !/K/.test(l.followers)) return false;
      if (filters.followers === "10k") {
        const n = parseFloat(l.followers);
        if (!/K/.test(l.followers) || n < 10) return false;
      }
      return true;
    });
  }, [filters]);

  const selected: Lead | null = leads.find((l) => l.id === selectedId) ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>Lead feed</h1>
          <div className={styles.sub}>{leads.length} scored leads · auto-refresh every 15 min</div>
        </div>
        <div className={styles.row}>
          <button className={styles.btnOutline}>Export CSV</button>
        </div>
      </div>
      <div className={styles.split}>
        <LeadListPanel
          leads={leads}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filters={filters}
          setFilters={setFilters}
        />
        <LeadDetail lead={selected} />
      </div>
    </div>
  );
}
