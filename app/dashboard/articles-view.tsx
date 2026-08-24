"use client";

import { useState } from "react";
import type { FeedArticle } from "./article-feed";
import ArticleFeed from "./article-feed";
import ArticlesSphere from "./articles-sphere";
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
  const actions = useArticleActions(favoritedIds);

  return (
    <>
      <div className={styles.viewToggleRow}>
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
      </div>

      {view === "sphere" ? (
        <ArticlesSphere
          articles={articles}
          topicOrder={topicOrder}
          cloudDensity={cloudDensity}
          favoriteIds={actions.favoriteIds}
          dismissedIds={actions.dismissedIds}
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
    </>
  );
}
