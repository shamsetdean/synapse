"use client";

import styles from "./dashboard.module.css";

// Les tracés et rayons sont repris à l'identique du fichier de charte. Les
// couleurs pointent vers les jetons de la charte v2 (app/globals.css) via
// var(--sy-...) directement dans les attributs SVG, résolus par le
// navigateur comme n'importe quelle valeur CSS d'attribut de présentation.

const PAGES = [
  { key: "articles", name: "Articles" },
  { key: "topics", name: "Sujets de veille" },
  { key: "config", name: "Configuration" },
] as const;

export type DashboardPageKey = (typeof PAGES)[number]["key"];

const SEGMENT_PATHS: Record<DashboardPageKey, string> = {
  articles: "M 32 1.5 A 30.5 30.5 0 0 1 58.4 47 L 43.9 38.5 A 14.5 14.5 0 0 0 32 17.5 Z",
  topics: "M 58.4 47 A 30.5 30.5 0 0 1 5.6 47 L 20.1 38.5 A 14.5 14.5 0 0 0 43.9 38.5 Z",
  config: "M 5.6 47 A 30.5 30.5 0 0 1 32 1.5 L 32 17.5 A 14.5 14.5 0 0 0 20.1 38.5 Z",
};

export default function NavRing({
  activePage,
  onChange,
}: {
  activePage: DashboardPageKey;
  onChange: (page: DashboardPageKey) => void;
}) {
  return (
    <div className={styles.nav}>
      <div className={styles.navLegends}>
        {PAGES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            aria-current={activePage === p.key ? "page" : undefined}
            className={`${styles.navLegend} ${
              activePage === p.key ? styles.navLegendActive : ""
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className={styles.navRingWrap}>
        {/* Anneau tournant décoratif. Il ne capte aucun clic. */}
        <svg
          width="104"
          height="104"
          viewBox="0 0 64 64"
          className={styles.navSpinner}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="navSpinGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--sy-accent-gradient-from)" stopOpacity="0" />
              <stop offset="60%" stopColor="var(--sy-accent-gradient-from)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--sy-accent-gradient-to)" />
            </linearGradient>
          </defs>
          <circle
            cx="32"
            cy="32"
            r="31.5"
            fill="none"
            stroke="url(#navSpinGrad)"
            strokeWidth="2.4"
            strokeDasharray="26 173"
            strokeLinecap="round"
          />
        </svg>

        {/* Les trois segments restent cliquables comme dans la charte. La
            navigation au clavier passe par les légendes ci-dessus, qui sont
            de vrais boutons : un tracé SVG ne peut pas recevoir le focus. */}
        <svg
          width="104"
          height="104"
          viewBox="0 0 64 64"
          className={styles.navSegments}
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="navRingGrad"
              gradientUnits="userSpaceOnUse"
              x1="4"
              y1="4"
              x2="60"
              y2="60"
            >
              <stop offset="0%" stopColor="var(--sy-accent-text)" />
              <stop offset="55%" stopColor="var(--sy-accent-gradient-from)" />
              <stop offset="100%" stopColor="var(--sy-accent-gradient-to)" />
            </linearGradient>
          </defs>

          {PAGES.map((p) => (
            <path
              key={p.key}
              d={SEGMENT_PATHS[p.key]}
              fill={activePage === p.key ? "url(#navRingGrad)" : "var(--sy-border-strong)"}
              onClick={() => onChange(p.key)}
              className={styles.navSegment}
            />
          ))}

          <circle
            cx="32"
            cy="32"
            r="14"
            fill="var(--sy-ring-center)"
            stroke="var(--sy-border)"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}
