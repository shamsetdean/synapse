"use client";

import styles from "./dashboard.module.css";

// Structure reprise de synapse-structure-composants-v2.md, section 1 : dock
// flottant en bas de l'écran, remplace l'ancien anneau/roue SVG. Couleurs
// via les jetons de la charte v2 (app/globals.css), comme le reste du
// dashboard.

const PAGES = [
  { key: "articles", name: "ARTICLES" },
  { key: "topics", name: "SUJETS" },
  { key: "config", name: "CONFIG" },
] as const;

export type DashboardPageKey = (typeof PAGES)[number]["key"];

export default function NavRing({
  activePage,
  onChange,
}: {
  activePage: DashboardPageKey;
  onChange: (page: DashboardPageKey) => void;
}) {
  return (
    <>
      {/* Fondu sous le dock : évite que le contenu défilant soit coupé net
          derrière lui. Purement décoratif. */}
      <div className={styles.navFade} aria-hidden="true" />

      <nav className={styles.navDock} aria-label="Navigation du tableau de bord">
        {PAGES.map((p) => {
          const isActive = activePage === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(p.key)}
              aria-current={isActive ? "page" : undefined}
              className={`${styles.navDockBtn} ${
                isActive ? styles.navDockBtnActive : ""
              }`}
            >
              <span className={styles.navDockDot} aria-hidden="true" />
              {p.name}
            </button>
          );
        })}
      </nav>
    </>
  );
}
