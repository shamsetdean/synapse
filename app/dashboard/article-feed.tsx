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

// Regroupe les articles par sujet de veille en conservant l'ordre de
// première apparition (donc, du sujet le plus récemment alimenté) et l'ordre
// décroissant de date déjà appliqué par la requête serveur à l'intérieur de
// chaque groupe. "Sans sujet" est toujours relégué en fin de liste, même si
// l'article sans sujet le plus récent est le tout premier du flux — sinon un
// article mal étiqueté prendrait la première place.
// Chaque article reçoit un index global (et non un index local au groupe)
// afin que la cadence de l'animation d'entrée reste la même qu'auparavant.
function groupByTopic(articles: FeedArticle[]) {
  const order: string[] = [];
  const buckets = new Map<string, FeedArticle[]>();
  for (const article of articles) {
    const key = article.topicName || "Sans sujet";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(article);
  }
  order.sort((a, b) => {
    if (a === "Sans sujet") return 1;
    if (b === "Sans sujet") return -1;
    return 0;
  });
  let globalIndex = 0;
  return order.map((name) => ({
    name,
    items: buckets.get(name)!.map((article) => ({
      article,
      index: globalIndex++,
    })),
  }));
}

export default function ArticleFeed({
  articles,
}: {
  articles: FeedArticle[];
}) {
  const groups = groupByTopic(articles);

  return (
    <div className={styles.topicGroups}>
      {groups.map((group) => (
        <section key={group.name} className={styles.topicGroup}>
          <div className={styles.topicGroupHead}>
            <h3 className={styles.topicGroupName}>{group.name}</h3>
            <span className={styles.topicGroupCount}>
              {group.items.length} article
              {group.items.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className={styles.articleGrid}>
            {group.items.map(({ article, index }) => {
              const fresh = Math.max(
                0,
                Math.min(1, 1 - article.ageHours / 72),
              );
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
                  style={{ animationDelay: `${(index % 12) * 0.04}s` }}
                >
                  <div className={styles.articleSource}>
                    {article.sourceName}
                  </div>
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
        </section>
      ))}
    </div>
  );
}
