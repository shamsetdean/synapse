"use client";

import { useMemo } from "react";
import type { FeedArticle } from "./article-feed";
import ArticleFeed from "./article-feed";
import ArticlesSphere from "./articles-sphere";
import { useArticlesControls } from "./dashboard-shell";
import { computeTopicSlots, useIsLightTheme } from "./topic-colors";
import { useArticleActions } from "./use-article-actions";
import styles from "./dashboard.module.css";

type SortBy = "date" | "source" | "topic";
type Density = "compact" | "comfortable";
type VisibleFields = { source: boolean; freshness: boolean; summary: boolean };
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
// La bascule Sphère/Liste et le cadran de fraîcheur (24H/48H/72H/TOUT) ont
// déménagé dans le bandeau du haut (dashboard-shell.tsx), au-dessus de sa
// ligne de séparation (demande explicite) : `view` et `maxAgeHours` sont
// donc lus depuis useArticlesControls (contexte partagé avec le header),
// plus un état local ici. Le titre "Articles" + la légende de sujets
// restent ici : ils dépendent des données propres à cette vue
// (topicSlots), que le header n'a pas.
export default function ArticlesView({
  articles,
  favoritedIds,
  topicOrder,
  sortBy,
  density,
  visibleFields,
  cloudDensity,
}: {
  articles: FeedArticle[];
  favoritedIds: string[];
  topicOrder: string[];
  sortBy: SortBy;
  density: Density;
  visibleFields: VisibleFields;
  cloudDensity: CloudDensity;
}) {
  const { view, maxAgeHours } = useArticlesControls();
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
