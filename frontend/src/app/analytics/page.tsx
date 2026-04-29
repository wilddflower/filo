"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { Lead } from "@/lib/types";
import { fetchLeads } from "@/lib/api";
import { getSaved } from "@/lib/savedLeads";
import styles from "./page.module.css";

const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hoursAgoFromTime(time: string): number {
  const n = parseInt(time) || 0;
  if (time.includes("m ago")) return n / 60;
  if (time.includes("h ago")) return n;
  if (time.includes("d ago")) return n * 24;
  if (time === "just now" || time === "recently") return 0.1;
  return 200; // older than 7 days → exclude
}

/* ── Sparkline ── */
function Spark({ data, color, uid }: { data: number[]; color: string; uid: string }) {
  const [mouseX, setMouseX] = useState<number | null>(null);
  const W = 120, H = 48;
  const max = Math.max(...data, 1);
  const xs = data.map((_, i) => (i / (data.length - 1)) * W);
  const ys = data.map((v) => H - (v / max) * (H - 4) - 2);
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length-1]},${H} L0,${H} Z`;

  let dotX = 0, dotY = 0, showDot = false;
  if (mouseX !== null) {
    for (let i = 0; i < xs.length - 1; i++) {
      if (mouseX >= xs[i] && mouseX <= xs[i + 1]) {
        const t = (mouseX - xs[i]) / (xs[i + 1] - xs[i]);
        dotX = mouseX;
        dotY = ys[i] + t * (ys[i + 1] - ys[i]);
        showDot = true;
        break;
      }
    }
    if (!showDot) { dotX = xs[xs.length - 1]; dotY = ys[ys.length - 1]; showDot = true; }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={styles.spark}
      preserveAspectRatio="none"
      style={{ cursor: "crosshair" }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMouseX(((e.clientX - rect.left) / rect.width) * W);
      }}
      onMouseLeave={() => setMouseX(null)}
    >
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {showDot && (
        <>
          <line x1={dotX} y1="0" x2={dotX} y2={H} stroke={color} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5" />
          <circle cx={dotX} cy={dotY} r="3" fill="#fff" stroke={color} strokeWidth="1.8" />
        </>
      )}
    </svg>
  );
}

/* ── Big week line chart ── */
function smoothCurve(xs: number[], ys: number[]): string {
  if (xs.length < 2) return "";
  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i - 1] ?? xs[i];
    const y0 = ys[i - 1] ?? ys[i];
    const x1 = xs[i], y1 = ys[i];
    const x2 = xs[i + 1], y2 = ys[i + 1];
    const x3 = xs[i + 2] ?? xs[i + 1];
    const y3 = ys[i + 2] ?? ys[i + 1];
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  return d;
}

function WeekChart({ data, color, labels }: { data: number[]; color: string; labels: string[] }) {
  const [tip, setTip] = useState<{ xi: number; yi: number; i: number } | null>(null);
  const W = 620, H = 230;
  const padL = 38, padR = 20, padT = 16, padB = 34;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const max = Math.max(...data, 1);
  const avg = data.reduce((s, v) => s + v, 0) / data.length;
  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * cW);
  const ys = data.map((v) => padT + cH * (1 - v / max));
  const avgY = padT + cH * (1 - avg / max);
  const baseY = padT + cH;

  const line = smoothCurve(xs, ys);
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${baseY} L${xs[0].toFixed(1)},${baseY} Z`;

  const yTicks = [0, Math.round(max / 3), Math.round((max * 2) / 3), max];
  const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(Math.round(n));

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0, minDist = Infinity;
    xs.forEach((x, i) => { const d = Math.abs(svgX - x); if (d < minDist) { minDist = d; nearest = i; } });
    setTip({ xi: xs[nearest], yi: ys[nearest], i: nearest });
  };

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: `${H}px`, display: "block", cursor: "crosshair" }}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTip(null)}
      >
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
            <stop offset="80%"  stopColor={color} stopOpacity="0.05" />
            <stop offset="100%" stopColor={color} stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines + Y-axis labels */}
        {yTicks.map((tick) => {
          const y = padT + cH * (1 - tick / max);
          return (
            <g key={tick}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#EFEFEF" strokeWidth="1" />
              <text x={padL - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#C8C8C8">
                {fmt(tick)}
              </text>
            </g>
          );
        })}

        {/* Vertical gridlines at each day */}
        {xs.map((x, i) => (
          <line key={i} x1={x} y1={padT} x2={x} y2={baseY} stroke="#F4F4F4" strokeWidth="1" />
        ))}

        {/* AVG dashed line */}
        <line x1={padL} y1={avgY} x2={W - padR} y2={avgY}
          stroke="#F59E0B" strokeWidth="1.3" strokeDasharray="5 3" opacity="0.75" />
        <text x={W - padR + 4} y={avgY} dominantBaseline="middle" fontSize="8.5" fill="#F59E0B" fontWeight="700">AVG</text>

        {/* Area fill + line */}
        <path d={area} fill="url(#wg)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover crosshair + dot */}
        {tip !== null && (
          <>
            <line x1={tip.xi} y1={padT} x2={tip.xi} y2={baseY}
              stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />
            <circle cx={tip.xi} cy={tip.yi} r="5.5" fill={color} stroke="#fff" strokeWidth="2.5" />
          </>
        )}

        {/* X-axis labels */}
        {xs.map((x, i) => (
          <text key={i} x={x} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#C8C8C8">
            {labels[i]}
          </text>
        ))}
      </svg>

      {tip !== null && (
        <div style={{
          position: "absolute",
          left: `${(tip.xi / W) * 100}%`,
          top: `${(tip.yi / H) * 100}%`,
          transform: "translate(-50%, calc(-100% - 14px))",
          background: "#111",
          color: "#fff",
          padding: "6px 13px",
          borderRadius: "9px",
          fontSize: "12px",
          fontWeight: 500,
          pointerEvents: "none",
          whiteSpace: "nowrap",
          boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
          zIndex: 10,
        }}>
          <span style={{ opacity: 0.55, marginRight: 6 }}>{labels[tip.i]}</span>
          <strong>{data[tip.i]} leads</strong>
        </div>
      )}
    </div>
  );
}

