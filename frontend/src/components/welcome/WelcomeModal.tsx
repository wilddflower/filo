"use client";

import { useEffect, useState } from "react";
import styles from "./WelcomeModal.module.css";

interface Props {
  onDismiss: () => void;
}

function loadProfile(): { name: string; company: string } {
  try {
    const raw = localStorage.getItem("founderProfile");
    if (!raw) return { name: "", company: "" };
    const p = JSON.parse(raw);
    return { name: p.name ?? "", company: p.company ?? "" };
  } catch {
    return { name: "", company: "" };
  }
}

export function WelcomeModal({ onDismiss }: Props) {
  const [profile, setProfile] = useState({ name: "", company: "" });

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const displayName = profile.name || profile.company || "there";
  const company = profile.company || "your company";

  return (
    <div className={styles.backdrop} onClick={onDismiss}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* Floating card stack */}
        <div className={styles.stack}>
          <div className={`${styles.wsCard} ${styles.wsCard1}`}>
            <div className={`${styles.wsGlyph} ${styles.wsGlyph1}`}>f</div>
            <div className={styles.wsText}>
              <b>Welcome to Filo</b>
              <span>Your buyers, surfaced.</span>
            </div>
          </div>
          <div className={`${styles.wsCard} ${styles.wsCard2}`}>
            <div className={`${styles.wsGlyph} ${styles.wsGlyph2}`}>★</div>
            <div className={styles.wsText}>
              <b>8/10 — high intent</b>
              <span>Live signal · 4m ago</span>
            </div>
          </div>
          <div className={`${styles.wsCard} ${styles.wsCard3}`}>
            <div className={`${styles.wsGlyph} ${styles.wsGlyph3}`}>f</div>
            <div className={styles.wsText}>
              <b>New on Facebook</b>
              <span>SaaS Founders · just now</span>
            </div>
          </div>
        </div>

        <h2 className={styles.heading}>Welcome, {displayName}.</h2>
        <p className={styles.sub}>
          Filo is now monitoring social signals for <b>{company}</b>.
          <br />Every high-intent conversation, surfaced automatically.
        </p>

        <div className={styles.actions}>
          <button className={styles.skipBtn} onClick={onDismiss}>
            Skip for now
          </button>
          <button className={styles.ctaBtn} onClick={onDismiss}>
            Let&apos;s go →
          </button>
        </div>
      </div>
    </div>
  );
}
