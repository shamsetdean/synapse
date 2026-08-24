"use client";

import { useEffect } from "react";
import type { FeedArticle } from "./article-feed";
import { ageLabel, freshnessColor } from "./freshness";
import styles from "./dashboard.module.css";

// Fiche article ouverte au clic sur un grain de la vue sphère (cahier des
// charges §3.4/§3.5) : titre, source, sujet, horodatage, résumé court, jauge
// FRAÎCHEUR identique à la vue liste (voir freshness.ts), et les mêmes
// actions ✓/✕ que les cards existantes — pas de nouvelle action "marquer
// lu", ce registre n'existe pas côté données (voir stats-panel.tsx : "Total
// lu" reste "Registre non alimenté").
export default function ArticleDetailPanel({
  article,
  topicColor,
  isFavorited,
  isPending,
  disabled,
  onToggleFavorite,
  onDismiss,
  onClose,
}: {
  article: FeedArticle | null;
  topicColor: string;
  isFavorited: boolean;
  isPending: boolean;
  disabled: boolean;
  onToggleFavorite: () => void;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const open = article !== null;

  // Échap ferme le panneau, comme tout panneau latéral de l'application.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const fresh = article ? Math.max(0, Math.min(1, 1 - article.ageHours / 72)) : 0;
  const gaugeColor = article ? freshnessColor(article.ageHours) : "transparent";

  return (
    <>
      <div
        className={`${styles.detailScrim} ${open ? styles.detailScrimOpen : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id="articleDetailPanel"
        className={`${styles.detailPanel} ${open ? styles.detailPanelOpen : ""}`}
        aria-hidden={!open}
        aria-label="Détail de l'article"
      >
        {article && (
          <>
            <div className={styles.detailHead}>
              <div className={styles.detailTopic}>
                <span
                  className={styles.detailTopicDot}
                  style={{ background: topicColor }}
                  aria-hidden="true"
                />
                {article.topicName || "Sans sujet"}
              </div>
              <div className={styles.detailHeadRight}>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer le détail"
                  className={styles.detailCloseBtn}
                >
                  ✕
                </button>
                {article.language && (
                  <span className={styles.detailLangBadge} title="Langue de l'article">
                    {article.language.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.detailBody}>
              <h3 className={styles.detailTitle}>{article.title}</h3>
              <div className={styles.detailMeta}>
                {article.sourceName} · il y a {ageLabel(article.ageHours)}
              </div>

              {article.summary && (
                <p className={styles.detailSummary}>{article.summary}</p>
              )}

              <div className={styles.gaugeRow}>
                <div className={styles.gaugeLabel}>FRAÎCHEUR</div>
                <div className={styles.gaugeTrack}>
                  <div
                    className={styles.gaugeFill}
                    style={{ width: `${(fresh * 100).toFixed(0)}%`, background: gaugeColor }}
                  />
                </div>
              </div>
            </div>

            <div className={styles.detailActions}>
              <button
                type="button"
                disabled={isPending || disabled}
                onClick={onToggleFavorite}
                aria-pressed={isFavorited}
                aria-label={isFavorited ? "Retirer des favoris" : "Garder cet article"}
                className={`${styles.thumbBtn} ${styles.detailActionBtn} ${
                  isFavorited ? styles.thumbBtnActive : ""
                }`}
              >
                <span aria-hidden="true">✓</span>
                {isFavorited ? "Gardé" : "Garder"}
              </button>
              <button
                type="button"
                disabled={isPending || disabled}
                onClick={onDismiss}
                aria-label="Retirer, ne m'intéresse pas"
                className={`${styles.thumbBtn} ${styles.thumbBtnDismiss} ${styles.detailActionBtn}`}
              >
                <span aria-hidden="true">✕</span>
                Écarter
              </button>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.detailSourceLink}
              >
                Ouvrir la source ↗
              </a>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
