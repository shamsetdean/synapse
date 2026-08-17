"use client";

import { createClient } from "@/lib/supabase/client";
import styles from "../landing.module.css";
import loginStyles from "./login.module.css";

export default function LoginPage() {
  const supabase = createClient();

  async function signInWith(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className={styles.page}>
      <div className={loginStyles.center}>
        <div className={loginStyles.card}>
          <div className={loginStyles.logoRow}>
            <svg width="26" height="26" viewBox="0 0 26 26">
              <line x1="5" y1="5" x2="19" y2="5" stroke="var(--lavender)" strokeWidth="1.6" />
              <line x1="19" y1="5" x2="5" y2="19" stroke="var(--lavender)" strokeWidth="1.6" />
              <line x1="5" y1="19" x2="19" y2="19" stroke="var(--lavender)" strokeWidth="1.6" />
              <circle cx="5" cy="5" r="3" fill="var(--lavender-light)" />
              <circle cx="19" cy="5" r="3" fill="var(--violet-soft)" />
              <circle cx="5" cy="19" r="3" fill="var(--violet-soft)" />
              <circle cx="19" cy="19" r="3" fill="var(--lavender-light)" />
            </svg>
            Synapse
          </div>
          <p className={loginStyles.subtitle}>
            Connectez-vous pour accéder à votre espace de veille
          </p>
          <button
            onClick={() => signInWith("google")}
            className={loginStyles.providerBtn}
          >
            Continuer avec Google
          </button>
          <button
            onClick={() => signInWith("github")}
            className={loginStyles.providerBtn}
          >
            Continuer avec GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
