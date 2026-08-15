"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  // Masqués par défaut : la fraîcheur perd son sens au-delà de 72h, et le
  // flux mélangeait des articles vieux de plusieurs centaines de jours à
  // des articles du jour. Le bouton permet de les faire réapparaître sans
  // recharger la page.
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = useMemo(
    () => articles.filter((article) => article.ageHours >= 72).length,
    [articles],
  );
  const visibleArticles = useMemo(
    () =>
      showArchived
        ? articles
        : articles.filter((article) => article.ageHours < 72),
    [articles, showArchived],
  );

  const groups = groupByTopic(visibleArticles);

  // Animation d'entrée pilotée par le scroll : IntersectionObserver plutôt
  // que animation-timeline: view() (support Safari encore inégal, et déjà
  // source de bugs de rendu sur iOS ailleurs dans les projets Anthropotech).
  // Chaque carte n'est révélée qu'une fois puis désobservée ; la classe est
  // posée après montage pour ne jamais diverger entre rendu serveur et
  // hydratation.
  // Map plutôt qu'un tableau réinitialisé en render : les callback refs sont
  // posés au commit (pas pendant le rendu), donc rien n'écrit dans le ref
  // avant que React n'ait fini de rendre.
  const cardMap = useRef<Map<string, HTMLAnchorElement>>(new Map());
  function registerCard(id: string) {
    return (el: HTMLAnchorElement | null) => {
      if (el) cardMap.current.set(id, el);
      else cardMap.current.delete(id);
    };
  }

  useEffect(() => {
    const cards = Array.from(cardMap.current.values());
    if (typeof IntersectionObserver === "undefined") {
      cards.forEach((el) => el.classList.add(styles.articleCardInView));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.articleCardInView);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    cards.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleArticles]);

  return (
    <div className={styles.articleFeedRoot}>
      <div className={styles.articleFilterBar}>
        <span className={styles.sectionCount}>
          {visibleArticles.length} correspondance
          {visibleArticles.length > 1 ? "s" : ""} affichée
          {visibleArticles.length > 1 ? "s" : ""}
        </span>
        {archivedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`${styles.editToggle} ${
              showArchived ? styles.editToggleActive : ""
            }`}
          >
            {showArchived
              ? `Masquer les archivés (${archivedCount})`
              : `Afficher les archivés (${archivedCount})`}
          </button>
        )}
      </div>

      {visibleArticles.length === 0 ? (
        <div className={styles.emptyBlock}>
          <div className={styles.emptyTitle}>Rien de récent en ce moment</div>
          <div className={styles.emptyText}>
            Tous les articles collectés ont plus de 72 heures. Clique sur
            « Afficher les archivés » ci-dessus pour les revoir.
          </div>
        </div>
      ) : (
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
                      ref={registerCard(article.id)}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.articleCard} ${
                        archived ? styles.articleCardArchived : ""
                      }`}
                      style={{ transitionDelay: `${(index % 6) * 0.05}s` }}
                    >
                      <div className={styles.articleSource}>
                        {article.sourceName}
                      </div>
                      <div className={styles.articleTitle}>
                        {article.title}
                      </div>

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
      )}
    </div>
  );
}
