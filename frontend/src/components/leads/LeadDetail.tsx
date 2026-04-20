"use client";

import { useState, useEffect } from "react";
import type { Lead, Tone } from "@/lib/types";
import { REPLY_TEMPLATES, DM_TEMPLATES } from "@/lib/data/mockLeads";
import styles from "./LeadDetail.module.css";

interface Props {
  lead: Lead | null;
}

type Tab = "reply" | "dm" | "save";

export function LeadDetail({ lead }: Props) {
  const [tab, setTab] = useState<Tab>("reply");
  const [tone, setTone] = useState<Tone>("helpful");
  const [replyIdx, setReplyIdx] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setTab("reply");
    setTone("helpful");
    setReplyIdx(0);
    setFeedback(null);
    setSent(false);
    setNote("");
  }, [lead?.id]);

  useEffect(() => {
    if (!lead) return;
    const templates = REPLY_TEMPLATES[tone];
    const tpl = templates[replyIdx % templates.length];
    const competitor = lead.matched.find((m) =>
      /social|hootsuite|brandwatch|mention|buffer|sprout/i.test(m)
    ) ?? "Sprout Social";
    setReplyText(tpl.replace(/\{\{competitor\}\}/g, competitor));
  }, [lead?.id, tone, replyIdx]);

  if (!lead) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyInner}>
          <div className={styles.emptyIcon}>👁</div>
          <h3>Select a lead to review</h3>
          <p>The detail panel shows the post, intent rationale, and an AI-drafted reply.</p>
        </div>
      </div>
    );
  }

  const confLabel = lead.confidence === "high" ? "High confidence" : lead.confidence === "med" ? "Medium confidence" : "Low confidence";
  const dmText = DM_TEMPLATES[tone];
  const activeText = tab === "dm" ? dmText : replyText;
  const charLimit = tab === "dm" ? 500 : 280;
  const over = activeText.length > charLimit;

  const highlight = (text: string) => {
    let result = text;
    lead.matched.forEach((kw) => {
      result = result.replace(
        new RegExp(`(${kw})`, "gi"),
        `<mark>$1</mark>`
      );
    });
    return result;
  };

  return (
    <div className={styles.detail}>
      {/* Post context */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Post</h4>
        <div className={styles.postCard}>
          <div className={styles.postHeader}>
            <div
              className={styles.avatarLg}
              style={{ background: `linear-gradient(135deg, oklch(0.7 0.12 ${lead.avatarHue}), oklch(0.5 0.14 ${lead.avatarHue + 20}))` }}
            >
              {lead.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className={styles.postName}>{lead.name}</div>
              <div className={styles.postHandle}>@{lead.handle} · {lead.followers} followers</div>
            </div>
            <div className={styles.postTime}>{lead.timestamp}</div>
          </div>
          <div
            className={styles.postBody}
            dangerouslySetInnerHTML={{ __html: highlight(lead.post) }}
          />
          <div className={styles.engagement}>
            <span>♥ {lead.hearts}</span>
            <span>↩ {lead.reposts}</span>
            <span>💬 {lead.replies}</span>
            <a href="#" onClick={(e) => e.preventDefault()} className={styles.viewOnX}>
              View on X ↗
            </a>
          </div>
        </div>
        {lead.bio && (
          <div className={styles.bioCard}>
            <div>{lead.bio}</div>
            <div className={styles.bioRow}>
              {lead.location && <span>📍 {lead.location}</span>}
              {lead.website && <span>🔗 {lead.website}</span>}
            </div>
          </div>
        )}
      </section>

      {/* Intent analysis */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Intent analysis</h4>
        <div className={styles.intentRow}>
          <div className={styles.scoreBig}>
            <span className={`${styles.scoreNum} ${lead.scoreTier === "hi" ? styles.hi : lead.scoreTier === "md" ? styles.md : styles.lo}`}>
              {lead.score}
            </span>
            <span className={styles.scoreDenom}>/10</span>
          </div>
          <div className={styles.intentRight}>
            <div className={styles.intentMeta}>
              <span className={`${styles.conf} ${styles[lead.confidence]}`}>{confLabel}</span>
              {lead.matched.map((m) => (
                <span key={m} className={styles.matchPill}>{m}</span>
              ))}
            </div>
            <div className={styles.rationaleLabel}>Why this score</div>
            <ul className={styles.rationale}>
              {lead.rationale.map((r, i) => (
                <li key={i}>
                  <span className={styles.rationaleCheck}>✓</span>
                  <span><strong>{r.tag}:</strong> {r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className={styles.feedbackRow}>
          <span>Was this score accurate?</span>
          <div className={styles.thumbs}>
            <button
              className={`${styles.thumb} ${feedback === "up" ? styles.thumbUp : ""}`}
              onClick={() => setFeedback("up")}
            >👍</button>
            <button
              className={`${styles.thumb} ${feedback === "down" ? styles.thumbDown : ""}`}
              onClick={() => setFeedback("down")}
            >👎</button>
          </div>
        </div>
      </section>

      {/* Action */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Action</h4>
        <div className={styles.tabBar}>
          {(["reply", "dm", "save"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`${styles.tabBtn} ${tab === t ? styles.tabActive : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "reply" ? "↩ Reply" : t === "dm" ? "✉ Direct message" : "🔖 Save & notes"}
            </button>
          ))}
        </div>

        {tab !== "save" && (
          <>
            <div className={styles.toneRow}>
              {(["helpful", "informative", "promotional"] as Tone[]).map((t) => (
                <button
                  key={t}
                  className={`${styles.toneChip} ${tone === t ? styles.toneActive : ""}`}
                  onClick={() => setTone(t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button className={styles.regenBtn} onClick={() => setReplyIdx((i) => i + 1)}>
                ✦ Regenerate
              </button>
            </div>
            <textarea
              className={styles.textarea}
              value={activeText}
              onChange={(e) => tab === "reply" && setReplyText(e.target.value)}
              rows={tab === "dm" ? 6 : 5}
            />
            <div className={styles.replyToolbar}>
              <button
                className={styles.copyBtn}
                onClick={() => navigator.clipboard?.writeText(activeText)}
              >
                Copy to clipboard
              </button>
              <span className={`${styles.counter} ${over ? styles.counterWarn : ""}`}>
                {activeText.length} / {charLimit}
              </span>
            </div>
            {tab === "reply" ? (
              <>
                <div className={styles.noAutoNote}>RedRover never posts automatically. Copy and paste into X to send.</div>
                <label className={`${styles.sentCheck} ${sent ? styles.sentChecked : ""}`}>
                  <input type="checkbox" checked={sent} onChange={(e) => setSent(e.target.checked)} />
                  I sent this reply
                </label>
              </>
            ) : (
              <div className={styles.noAutoNote}>DMs must be sent manually from X. RedRover does not have DM access.</div>
            )}
          </>
        )}

        {tab === "save" && (
          <div className={styles.savePane}>
            <label className={styles.inputLabel}>Private notes</label>
            <textarea
              className={styles.textarea}
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a private note about this lead…"
            />
            <button className={styles.saveBtn}>🔖 Save lead</button>
          </div>
        )}
      </section>
    </div>
  );
}
