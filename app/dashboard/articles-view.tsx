"use client";

import { useEffect, useMemo } from "react";
import type { FeedArticle } from "./article-feed";
import ArticleFeed from "./article-feed";
import ArticlesSphere from "./articles-sphere";
import AgeFilterDial from "./age-filter-dial";
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
// La bascule Sphère/Liste et le cadran de fraîcheur (24H/48H/72H/TOUT) sont
// désormais rendus ICI (redescendus depuis dashboard-shell.tsx, demande
// explicite d'inversion) : `view`/`setView`/`maxAgeHours`/`setMaxAgeHours`
// restent lus depuis useArticlesControls (contexte partagé avec le header),
// mais l'état lui-même continue de vivre dans DashboardShell — seul ancêtre
// commun au header ET à cette vue, inchangé par cet échange. Le titre
// "Articles" + la légende de sujets, eux, ont pris la place inverse : rendus
// dans le header (dashboard-shell.tsx), qui n'a pas accès à topicSlots
// (dépend des données propres à cette vue) — poussée là-bas via
// setTopicLegend, sur le même principe que sphereLegend (articles-sphere.tsx).
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
  const { view, setView, maxAgeHours, setMaxAgeHours, setTopicLegend } = useArticlesControls();
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

  // Légende de sujets (points colorés) : publiée vers le header (voir
  // topicLegend/setTopicLegend, dashboard-shell.tsx), qui n'a pas accès à
  // topicSlots. Résolue en couleur ICI (isLight tranché côté client, comme
  // avant) plutôt que dans DashboardShell, qui n'a pas cette information.
  // Seulement en vue Sphère, comme le comportement d'origine (la vue Liste
  // affiche déjà les sujets en texte, pas besoin de la légende de couleurs).
  // Nettoyée au démontage/changement de vue : sans ce nettoyage, une légende
  // obsolète resterait affichée dans le header après un passage en Liste.
  useEffect(() => {
    if (view !== "sphere" || topicSlots.length === 0) {
      setTopicLegend(null);
      return;
    }
    setTopicLegend(
      topicSlots.map((slot) => ({
        name: slot.name,
        color: isLight ? slot.colorLight : slot.colorDark,
      })),
    );
    return () => setTopicLegend(null);
  }, [view, topicSlots, isLight, setTopicLegend]);

  return (
    <div className={styles.articlesRoot}>
      <div className={styles.articlesTopBar}>
        {/* Bascule Sphère/Liste + cadran de fraîcheur : occupent ici la
            place laissée par le titre "Articles" + sa légende (demande
            explicite d'inversion, voir dashboard-shell.tsx). */}
        <div className={styles.topbarControls}>
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
