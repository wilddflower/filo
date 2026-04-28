"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { Lead, Platform } from "@/lib/types";
import { fetchLeads } from "@/lib/api";
import { getDismissed, dismiss } from "@/lib/dismissedLeads";
import { LeadCard } from "./LeadCard";
import { LeadDetail } from "./LeadDetail";
import { WelcomeModal } from "@/components/welcome/WelcomeModal";
import styles from "./LeadDashboard.module.css";

const PT_OPTS = [
  { label: "𝕏 Twitter", value: "x"        },
  { label: "Facebook",  value: "facebook" },
] as const;

const PAGE_SIZE = 12;
const PAGE_WINDOW = 5;

function getPageWindow(current: number, total: number): number[] {
  const half = Math.floor(PAGE_WINDOW / 2);
  let start = Math.max(0, current - half);
  const end = Math.min(total - 1, start + PAGE_WINDOW - 1);
  start = Math.max(0, end - PAGE_WINDOW + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function parseHoursAgo(time: string): number {
  const n = parseInt(time) || 0;
  if (time.includes("m ago")) return n / 60;
  if (time.includes("h ago")) return n;
  if (time.includes("d ago")) return n * 24;
  return 72;
}

function sortKey(lead: Lead): number {
  const hours = parseHoursAgo(lead.time);
  const recency = Math.exp(-hours / 48); // decays over ~2 days
  return lead.score * (0.5 + 0.5 * recency);
}

export function LeadDashboard() {
  const [allLeads, setAllLeads]     = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [minScore, setMinScore]     = useState(4);  // slider default; backend can send score-3 padding
  const [platform, setPlatform]     = useState<Platform>("x");
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [showWelcome, setShowWelcome]   = useState(false);
  const [spinning, setSpinning]         = useState(false);
  const [page, setPage]                 = useState(0);

  const toggleRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 4, width: 48 });

  useEffect(() => {
    try {
      const seen = localStorage.getItem("filo_welcome_seen");
      if (!seen) setShowWelcome(true);
    } catch {}
    setDismissedIds(getDismissed());
    load();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.platform = platform;
    return () => { delete document.documentElement.dataset.platform; };
  }, [platform]);

  useEffect(() => {
    const container = toggleRef.current;
    if (!container) return;
    const idx = PT_OPTS.findIndex((o) => o.value === platform);
    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    const btn = buttons[idx];
    if (btn) setPillStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [platform]);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [minScore, platform, dismissedIds]);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchLeads();
      setAllLeads(data);
      if (data.length > 0) setSelectedId(data[0].id);
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    setSpinning(true);
    load().finally(() => setTimeout(() => setSpinning(false), 700));
  }

  // Filter + sort by recency-weighted score
  const leads = useMemo(() => {
    return allLeads
      .filter((l) => {
        if (dismissedIds.includes(l.id)) return false;
        if (l.score < minScore) return false;
        if (l.platform !== platform) return false;
        return true;
      })
      .sort((a, b) => sortKey(b) - sortKey(a));
  }, [allLeads, minScore, platform, dismissedIds]);

  const totalPages = Math.ceil(leads.length / PAGE_SIZE);
  const paginated  = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleDismiss(id: string) {
    dismiss(id);
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    const remaining = leads.filter((l) => l.id !== id);
    const currentIndex = leads.findIndex((l) => l.id === id);
    const next = remaining[currentIndex] ?? remaining[currentIndex - 1] ?? null;
    setSelectedId(next?.id ?? null);
  }

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  return (
    <div className={styles.shell} data-platform={platform}>
      {showWelcome && (
        <WelcomeModal onDismiss={() => {
          localStorage.setItem("filo_welcome_seen", "1");
          setShowWelcome(false);
        }} />
      )}

      {/* ── Topbar ── */}
      <div className={styles.topbar}>
        <div className={styles.tbTitle}>
          <span className={styles.liveDot} />
          Live Signals
        </div>

        <div className={styles.spacer} />

        {/* Platform toggle — sliding pill */}
        <div className={styles.platformToggle} ref={toggleRef}>
          <div
            className={styles.ptIndicator}
            style={{ left: pillStyle.left, width: pillStyle.width }}
          />
          {PT_OPTS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.ptBtn} ${platform === opt.value ? styles.ptActive : ""}`}
              onClick={() => setPlatform(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Score range */}
        <div className={styles.scoreRange}>
          <span>Score ≥</span>
          <span className={styles.scoreVal}>{minScore}</span>
          <input
            type="range"
            min={3}
            max={10}
            step={1}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
        </div>

        {/* Refresh */}
        <button
          className={`${styles.refreshBtn} ${spinning ? styles.refreshSpin : ""}`}
          onClick={handleRefresh}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <span className={styles.refreshUpdated}>Updated just now</span>
        </button>
      </div>

      {/* ── Content ── */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Scoring leads…</div>
        ) : (
          <div className={styles.feed}>
            {/* Feed header */}
            <div className={styles.feedHead}>
              <span className={styles.feedCount}>
                <strong>{leads.length}</strong> signals
                {totalPages > 1 && (
                  <span className={styles.feedPage}> · page {page + 1} of {totalPages}</span>
                )}
              </span>
              <span className={styles.feedLive}>
                <span className={styles.feedLiveDot} />
                sorted by recency · score
              </span>
            </div>

            {leads.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyGlyph}>📭</div>
                <h3>No signals found</h3>
                <p>Try adjusting your score filter or checking back later.</p>
              </div>
            ) : (
              <>
                {/* Row container */}
                <div className={styles.table}>
                  {paginated.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      selected={selectedId === l.id}
                      onClick={() => setSelectedId(l.id)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      className={styles.pageNav}
                      disabled={page === 0}
                      onClick={() => setPage(0)}
                      title="First page"
                    >
                      ««
                    </button>
                    <button
                      className={styles.pageNav}
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      ‹
                    </button>
                    <div className={styles.pageNums}>
                      {getPageWindow(page, totalPages).map((i) => (
                        <button
                          key={i}
                          className={`${styles.pageNum} ${i === page ? styles.pageNumActive : ""}`}
                          onClick={() => setPage(i)}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      className={styles.pageNav}
                      disabled={page === totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      ›
                    </button>
                    <button
                      className={styles.pageNav}
                      disabled={page === totalPages - 1}
                      onClick={() => setPage(totalPages - 1)}
                      title="Last page"
                    >
                      »»
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Detail slide-in ── */}
      {selected && (
        <>
          <div
            className={styles.detailBackdrop}
            onClick={() => setSelectedId(null)}
          />
          <div className={styles.detailPanel}>
            <LeadDetail
              lead={selected}
              onDismiss={() => handleDismiss(selected.id)}
              onClose={() => setSelectedId(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}
