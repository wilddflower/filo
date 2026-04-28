"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import type { FounderProfile } from "@/lib/types";
import styles from "./page.module.css";

const STORAGE_KEY = "founderProfile";

interface FormState {
  name: string;
  company: string;
  productDescription: string;
  competitors: string;
  style: string;
  promoCode: string;
  url: string;
}

const EMPTY_FORM: FormState = { name: "", company: "", productDescription: "", competitors: "", style: "", promoCode: "", url: "" };

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const profile = JSON.parse(stored) as Partial<FounderProfile> & { valueP?: string };
        setForm({
          name: profile.name ?? "",
          company: profile.company ?? "",
          productDescription: profile.productDescription ?? profile.valueP ?? "",
          competitors: (profile.competitors ?? []).join(", "),
          style: profile.style ?? "",
          promoCode: profile.promoCode ?? "",
          url: profile.url ?? "",
        });
      }
    } catch {}
  }, []);

  function handleChange(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    const profile: FounderProfile = {
      name: form.name,
      company: form.company,
      productDescription: form.productDescription,
      competitors: form.competitors.split(",").map((s) => s.trim()).filter(Boolean),
      style: form.style,
      promoCode: form.promoCode,
      url: form.url,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("keywords");
    router.replace("/onboarding");
  }

  return (
    <AppShell activePage="settings">
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.sub}>Tell us about your brand and we&apos;ll write replies that sound like you — not a bot.</p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.section}>Your Profile</h2>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Your name</label>
              <input
                className={styles.input}
                placeholder="Pavni Labade"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Company</label>
              <input
                className={styles.input}
                placeholder="Filo"
                value={form.company}
                onChange={(e) => handleChange("company", e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>What your product does</label>
            <textarea
              className={styles.textarea}
              placeholder="AI-powered buyer intent tool for X — we score leads in real-time so founders reply to the right people first."
              rows={3}
              value={form.productDescription}
              onChange={(e) => handleChange("productDescription", e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Competitors <span className={styles.optional}>(optional, comma-separated)</span></label>
            <input
              className={styles.input}
              placeholder="Sprout Social, Brandwatch, Mention"
              value={form.competitors}
              onChange={(e) => handleChange("competitors", e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Your writing style <span className={styles.optional}>(optional)</span></label>
            <textarea
              className={styles.textarea}
              placeholder="Casual, direct, founder energy. Short sentences. Never salesy."
              rows={2}
              value={form.style}
              onChange={(e) => handleChange("style", e.target.value)}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Promo code <span className={styles.optional}>(optional)</span></label>
              <input
                className={styles.input}
                placeholder="FILO20"
                value={form.promoCode}
                onChange={(e) => handleChange("promoCode", e.target.value)}
              />
              <p className={styles.hint}>We&apos;ll weave it in naturally — never spammy.</p>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Product URL <span className={styles.optional}>(optional)</span></label>
              <input
                className={styles.input}
                placeholder="https://tryfilo.com"
                value={form.url}
                onChange={(e) => handleChange("url", e.target.value)}
              />
              <p className={styles.hint}>Dropped at the end of every reply.</p>
            </div>
          </div>

          <div className={styles.footer}>
            <button className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ""}`} onClick={handleSave}>
              {saved ? "Saved!" : "Save profile"}
            </button>
            {saved && <span className={styles.savedNote}>Your replies will now sound like you.</span>}
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.section}>Demo</h2>
          <p className={styles.sub}>Restart the onboarding flow to re-enter your company info and regenerate keywords.</p>
          {showReset ? (
            <div className={styles.resetConfirm}>
              <span>This will clear your profile and keywords. Sure?</span>
              <button className={styles.resetConfirmBtn} onClick={handleReset}>Yes, reset</button>
              <button className={styles.resetCancelBtn} onClick={() => setShowReset(false)}>Cancel</button>
            </div>
          ) : (
            <button className={styles.resetBtn} onClick={() => setShowReset(true)}>Reset demo</button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
