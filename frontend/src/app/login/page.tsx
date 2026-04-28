"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

function IcoX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function IcoFb() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function proceed(method: "x" | "facebook" | "email") {
    try {
      localStorage.setItem("authMethod", method);
      if (method === "x" || method === "facebook") {
        localStorage.setItem("selectedPlatforms", method);
      }
    } catch {}
    router.push("/onboarding");
  }

  return (
    <div className={styles.stage}>
      {/* Floating blobs */}
      <div className={`${styles.blob} ${styles.b1}`} />
      <div className={`${styles.blob} ${styles.b2}`} />
      <div className={`${styles.blob} ${styles.b3}`} />

      <div className={styles.card}>
        <div className={styles.wordmark}>
          filo<span className={styles.dot} />
        </div>
        <p className={styles.tagline}>Find your buyers. Before your competitors do.</p>

        <div className={styles.actions}>
          <button className={`${styles.platformBtn} ${styles.xBtn}`} onClick={() => proceed("x")}>
            <IcoX /> Continue with X
          </button>
          <button className={`${styles.platformBtn} ${styles.fbBtn}`} onClick={() => proceed("facebook")}>
            <IcoFb /> Continue with Facebook
          </button>

          <div className={styles.divider}><span>or</span></div>

          <input
            className={styles.emailInput}
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && email.trim() && proceed("email")}
          />
          <button
            className={styles.emailBtn}
            onClick={() => email.trim() && proceed("email")}
          >
            Continue with email
          </button>
        </div>

        <div className={styles.foot}>Built on RedRover by Clover Labs</div>
      </div>
    </div>
  );
}
