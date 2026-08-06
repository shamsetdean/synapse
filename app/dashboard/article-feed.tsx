"use client";

import styles from "./dashboard.module.css";

type FeedArticle = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  topicName: string;
  // Âge en heures, calculé côté serveur dans app/dashboard/page.tsx.
  // Le calculer ici avec Date.now() rendait le composant impur : le rendu
  // serveur et l'hydratation produisaient deux valeurs différentes, donc une
  // couleur de fraîcheur et un libellé d'âge potentiellement divergents.
  ageHours: number;
};

// Interpolation de couleur de la charte, entre l'extrémité froide et
// l'accent, sur une fenêtre de soixante-douze heures.
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixColor(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(
    lerp(a[1], b[1], t),
  )},${Math.round(lerp(a[2], b[2], t))})`;
}

// Format de la charte : minutes en deçà d'une heure, heures en deçà d'un
// jour, puis jours et heures.
function ageLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.floor(hours / 24)} j ${Math.round(hours % 24)} h`;
}

export default function ArticleFeed({
  articles,
}: {
  articles: FeedArticle[];
}) {
  return (
    <div className={styles.articleGrid}>
      {articles.map((article, i) => {
        const fresh = Math.max(0, Math.min(1, 1 - article.ageHours / 72));
        const color = mixColor("#4a473f", "#8b7cf6", fresh);
        const archived = article.ageHours >= 72;

        return (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.articleCard} ${
              archived ? styles.articleCardArchived : ""
            }`}
            style={{ animationDelay: `${(i % 12) * 0.04}s` }}
          >
            <div className={styles.articleSource}>{article.sourceName}</div>
            <div className={styles.articleTitle}>{article.title}</div>

            <div className={styles.gaugeRow}>
              <div className={styles.gaugeLabel}>FRAÎCHEUR</div>
              <div className={styles.gaugeTrack}>
                <div
                  className={styles.gaugeFill}
                  style={{
                    width: `${(fresh * 100).toFixed(0)}%`,
                    background: color,
                  }}
                />
              </div>
            </div>

            <div className={styles.articleAgeRow}>
              <span className={styles.articleAge} style={{ color }}>
                {ageLabel(article.ageHours)}
                {archived ? " (archivé)" : ""}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
