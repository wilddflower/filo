"use client";

import { useState, useEffect, useCallback } from "react";
import type { Lead, Tone } from "@/lib/types";
import { generateReply } from "@/lib/api";
import type { FounderProfile } from "@/lib/types";
import { isSaved, saveLead, unsaveLead } from "@/lib/savedLeads";
import styles from "./LeadDetail.module.css";

interface Props { lead: Lead | null; onDismiss?: () => void; onClose?: () => void; }
type Tab = "reply" | "dm";

const STORAGE_KEY = "founderProfile";

function loadProfile(): FounderProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function LeadDetail({ lead, onDismiss, onClose }: Props) {
  const [tone, setTone] = useState<Tone>("helpful");
  const [tab, setTab] = useState<Tab>("reply");
  const [replyText, setReplyText] = useState("");
  const [humanityScore, setHumanityScore] = useState(0);
  const [humanityNote, setHumanityNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noProfile, setNoProfile] = useState(false);
  const [saved, setSaved] = useState(false);

  const generate = useCallback(async (currentLead: Lead, currentTone: Tone, currentTab: Tab) => {
    const profile = loadProfile();
    setNoProfile(false);
    setGenerating(true);
    try {
      const result = await generateReply({
        postText: currentLead.post,
        authorName: currentLead.name,
        authorBio: currentLead.bio,
        recentPosts: currentLead.recentPosts,
        tone: currentTone,
        tab: currentTab,
        founderProfile: profile,
      });
      setReplyText(result.text);
      setHumanityScore(result.humanityScore);
      setHumanityNote(result.humanityNote);
    } catch {
      setReplyText("Couldn't generate reply — check that the backend is running.");
    } finally {
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    if (!lead) return;
    setTone("helpful");
    setTab("reply");
    setCopied(false);
    setHumanityScore(0);
    setHumanityNote("");
    setSaved(isSaved(lead.id));
    generate(lead, "helpful", "reply");
  }, [lead?.id]);

  function handleSave() {
    if (!lead) return;
    if (saved) { unsaveLead(lead.id); setSaved(false); }
    else { saveLead(lead); setSaved(true); }
  }

  function handleTone(t: Tone) {
    setTone(t);
    if (lead) generate(lead, t, tab);
  }

  function handleTab(t: Tab) {
    setTab(t);
    if (lead) generate(lead, tone, t);
  }

  function handleCopy() {
    navigator.clipboard?.writeText(replyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!lead) return null;

  const highlight = (text: string) => {
    let result = text;
    lead.matched.forEach((kw) => {
      result = result.replace(new RegExp(`(${kw})`, "gi"), `<mark>$1</mark>`);
    });
    return result;
  };

  const scoreClass = lead.scoreTier === "hi" ? styles.scoreHi : lead.scoreTier === "md" ? styles.scoreMd : styles.scoreLo;
  const charLimit = tab === "dm" ? 500 : 280;

  return (
    <div className={styles.panel}>

      {/* Close button */}
      {onClose && (
        <button className={styles.closeBtn} onClick={onClose} title="Close">✕</button>
      )}

      {/* Person header */}
      <div className={styles.header}>
        <div
          className={styles.avatar}
          style={{ background: `linear-gradient(135deg, oklch(0.7 0.12 ${lead.avatarHue}), oklch(0.5 0.14 ${lead.avatarHue + 20}))` }}
        >
          {lead.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </div>
        <div className={styles.personInfo}>
          <div className={styles.personName}>{lead.name}</div>
          <div className={styles.personSub}>
            {lead.platform === "facebook" ? lead.groupName ?? lead.handle : `@${lead.handle}`}
            {lead.followers ? ` · ${lead.followers} followers` : ""}
          </div>
          {lead.bio && <div className={styles.personBio}>{lead.bio}</div>}
        </div>
        <div className={`${styles.scoreBadge} ${scoreClass}`}>
          <span className={styles.scoreNum}>{lead.score}</span>
          <span className={styles.scoreSub}>/10</span>
        </div>
        <button className={`${styles.saveBtn} ${saved ? styles.saveBtnActive : ""}`} onClick={handleSave} title={saved ? "Remove from saved" : "Track this"}>
          {saved ? "★" : "☆"}
        </button>
        {onDismiss && (
          <button className={styles.dismissBtn} onClick={onDismiss} title="Dismiss lead">✕</button>
        )}
      </div>

      <div className={styles.divider} />

      {/* Post */}
      <div
        className={styles.postText}
        dangerouslySetInnerHTML={{ __html: highlight(lead.post) }}
      />

      {/* Signal chips */}
      <div className={styles.signals}>
        {lead.rationale.slice(0, 3).map((r, i) => (
          <span key={i} className={styles.signal}>
            <span className={styles.signalTag}>{r.tag}</span>
            {r.text}
          </span>
        ))}
      </div>

      <div className={styles.divider} />

      {/* Reply section */}
      <div className={styles.replySection}>
        <div className={styles.replyHeader}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === "reply" ? styles.tabActive : ""}`} onClick={() => handleTab("reply")}>Reply</button>
            <button className={`${styles.tab} ${tab === "dm" ? styles.tabActive : ""}`} onClick={() => handleTab("dm")}>DM</button>
          </div>
          <div className={styles.tones}>
            {(["helpful", "informative", "promotional"] as Tone[]).map((t) => (
              <button
                key={t}
                className={`${styles.tone} ${tone === t ? styles.toneActive : ""}`}
                onClick={() => handleTone(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {noProfile ? (
          <div className={styles.noProfile}>
            <a href="/settings" className={styles.noProfileLink}>Set up your founder profile in Settings</a>
            {" "}to generate replies in your voice.
          </div>
        ) : (
          <>
            <textarea
              className={`${styles.textarea} ${generating ? styles.textareaLoading : ""}`}
              value={generating ? "Drafting in your voice…" : replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
              disabled={generating}
            />

            {humanityScore > 0 && (
              <div className={styles.humanityBar}>
                <span className={styles.humanityLabel}>Human score</span>
                <span
                  className={styles.humanityScore}
                  data-tier={humanityScore >= 7 ? "hi" : humanityScore >= 4 ? "md" : "lo"}
                >
                  {humanityScore}/10
                </span>
                <span className={styles.humanityNote}>{humanityNote}</span>
              </div>
            )}

            <div className={styles.replyFooter}>
              <button className={styles.regenBtn} onClick={() => generate(lead, tone, tab)} disabled={generating}>
                {generating ? "…" : "✦ Regenerate"}
              </button>
              <span className={`${styles.counter} ${replyText.length > charLimit ? styles.counterOver : ""}`}>
                {generating ? "" : `${replyText.length}/${charLimit}`}
              </span>
              <button className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`} onClick={handleCopy} disabled={generating}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </>
        )}

        <p className={styles.disclaimer}>Filo never posts automatically — paste into X to send.</p>
      </div>
    </div>
  );
}
