"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useAnimatedNumber } from "./use-animated-number";
import AgeFilterDial from "./age-filter-dial";
import { ageLabel, freshnessColor } from "./freshness";
import styles from "./dashboard.module.css";

export type FeedArticle = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  topicName: string;
  summary: string;
  // Âge en heures, calculé côté serveur dans app/dashboard/page.tsx.
  // Le calculer ici avec Date.now() rendait le composant impur : le rendu
  // serveur et l'hydratation produisaient deux valeurs différentes, donc une
  // couleur de fraîcheur et un libellé d'âge potentiellement divergents.
  ageHours: number;
};

type VisibleFields = { source: boolean; freshness: boolean; summary: boolean };

type SortBy = "date" | "source" | "topic";

// Forme commune aux trois modes, pour que le rendu n'ait besoin que d'un
// seul chemin : un "groupe" sans nom (name: null) est rendu sans en-tête,
// ce que seul le mode "date" (liste plate) produit.
type ArticleGroup = {
  name: string | null;
  items: { article: FeedArticle; index: number }[];
};

// Regroupe les articles par sujet de veille, dans l'ordre défini par
// l'utilisateur dans l'onglet Sujets de veille (topics.sort_order, hérité
// via topicOrder — liste des noms déjà triée par l'appelant). Un sujet dont
// le nom n'apparaît pas dans topicOrder (cas limite : sujet supprimé entre
// la lecture des deux requêtes serveur) atterrit après les sujets connus
// mais avant "Sans sujet", qui reste toujours relégué en fin de liste même
// si l'article correspondant le plus récent est le tout premier du flux —
// sinon un article mal étiqueté prendrait la première place. Le tri étant
// stable, l'ordre décroissant de date déjà appliqué par la requête serveur
// est conservé à l'intérieur de chaque groupe.
// Chaque article reçoit un index global (et non un index local au groupe)
// afin que la cadence de l'animation d'entrée reste la même qu'auparavant.
function groupByTopic(articles: FeedArticle[], topicOrder: string[]): ArticleGroup[] {
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
  const rank = new Map(topicOrder.map((name, i) => [name, i]));
  order.sort((a, b) => {
    if (a === "Sans sujet") return 1;
    if (b === "Sans sujet") return -1;
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
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

// Liste plate, sans regroupement : les articles arrivent déjà triés par
// date décroissante depuis la requête serveur (voir dashboard/page.tsx), et
// le filtrage par fenêtre de fraîcheur en amont préserve cet ordre — rien à
// trier ici, juste les envelopper dans un groupe unique sans nom pour
// réutiliser le même rendu que les deux autres modes.
function sortByDateFlat(articles: FeedArticle[]): ArticleGroup[] {
  return [
    { name: null, items: articles.map((article, index) => ({ article, index })) },
  ];
}

// Regroupe par nom de source, ordre alphabétique. Comme pour groupByTopic,
// le tri étant stable et les articles déjà reçus en ordre décroissant de
// date, chaque groupe conserve cet ordre en interne sans repasse explicite.
function groupBySource(articles: FeedArticle[]): ArticleGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, FeedArticle[]>();
  for (const article of articles) {
    const key = article.sourceName || "Source inconnue";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(article);
  }
  order.sort((a, b) => a.localeCompare(b, "fr"));
  let globalIndex = 0;
  return order.map((name) => ({
    name,
    items: buckets.get(name)!.map((article) => ({
      article,
      index: globalIndex++,
    })),
  }));
}

function buildGroups(
  articles: FeedArticle[],
  sortBy: SortBy,
  topicOrder: string[],
): ArticleGroup[] {
  switch (sortBy) {
    case "date":
      return sortByDateFlat(articles);
    case "source":
      return groupBySource(articles);
    case "topic":
      return groupByTopic(articles, topicOrder);
  }
}

// Fenêtre de fraîcheur pilotée par le cadran AgeFilterDial ci-dessous.

// Clic sur la carte : ouvre l'article, sauf si le clic vient d'un bouton ou
// d'un lien (pouces, titre) qui gère déjà son propre comportement — sinon un
// clic sur "Garder" ouvrirait aussi l'article en plus de le marquer favori.
function handleCardClick(event: MouseEvent<HTMLDivElement>, url: string) {
  const target = event.target as HTMLElement;
  if (target.closest("a, button")) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

type Density = "compact" | "comfortable";

export default function ArticleFeed({
  articles,
  topicOrder,
  sortBy,
  density,
  visibleFields,
  favoriteIds,
  dismissedIds,
  pendingIds,
  userId,
  onToggleFavorite,
  onDismiss,
}: {
  articles: FeedArticle[];
  topicOrder: string[];
  sortBy: SortBy;
  density: Density;
  visibleFields: VisibleFields;
  // État favori/écarté remonté dans use-article-actions.ts, partagé avec la
  // vue sphère (articles-view.tsx) : voir le commentaire sur ce hook pour la
  // raison (les deux vues divergeaient avant un rechargement complet).
  favoriteIds: Set<string>;
  dismissedIds: Set<string>;
  pendingIds: Set<string>;
  userId: string | null;
  onToggleFavorite: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const remainingArticles = useMemo(
    () => articles.filter((article) => !dismissedIds.has(article.id)),
    [articles, dismissedIds],
  );

  // 72h par défaut : la fraîcheur perd son sens au-delà, et le flux
  // mélangeait des articles vieux de plusieurs centaines de jours à des
  // articles du jour. Les autres options permettent d'élargir ou de
  // resserrer la fenêtre sans recharger la page.
  const [maxAgeHours, setMaxAgeHours] = useState<number | null>(72);
  const visibleArticles = useMemo(
    () =>
      maxAgeHours === null
        ? remainingArticles
        : remainingArticles.filter(
            (article) => article.ageHours < maxAgeHours,
          ),
    [remainingArticles, maxAgeHours],
  );

  const groups = buildGroups(visibleArticles, sortBy, topicOrder);
  const animatedCount = useAnimatedNumber(visibleArticles.length, 450);

  // Animation d'entrée pilotée par le scroll : IntersectionObserver plutôt
  // que animation-timeline: view() (support Safari encore inégal, et déjà
  // source de bugs de rendu sur iOS ailleurs dans les projets Anthropotech).
  // Chaque carte n'est révélée qu'une fois puis désobservée ; la classe est
  // posée après montage pour ne jamais diverger entre rendu serveur et
  // hydratation.
  // Le lien vers l'article vit sur le seul titre (élément <a>) plutôt que sur
  // la carte entière, afin que les boutons pouce ne soient pas imbriqués
  // dans un élément interactif — la carte elle-même est un <div>, observé
  // pour l'apparition au scroll.
  const cardMap = useRef<Map<string, HTMLDivElement>>(new Map());
  function registerCard(id: string) {
    return (el: HTMLDivElement | null) => {
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
    <div
      className={`${styles.articleFeedRoot} ${
        density === "compact" ? styles.densityCompact : ""
      }`}
    >
      <div className={styles.articleFilterBar}>
        <span className={styles.sectionCount}>
          {animatedCount} correspondance
          {visibleArticles.length > 1 ? "s" : ""} affichée
          {visibleArticles.length > 1 ? "s" : ""}
          {visibleArticles.length !== remainingArticles.length &&
            ` sur ${remainingArticles.length}`}
        </span>
        <AgeFilterDial value={maxAgeHours} onChange={setMaxAgeHours} />
      </div>

      {visibleArticles.length === 0 ? (
        <div className={styles.emptyBlock}>
          <div className={styles.emptyTitle}>Rien dans cette fenêtre</div>
          <div className={styles.emptyText}>
            Aucun article ne correspond à la période sélectionnée. Essaie une
            fenêtre plus large ci-dessus.
          </div>
        </div>
      ) : (
        <div className={styles.topicGroups}>
          {groups.map((group) => (
            <section key={group.name ?? "flat"} className={styles.topicGroup}>
              {group.name && (
                <div className={styles.topicGroupHead}>
                  <h3 className={styles.topicGroupName}>{group.name}</h3>
                  <span className={styles.topicGroupCount}>
                    {group.items.length} article
                    {group.items.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div className={styles.articleGrid}>
                {group.items.map(({ article, index }) => {
                  const fresh = Math.max(
                    0,
                    Math.min(1, 1 - article.ageHours / 72),
                  );
                  // Bornes et interpolation partagées avec la vue sphère et le
                  // panneau de détail : voir app/dashboard/freshness.ts.
                  const color = freshnessColor(article.ageHours);
                  const archived = article.ageHours >= 72;

                  const isFavorited = favoriteIds.has(article.id);
                  const isPending = pendingIds.has(article.id);

                  return (
                    <div
                      key={article.id}
                      ref={registerCard(article.id)}
                      onClick={(e) => handleCardClick(e, article.url)}
                      className={`${styles.articleCard} ${
                        archived ? styles.articleCardArchived : ""
                      }`}
                      style={{ transitionDelay: `${(index % 6) * 0.05}s` }}
                    >
                      {visibleFields.source && (
                        <div className={styles.articleSource}>
                          {article.sourceName}
                          {sortBy !== "topic" && (
                            <span className={styles.articleTopicTag}>
                              {" "}
                              · {article.topicName || "Sans sujet"}
                            </span>
                          )}
                        </div>
                      )}
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.articleTitle}
                      >
                        {article.title}
                      </a>

                      {visibleFields.summary && article.summary && (
                        <p className={styles.articleSummary}>
                          {article.summary}
                        </p>
                      )}

                      {visibleFields.freshness && (
                        <>
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
                        </>
                      )}

                      <div className={styles.articleActions}>
                        <button
                          type="button"
                          disabled={isPending || !userId}
                          onClick={() => onToggleFavorite(article.id)}
                          aria-pressed={isFavorited}
                          aria-label={
                            isFavorited
                              ? "Retirer des favoris"
                              : "Garder cet article"
                          }
                          className={`${styles.thumbBtn} ${
                            isFavorited ? styles.thumbBtnActive : ""
                          }`}
                        >
                          <span aria-hidden="true">✓</span>
                        </button>
                        <button
                          type="button"
                          disabled={isPending || !userId}
                          onClick={() => onDismiss(article.id)}
                          aria-label="Retirer, ne m'intéresse pas"
                          className={`${styles.thumbBtn} ${styles.thumbBtnDismiss}`}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      </div>
                    </div>
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