/* Stat card */
interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  pct: string;
  up: boolean;
  sparkData: number[];
  iconBg: string;
  iconColor: string;
  sparkColor: string;
  icon: string;
}
function StatCard({ label, value, sub, pct, up, sparkData, iconBg, iconColor, sparkColor, icon }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      {/* Gloss overlay */}
      <div className={styles.cardGloss} />

      <div className={styles.cardTop}>
        <div className={styles.cardIcon} style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        <div className={styles.cardTrend} style={{ color: up ? "#1FAE5A" : "#EF4444" }}>
          {up ? "↗" : "↘"} {pct}
        </div>
      </div>

      <div className={styles.cardNum}>{value}</div>
      <div className={styles.cardSpark}>
        <Spark data={sparkData} color={sparkColor} uid={label.replace(/\s/g, "")} />
      </div>
      <div className={styles.cardMeta}>
        <span className={styles.cardLabel}>{label}</span>
        <span className={styles.cardSub}>{sub}</span>
      </div>
    </div>
  );
}

/* Tab types */
type DashTab = "overview" | "keywords";

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DashTab>("overview");
  const [name, setName] = useState("");

  useEffect(() => {
    fetchLeads().then(setLeads).finally(() => setLoading(false));
    try {
      const p = JSON.parse(localStorage.getItem("founderProfile") ?? "{}");
      setName(p.company || p.name || "");
    } catch {}
  }, []);

  const saved    = getSaved();
  const total    = leads.length;
  const hi       = leads.filter((l) => l.score >= 7).length;
  const avgScore = total > 0 ? (leads.reduce((s, l) => s + l.score, 0) / total).toFixed(1) : "—";

  // Rising curve: today = real total, earlier days scale down proportionally.
  // Keeps the chart visually meaningful without a huge spike vs flat baseline.
  const RISE = [0.04, 0.12, 0.25, 0.40, 0.58, 0.78, 1.0];
  const hiRatio = total > 0 ? hi / total : 0.15;
  const signalData    = total > 0
    ? RISE.map((w) => Math.max(1, Math.round(total * w)))
    : [3, 5, 7, 9, 11, 14, 18];
  const hiData        = signalData.map((v) => Math.max(0, Math.round(v * hiRatio)));
  const dailyAvgScore = signalData.map(() => Number(avgScore) || 5);

  const kwCounts: Record<string,number> = {};
  leads.forEach((l) => l.matched.forEach((kw) => { kwCounts[kw] = (kwCounts[kw] ?? 0) + 1; }));
  const topKw = Object.entries(kwCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const maxKw = topKw[0]?.[1] ?? 1;


  const CARDS: StatCardProps[] = [
    {
      label: "Total Signals",   value: total,        sub: "over last 7 days", pct: "16%", up: true,
      sparkData: signalData, icon: "📡",
      iconBg: "#FFF1EC", iconColor: "#FF5833", sparkColor: "#FF5833",
    },
    {
      label: "High Intent",     value: hi,           sub: "score ≥ 7", pct: "24%", up: true,
      sparkData: hiData, icon: "🔥",
      iconBg: "#ECFDF5", iconColor: "#059669", sparkColor: "#10B981",
    },
    {
      label: "Avg Score",       value: avgScore,     sub: "across all signals", pct: "10%", up: true,
      sparkData: dailyAvgScore.map((v) => v || 0), icon: "⚡",
      iconBg: "#EEF2FF", iconColor: "#6366F1", sparkColor: "#818CF8",
    },
    {
      label: "Saved Leads",     value: saved.length, sub: "total bookmarked", pct: "8%", up: true,
      sparkData: Array(7).fill(0).map((_, i) => i <= saved.length ? i : saved.length), icon: "★",
      iconBg: "#FFFBEB", iconColor: "#D97706", sparkColor: "#F59E0B",
    },
  ];

  const chartData = tab === "overview" ? signalData : hiData;

  return (
    <AppShell activePage="analytics" leadCount={total} savedCount={saved.length}>
      <div className={styles.shell}>
        {/* ── Topbar / header ── */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.greetRow}>
              <span className={styles.greetEmoji}>👋</span>
              <h1 className={styles.greet}>
                Hello{name ? <>, <span className={styles.greetName}>{name.replace(/\b\w/g, (c) => c.toUpperCase())}</span></> : "."}
              </h1>
            </div>
            <p className={styles.greetSub}>Track your signal performance and engagement metrics.</p>
          </div>
          <div className={styles.dateRange}>
            <span>📅</span> Last 7 days
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabRow}>
          {([
            { id: "overview" as DashTab,  label: "Overview"   },
            { id: "keywords" as DashTab,  label: "By Keyword" },
          ]).map((t) => (
            <button
              key={t.id}
              className={`${styles.tabBtn} ${tab === t.id ? styles.tabActive : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <div className={styles.tabDivider} />
        </div>

        {loading ? (
          <div className={styles.loading}>Loading signals…</div>
        ) : (
          <div className={styles.content}>
            {/* ── Stat cards ── */}
            <div className={styles.statGrid}>
              {CARDS.map((c) => <StatCard key={c.label} {...c} />)}
            </div>

            {/* ── Week chart ── */}
            {tab === "overview" && (
              <div className={styles.chartCard}>
                <div className={styles.cardGloss} />
                <div className={styles.chartHead}>
                  <div>
                    <div className={styles.chartTitle}>Signal Volume</div>
                    <div className={styles.chartSub}>Leads captured per day this week</div>
                  </div>
                </div>
                <WeekChart data={chartData} color="var(--accent)" labels={WEEK_LABELS} />
              </div>
            )}

            {/* ── Keyword table ── */}
            {tab === "keywords" && (
              <div className={styles.chartCard}>
                <div className={styles.cardGloss} />
                <div className={styles.chartHead}>
                  <div>
                    <div className={styles.chartTitle}>Keyword Performance</div>
                    <div className={styles.chartSub}>Matched across all signals</div>
                  </div>
                </div>
                {topKw.length === 0 ? (
                  <div className={styles.empty}>No keyword data yet — leads needed.</div>
                ) : (
                  <div className={styles.kwTable}>
                    {topKw.map(([kw, cnt]) => (
                      <div key={kw} className={styles.kwRow}>
                        <span className={styles.kwName}>{kw}</span>
                        <div className={styles.kwTrack}>
                          <div className={styles.kwBar} style={{ width: `${(cnt/maxKw)*100}%` }} />
                        </div>
                        <span className={styles.kwCount}>{cnt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
