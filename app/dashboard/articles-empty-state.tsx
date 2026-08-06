"use client";

import { useDashboardNav } from "./dashboard-shell";
import styles from "./dashboard.module.css";

// État vide de la vue Articles, repris à l'identique de la charte : cadre en
// pointillé, titre, explication, et bouton menant à la création d'un sujet.
export default function ArticlesEmptyState() {
  const goTo = useDashboardNav();

  return (
    <div className={styles.emptyBlock}>
      <div className={styles.emptyTitle}>Aucun article pour l&apos;instant</div>
      <div className={styles.emptyText}>
        Un article n&apos;apparaît ici que s&apos;il correspond à au moins un de
        vos sujets de veille. Commencez par créer un sujet.
      </div>
      <button
        type="button"
        onClick={() => goTo("topics")}
        className={styles.emptyCta}
      >
        Créer un sujet
      </button>
    </div>
  );
}
