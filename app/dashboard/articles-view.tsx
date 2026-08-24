"use client";

import { useMemo, useState } from "react";
import type { FeedArticle } from "./article-feed";
import ArticleFeed from "./article-feed";
import ArticlesSphere from "./articles-sphere";
import AgeFilterDial from "./age-filter-dial";
import { computeTopicSlots, useIsLightTheme } from "./topic-colors";
import { useArticleActions } from "./use-article-actions";
import styles from "./dashboard.module.css";

type SortBy = "date" | "source" | "topic";
type Density = "compact" | "comfortable";
type VisibleFields = { source: boolean; freshness: boolean; summary: boolean };
type View = "sphere" | "list";
type CloudDensity = "light" | "normal" | "dense";

// Bascule Sphère/Liste (cahier des charges §1, §5.3) : orchestre
// ArticlesSphere et ArticleFeed, qui restent chacun la vue elle-même. L'état
// favori/écarté vit ici (use-article-actions.ts) et non dans l'une ou
// l'autre vue, pour qu'un favori posé en sphère apparaisse immédiatement en
// liste, et inversement, sans attendre un rechargement de page.
//
// Vue non active démontée plutôt que masquée en CSS (contrairement au
// dock ARTICLES/SUJETS/CONFIG de dashboard-shell.tsx) : la sphère fait
// tourner une boucle de rotation à 60 im/s en continu, qui n'a aucune raison
// de consommer du CPU pendant que la liste est affichée.
//
// Titre "Articles" + légende de sujets + bascule Sphère/Liste + cadran de
// fraîcheur regroupés ici, dans UN SEUL bandeau compact (une bande de titre,
// une bande de légende juste dessous), plutôt qu'un titre (page.tsx) puis
// une rangée de bascule puis (dans ArticlesSphere) une légende puis une
// barre de filtre séparées — la pile de blocs empilés poussait la sphère
// loin sous la ligne de flottaison. maxAgeHours et le calcul des sujets
// vivent donc ici (partagés avec ArticlesSphere via props) plutôt que
// dupliqués localement dans chaque vue. Le cadran/la légende ne sont
// affichés qu'en vue Sphère : la vue Liste garde son propre cadran (dans
// article-feed.tsx, indépendant) et n'a pas d'usage pour la légende de
// couleurs (les sujets y sont déjà du texte).
export default function ArticlesView({
  articles,
  favoritedIds,
  topicOrder,
  sortBy,
  density,
  visibleFields,
  defaultView,
  cloudDensity,
}: {
  articles: FeedArticle[];
  favoritedIds: string[];
  topicOrder: string[];
  sortBy: SortBy;
  density: Density;
  visibleFields: VisibleFields;
  defaultView: View;
  cloudDensity: CloudDensity;
}) {
  const [view, setView] = useState<View>(defaultView);
  const [maxAgeHours, setMaxAgeHours] = useState<number | null>(72);
  const actions = useArticleActions(favoritedIds);
  const isLight = useIsLightTheme();

  const visibleArticles = useMemo(() => {
    const remaining = articles.filter((a) => !actions.dismissedIds.has(a.id));
    return maxAgeHours === null
      ? remaining
      : remaining.filter((a) => a.ageHours < maxAgeHours);
  }, [articles, actions.dismissedIds, maxAgeHours]);

  const topicSlots = useMemo(
    () => computeTopicSlots(topicOrder, visibleArticles),
    [topicOrder, visibleArticles],
  );
  const topicSlotByName = useMemo(() => {
    const map = new Map(topicSlots.map((slot) => [slot.name, slot]));
    return map;
  }, [topicSlots]);

  return (
    <div className={styles.articlesRoot}>
      <div className={styles.articlesTopBar}>
        <div className={styles.articlesTopBarLeft}>
          <h2 className={styles.sectionH2}>Articles</h2>
          {view === "sphere" && topicSlots.length > 0 && (
            <div
              className={`${styles.sphereTopicLegend} ${styles.articlesTopBarLegend}`}
              aria-label="Sujets actifs"
            >
              {topicSlots.map((slot) => (
                <span key={slot.name} className={styles.sphereTopicLegendItem}>
                  <span
                    className={styles.detailTopicDot}
                    style={{ background: isLight ? slot.colorLight : slot.colorDark }}
                    aria-hidden="true"
                  />
                  {slot.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.articlesTopBarRight}>
          <div className={styles.viewToggle} role="group" aria-label="Vue Articles">
            <button
              type="button"
              onClick={() => setView("sphere")}
              aria-pressed={view === "sphere"}
              className={`${styles.viewToggleBtn} ${
                view === "sphere" ? styles.viewToggleBtnActive : ""
              }`}
            >
              Sphère
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`${styles.viewToggleBtn} ${
                view === "list" ? styles.viewToggleBtnActive : ""
              }`}
            >
              Liste
            </button>
          </div>
          {view === "sphere" && <AgeFilterDial value={maxAgeHours} onChange={setMaxAgeHours} />}
        </div>
      </div>

      {view === "sphere" ? (
        <ArticlesSphere
          visibleArticles={visibleArticles}
          topicSlots={topicSlots}
          topicSlotByName={topicSlotByName}
          maxAgeHours={maxAgeHours}
          cloudDensity={cloudDensity}
          favoriteIds={actions.favoriteIds}
          pendingIds={actions.pendingIds}
          userId={actions.userId}
          onToggleFavorite={actions.toggleFavorite}
          onDismiss={actions.dismissArticle}
        />
      ) : (
        <ArticleFeed
          articles={articles}
          topicOrder={topicOrder}
          sortBy={sortBy}
          density={density}
          visibleFields={visibleFields}
          favoriteIds={actions.favoriteIds}
          dismissedIds={actions.dismissedIds}
          pendingIds={actions.pendingIds}
          userId={actions.userId}
          onToggleFavorite={actions.toggleFavorite}
          onDismiss={actions.dismissArticle}
        />
      )}
    </div>
  );
}
