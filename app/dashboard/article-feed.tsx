"use client";

import styles from "./dashboard.module.css";

type FeedArticle = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  topicName: string;
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
  return `${Math.floor(hours / 24)} j ${Math.round(hours % 24)} h`;
}

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

  const now = Date.now();

  return (
    <div className={styles.articleGrid}>
      {articles.map((article, i) => {
        const hours = (now - new Date(article.publishedAt).getTime()) / 3600000;
        const fresh = Math.max(0, Math.min(1, 1 - hours / 72));
        const color = mixColor("#4a473f", "#8b7cf6", fresh);
        const archived = hours >= 72;

        return (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.articleCard}
            style={{
              opacity: archived ? 0.55 : 1,
              animationDelay: `${(i % 12) * 0.04}s`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div className={styles.articleSource}>{article.sourceName}</div>
              <div className={styles.articleTitle}>{article.title}</div>
            </div>

            <div className={styles.gaugeRow}>
              <div className={styles.gaugeLabel}>FRAÎCHEUR</div>
              <div className={styles.gaugeTrack}>
                <div
                  className={styles.gaugeDot}
                  style={{ left: `${(fresh * 100).toFixed(1)}%` }}
                />
              </div>
            </div>

            <div className={styles.articleFooter}>
              <span className={styles.articleTag}>{article.topicName}</span>
              <span className={styles.articleAge} style={{ color }}>
                {ageLabel(hours)}
                {archived ? " (archivé)" : ""}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
