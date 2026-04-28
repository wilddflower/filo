"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FounderProfile, Keywords } from "@/lib/types";
import styles from "./page.module.css";

type Step = 1 | 2 | 3;
type PlatformId = "x" | "facebook";
type KwCategory = "leadFinding" | "competitorAnalysis" | "marketResearch";

const KW_TABS: { id: KwCategory; label: string }[] = [
  { id: "leadFinding",       label: "Lead Finding"        },
  { id: "competitorAnalysis", label: "Competitor Analysis" },
  { id: "marketResearch",    label: "Market Research"     },
];

const DEFAULT_KW: Keywords = {
  leadFinding:       ["looking for", "any recommendations", "budget approved", "alternatives to", "anyone using"],
  competitorAnalysis: ["switching from", "better than", "vs"],
  marketResearch:    ["buyer intent", "GTM stack", "outbound strategy"],
};

function IcoCheck() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

function IcoX() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
}

function IcoFb() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  /* Step 1 — company */
  const [company, setCompany] = useState("");
  const [pitch, setPitch] = useState("");
  const [competitors, setCompetitors] = useState<string[]>(["Apollo", "Clay", "ZoomInfo"]);
  const [compInput, setCompInput] = useState("");

  /* Step 2 — platforms */
  const [platforms, setPlatforms] = useState<Record<PlatformId, boolean>>({ x: true, facebook: false });

  /* Step 3 — keywords */
  const [kwTab, setKwTab] = useState<KwCategory>("leadFinding");
  const [keywords, setKeywords] = useState<Keywords>(DEFAULT_KW);
  const [kwInput, setKwInput] = useState("");
  const [kwLoading, setKwLoading] = useState(false);
  const kwInputRef = useRef<HTMLInputElement>(null);

  const progress = (step / 3) * 100;

  /* When entering step 3, generate keywords from the profile */
  useEffect(() => {
    if (step !== 3 || !company) return;
    generateKeywords();
  }, [step]);

  async function generateKeywords() {
    setKwLoading(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, productDescription: pitch, competitors }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data: Keywords = await res.json();
        setKeywords(data);
      }
    } catch {
      /* keep DEFAULT_KW */
    } finally {
      setKwLoading(false);
    }
  }

  function addCompetitor() {
    const v = compInput.trim();
    if (v && !competitors.includes(v)) setCompetitors([...competitors, v]);
    setCompInput("");
  }

  function addKeyword() {
    const v = kwInput.trim();
    if (!v || keywords[kwTab].includes(v)) { setKwInput(""); return; }
    setKeywords({ ...keywords, [kwTab]: [...keywords[kwTab], v] });
    setKwInput("");
  }

  function removeKeyword(kw: string) {
    setKeywords({ ...keywords, [kwTab]: keywords[kwTab].filter((k) => k !== kw) });
  }

  function canAdvance() {
    if (step === 1) return company.trim().length > 0 && pitch.trim().length > 0;
    if (step === 2) return platforms.x || platforms.facebook;
    return true;
  }

  function finish() {
    const profile: FounderProfile = {
      name: "",
      company: company.trim(),
      productDescription: pitch.trim(),
      competitors,
      style: "",
      promoCode: "",
      url: "",
    };
    const selectedPlatforms = platforms.x && platforms.facebook
      ? "both"
      : platforms.facebook ? "facebook" : "x";

    localStorage.setItem("founderProfile", JSON.stringify(profile));
    localStorage.setItem("selectedPlatforms", selectedPlatforms);
    localStorage.setItem("keywords", JSON.stringify(keywords));
    router.push("/dashboard");
  }

  return (
    <div className={styles.stage}>
      <div className={styles.shell}>
        {/* Progress bar */}
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.progressMeta}>
            <span><span className={styles.stepNum}>Step {step}</span> of 3</span>
            <span>{step === 1 ? "Company" : step === 2 ? "Platforms" : "Keywords"}</span>
          </div>
        </div>

        {/* Card */}
        <div className={styles.card}>

          {/* ── Step 1: Company ── */}
          {step === 1 && (
            <>
              <h1 className={styles.h}>Tell us about your product.</h1>
              <p className={styles.sub}>We'll use this to tune Filo's signal detection — better in, better out.</p>

              <div className={styles.field}>
                <label className={styles.label}>Company name</label>
                <input
                  className={styles.input}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Filo"
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>What does your product do?</label>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="One or two sentences. e.g. 'We help RevOps teams build pipeline from social signals'"
                />
                <div className={styles.hint}>Tip: focus on the pain you solve, not the features.</div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Who are your competitors?</label>
                <div className={styles.tagInput}>
                  {competitors.map((c) => (
                    <span key={c} className={styles.compPill}>
                      {c}
                      <button
                        className={styles.pillX}
                        onClick={() => setCompetitors(competitors.filter((x) => x !== c))}
                      >×</button>
                    </span>
                  ))}
                  <input
                    className={styles.tagInputInner}
                    placeholder={competitors.length ? "Add another…" : "Type and press Enter"}
                    value={compInput}
                    onChange={(e) => setCompInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addCompetitor(); }
                      if (e.key === "Backspace" && !compInput && competitors.length) {
                        setCompetitors(competitors.slice(0, -1));
                      }
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Platforms ── */}
          {step === 2 && (
            <>
              <h1 className={styles.h}>Where do your buyers hang out?</h1>
              <p className={styles.sub}>Pick one or both. You can change this anytime in settings.</p>

              <div className={styles.platformGrid}>
                {([
                  { id: "x" as PlatformId, Icon: IcoX, name: "X", desc: "Real-time signals from posts, replies, and quote-tweets across the public timeline." },
                  { id: "facebook" as PlatformId, Icon: IcoFb, name: "Facebook", desc: "Group conversations where decision-makers ask peers for tool recommendations." },
                ] as const).map(({ id, Icon, name, desc }) => (
                  <button
                    key={id}
                    className={`${styles.platformCard} ${styles[`platform_${id}`]} ${platforms[id] ? styles.platformSelected : ""}`}
                    onClick={() => setPlatforms({ ...platforms, [id]: !platforms[id] })}
                  >
                    <span className={`${styles.platformLogo} ${styles[`logo_${id}`]}`}>
                      <Icon />
                    </span>
                    <div className={styles.platformName}>{name}</div>
                    <div className={styles.platformDesc}>{desc}</div>
                    <span className={`${styles.platformCheck} ${styles[`check_${id}`]}`}>
                      <IcoCheck />
                    </span>
                  </button>
                ))}
              </div>

              <div className={styles.hint}>You can change this anytime in settings.</div>
            </>
          )}

          {/* ── Step 3: Keywords ── */}
          {step === 3 && (
            <>
              <h1 className={styles.h}>What should Filo look for?</h1>
              <p className={styles.sub}>We've drafted starters from your product description. Edit freely — this is your dictionary.</p>

              <div className={styles.kwTabs}>
                {KW_TABS.map((t) => (
                  <button
                    key={t.id}
                    className={`${styles.kwTab} ${kwTab === t.id ? styles.kwTabActive : ""}`}
                    onClick={() => setKwTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {kwLoading ? (
                <div className={styles.kwLoading}>Generating keywords…</div>
              ) : (
                <div className={styles.kwArea}>
                  {keywords[kwTab].map((kw) => (
                    <span key={kw} className={styles.kwPill}>
                      {kw}
                      <button className={styles.pillX} onClick={() => removeKeyword(kw)}>×</button>
                    </span>
                  ))}
                  <input
                    ref={kwInputRef}
                    className={styles.kwAddInput}
                    placeholder="+ add keyword"
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
                    }}
                    onBlur={addKeyword}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className={styles.foot}>
          <button
            className={styles.backBtn}
            onClick={() => step > 1 && setStep((s) => (s - 1) as Step)}
            style={{ visibility: step === 1 ? "hidden" : "visible" }}
          >
            ← Back
          </button>
          {step < 3 ? (
            <button
              className={styles.continueBtn}
              disabled={!canAdvance()}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Continue →
            </button>
          ) : (
            <button className={styles.launchBtn} onClick={finish}>
              Start Finding Leads →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
