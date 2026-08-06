"use client";

import { useState, type ReactNode } from "react";
import styles from "./dashboard.module.css";

// La charte scinde la Configuration en deux onglets. Le contenu de chacun est
// construit côté serveur et passé en propriété : seul l'état de l'onglet actif
// vit ici.
export default function ConfigView({
  stats,
  sources,
}: {
  stats: ReactNode;
  sources: ReactNode;
}) {
  const [tab, setTab] = useState<"stats" | "sources">("stats");

  return (
    <>
      <div className={styles.configHead}>
        <h2 className={styles.sectionH2}>Configuration</h2>
        <div className={styles.configTabs}>
          <button
            type="button"
            onClick={() => setTab("stats")}
            aria-current={tab === "stats" ? "true" : undefined}
            className={`${styles.configTab} ${
              tab === "stats" ? styles.configTabActive : ""
            }`}
          >
            Statistiques
          </button>
          <button
            type="button"
            onClick={() => setTab("sources")}
            aria-current={tab === "sources" ? "true" : undefined}
            className={`${styles.configTab} ${
              tab === "sources" ? styles.configTabActive : ""
            }`}
          >
            Sources connectées
          </button>
        </div>
      </div>

      {tab === "stats" ? stats : sources}
    </>
  );
}
