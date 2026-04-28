"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Keywords, FounderProfile } from "@/lib/types";
import styles from "./page.module.css";

type Category = keyof Keywords;

const LABELS: Record<Category, string> = {
  leadFinding: "Lead Finding",
  competitorAnalysis: "Competitor Analysis",
  marketResearch: "Market Research",
};

interface ChipSectionProps {
  label: string;
  chips: string[];
  onChange: (chips: string[]) => void;
}

function ChipSection({ label, chips, onChange }: ChipSectionProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addChip() {
    const val = input.trim();
    if (val && !chips.includes(val)) onChange([...chips, val]);
    setInput("");
  }

  function removeChip(i: number) {
    onChange(chips.filter((_, idx) => idx !== i));
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      <div className={styles.chipArea} onClick={() => inputRef.current?.focus()}>
        {chips.length === 0 && (
          <span className={styles.emptyChip}>No keywords — type to add some</span>
        )}
        {chips.map((chip, i) => (
          <span key={i} className={styles.chip}>
            {chip}
            <button className={styles.chipX} onClick={(e) => { e.stopPropagation(); removeChip(i); }}>×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className={styles.chipInput}
          value={input}
          placeholder={chips.length === 0 ? "Add a keyword…" : ""}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addChip(); }
            if (e.key === "Backspace" && !input && chips.length > 0) removeChip(chips.length - 1);
          }}
          onBlur={addChip}
        />
      </div>
    </div>
  );
}

export default function KeywordsPage() {
  const router = useRouter();
  const [keywords, setKeywords] = useState<Keywords>({ leadFinding: [], competitorAnalysis: [], marketResearch: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function generate(profile: FounderProfile) {
    setLoading(true);
    setError(false);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: profile.company,
          productDescription: profile.productDescription,
          competitors: profile.competitors,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error("failed");
      const data: Keywords = await res.json();
      setKeywords(data);
    } catch {
      // Rule-based fallback — show something, no error shown to user
      const words = profile.productDescription.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
      setKeywords({
        leadFinding: ["first 100 users", "user acquisition", "getting traction", "startup growth", "need more users"],
        competitorAnalysis: profile.competitors.length
          ? profile.competitors.slice(0, 5)
          : ["growth hack", "organic growth", "paid ads failing", "cold email tips", "referral program"],
        marketResearch: ["distribution strategy", "product market fit", "launch strategy", "b2c marketing", "founder growth"],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("founderProfile");
      if (!raw) { router.replace("/onboarding"); return; }
      const profile: FounderProfile = JSON.parse(raw);
      generate(profile);
    } catch {
      router.replace("/onboarding");
    }
  }, []);

  function handleConfirm() {
    localStorage.setItem("keywords", JSON.stringify(keywords));
    router.replace("/dashboard");
  }

  function handleBack() {
    router.back();
  }

  function updateCategory(cat: Category, chips: string[]) {
    setKeywords((k) => ({ ...k, [cat]: chips }));
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>Filo</div>
        <h1 className={styles.title}>Your signal keywords</h1>
        <p className={styles.sub}>
          These are the phrases we&apos;ll use to find conversations on X. Edit or add any that fit.
        </p>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Generating keywords…</span>
          </div>
        ) : (
          <>
            <div className={styles.sections}>
              {(Object.keys(LABELS) as Category[]).map((cat) => (
                <ChipSection
                  key={cat}
                  label={LABELS[cat]}
                  chips={keywords[cat]}
                  onChange={(chips) => updateCategory(cat, chips)}
                />
              ))}
            </div>

            {error && (
              <p className={styles.errorNote}>Using fallback keywords — Groq unavailable.</p>
            )}

            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={handleBack}>← Back</button>
              <div className={styles.actionsRight}>
                <button className={styles.regenBtn} onClick={() => {
                  try {
                    const raw = localStorage.getItem("founderProfile");
                    if (raw) generate(JSON.parse(raw));
                  } catch {}
                }}>Regenerate</button>
                <button className={styles.confirmBtn} onClick={handleConfirm}>
                  Confirm keywords →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
