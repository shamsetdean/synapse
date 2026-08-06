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
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bl = Math.round(lerp(a[2], b[2], t));
  return `rgb(${r},${g},${bl})`;
}

function ageLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.floor(hours / 24)} j`;
}

const COLUMN_COUNT = 3;

export default function ArticleFeed({
  articles,
}: {
  articles: FeedArticle[];
}) {
  if (articles.length === 0) {
    return (
      <p className={styles.emptyState}>
        Aucun article pour l&apos;instant. L&apos;ingestion n&apos;a peut-être
        pas encore trouvé de correspondance avec vos mots-clés.
      </p>
    );
  }

  const columns: FeedArticle[][] = Array.from({ length: COLUMN_COUNT }, () => []);
  articles.forEach((article, i) => {
    columns[i % COLUMN_COUNT].push(article);
  });

  return (
    <div className={styles.neuronColumns}>
      {columns.map((columnArticles, colIndex) => (
        <div key={colIndex} className={styles.neuronColumn}>
          {columnArticles.map((article, rowIndex) => {
            const hours = article.ageHours;
            const fresh = Math.max(0, Math.min(1, 1 - hours / 72));
            const dotColor = mixColor("#4a473f", "#8b7cf6", fresh);
            const archived = hours >= 72;
            const isLast = rowIndex === columnArticles.length - 1;

            return (
              <div key={article.id} className={styles.neuronRowWrap} style={{ opacity: archived ? 0.55 : 1 }}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.neuronPill}
                >
                  <span className={styles.neuronRowTitle}>{article.title}</span>
                  <span className={styles.neuronRowMeta}>
                    {article.sourceName} · {ageLabel(hours)}
                  </span>
                </a>

                <div className={styles.neuronRail}>
                  {!isLast && <div className={styles.neuronRailLine} />}
                  <span className={styles.neuronDot} style={{ background: dotColor }} />
                </div>
              </div>
            );
          })}

          {columnArticles.length > 1 && (
            <div
              className={styles.neuronPulse}
              style={{ animationDelay: `${colIndex * 0.6}s` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
