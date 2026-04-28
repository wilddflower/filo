"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LeadDetail } from "@/components/leads/LeadDetail";
import type { Lead, SavedStatus } from "@/lib/types";
import { getSaved, unsaveLead, updateStatus, type SavedEntry } from "@/lib/savedLeads";
import styles from "./page.module.css";

const STATUS_LABELS: Record<SavedStatus, string> = {
  "new": "New",
  "reached-out": "Reached Out",
  "replied": "Replied",
  "waiting": "Waiting",
  "converted": "Converted ✓",
  "not-interested": "Not Interested",
};

const STATUS_COLOR: Record<SavedStatus, string> = {
  "new": "var(--ink-4)",
  "reached-out": "#6c8ef5",
  "replied": "#f5a623",
  "waiting": "#a78bfa",
  "converted": "var(--pos)",
  "not-interested": "var(--ink-5)",
};

export default function SavedPage() {
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = getSaved();
    setEntries(loaded);
    if (loaded.length > 0) setSelectedId(loaded[0].lead.id);
  }, []);

  const selected: Lead | null = entries.find((e) => e.lead.id === selectedId)?.lead ?? null;

  function handleUnsave(id: string) {
    unsaveLead(id);
    const next = entries.filter((e) => e.lead.id !== id);
    setEntries(next);
    if (selectedId === id) setSelectedId(next[0]?.lead.id ?? null);
  }

  function handleStatus(id: string, status: SavedStatus) {
    updateStatus(id, status);
    setEntries(entries.map((e) => (e.lead.id === id ? { ...e, status } : e)));
  }

  return (
    <AppShell activePage="saved">
      <div className={styles.page}>
        <div className={styles.pageHead}>
          <h1 className={styles.h1}>Saved Leads</h1>
          {entries.length > 0 && (
            <span className={styles.count}>{entries.length} saved</span>
          )}
        </div>

        {entries.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>☆</span>
            <p>No saved leads yet.</p>
            <p className={styles.emptyHint}>Click the star on any lead in the dashboard to track it here.</p>
          </div>
        ) : (
          <div className={styles.split}>
            <div className={styles.list}>
              {entries.map((entry) => (
                <div
                  key={entry.lead.id}
                  className={`${styles.card} ${selectedId === entry.lead.id ? styles.cardActive : ""}`}
                  onClick={() => setSelectedId(entry.lead.id)}
                >
                  <div className={styles.cardTop}>
                    <div
                      className={styles.avatar}
                      style={{ background: `linear-gradient(135deg, oklch(0.7 0.12 ${entry.lead.avatarHue}), oklch(0.5 0.14 ${entry.lead.avatarHue + 20}))` }}
                    >
                      {entry.lead.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className={styles.cardMeta}>
                      <div className={styles.cardName}>{entry.lead.name}</div>
                      <div className={styles.cardHandle}>@{entry.lead.handle}</div>
                    </div>
                    <div className={styles.cardScore} data-tier={entry.lead.scoreTier}>
                      {entry.lead.score}
                    </div>
                  </div>

                  <p className={styles.excerpt}>
                    {entry.lead.post.length > 110 ? entry.lead.post.slice(0, 110) + "…" : entry.lead.post}
                  </p>

                  <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                    <select
                      className={styles.statusSelect}
                      value={entry.status}
                      style={{ color: STATUS_COLOR[entry.status] }}
                      onChange={(e) => handleStatus(entry.lead.id, e.target.value as SavedStatus)}
                    >
                      {(Object.entries(STATUS_LABELS) as [SavedStatus, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button className={styles.removeBtn} onClick={() => handleUnsave(entry.lead.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <LeadDetail lead={selected} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
