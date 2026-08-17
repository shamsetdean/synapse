"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAnimatedNumber } from "./use-animated-number";
import AgeFilterDial from "./age-filter-dial";
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

// Fenêtre de fraîcheur pilotée par le cadran AgeFilterDial ci-dessous.

// Clic sur la carte : ouvre l'article, sauf si le clic vient d'un bouton ou
// d'un lien (pouces, titre) qui gère déjà son propre comportement — sinon un
// clic sur "Garder" ouvrirait aussi l'article en plus de le marquer favori.
function handleCardClick(event: MouseEvent<HTMLDivElement>, url: string) {
  const target = event.target as HTMLElement;
  if (target.closest("a, button")) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function ArticleFeed({
  articles,
  favoritedIds,
}: {
  articles: FeedArticle[];
  favoritedIds: string[];
}) {
  const supabase = useMemo(() => createClient(), []);

  // "Écarté" retire l'article de la vue immédiatement (optimiste) ; l'écriture
  // en base se fait en tâche de fond. dismissedIds ne contient donc que les
  // décisions prises PENDANT cette session — les articles déjà écartés lors
  // d'une session précédente sont filtrés côté serveur (page.tsx), en amont
  // du tableau "articles" reçu ici.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(favoritedIds),
  );
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Récupéré une seule fois au montage plutôt qu'à chaque clic pour ne pas
  // ajouter un aller-retour réseau à chaque action pouce ; suit le même
  // schéma que new-topic-form.tsx (user_id explicite à l'écriture, aucune
  // valeur par défaut côté base sur cette colonne).
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function setPending(id: string, isPending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function toggleFavorite(id: string) {
    if (!userId) return;
    const wasFavorited = favoriteIds.has(id);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(id);
      else next.add(id);
      return next;
    });
    setPending(id, true);
    const { error } = wasFavorited
      ? await supabase
          .from("favorites")
          .delete()
          .eq("article_id", id)
          .eq("user_id", userId)
      : await supabase
          .from("favorites")
          .insert({ article_id: id, user_id: userId });
    setPending(id, false);
    if (error) {
      // Écriture refusée : on revient à l'état affiché avant le clic.
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(id);
        else next.delete(id);
        return next;
      });
      console.error("favorites: échec de l'écriture", error);
    }
  }

  async function dismissArticle(id: string) {
    if (!userId) return;
    setDismissedIds((prev) => new Set(prev).add(id));
    setPending(id, true);
    const { error } = await supabase
      .from("dismissed_articles")
      .insert({ article_id: id, user_id: userId });
    setPending(id, false);
    if (error) {
      // Écriture refusée : l'article réapparaît dans le flux.
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      console.error("dismissed_articles: échec de l'écriture", error);
    }
  }

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

  const groups = groupByTopic(visibleArticles);
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
    <div className={styles.articleFeedRoot}>
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
                  // Les deux bornes reprennent des jetons de app/globals.css
                  // (--sy-muted-dim et --sy-accent-gradient-from, thème DARK).
                  // Recopiées en dur plutôt que lues via getComputedStyle :
                  // le composant évite déjà toute API client-only pour que
                  // le rendu serveur et l'hydratation ne divergent jamais
                  // (voir le commentaire sur ageHours plus haut). À revoir
                  // pour prendre en compte le thème LIGHT une fois le
                  // ThemeProvider en place.
                  const color = mixColor("#5c5b64", "#8b7cf6", fresh);
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
                      <div className={styles.articleSource}>
                        {article.sourceName}
                      </div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.articleTitle}
                      >
                        {article.title}
                      </a>

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

                      <div className={styles.articleActions}>
                        <button
                          type="button"
                          disabled={isPending || !userId}
                          onClick={() => toggleFavorite(article.id)}
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
                          <ThumbsUp size={14} strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          disabled={isPending || !userId}
                          onClick={() => dismissArticle(article.id)}
                          aria-label="Retirer, ne m'intéresse pas"
                          className={`${styles.thumbBtn} ${styles.thumbBtnDismiss}`}
                        >
                          <ThumbsDown size={14} strokeWidth={2.25} />
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
