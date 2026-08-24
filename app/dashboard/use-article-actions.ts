"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// État favori/écarté extrait de article-feed.tsx pour être partagé entre la
// vue liste et la vue sphère (articles-view.tsx) : sans ce partage, favoriser
// un article dans une vue ne se reflétait pas dans l'autre avant un
// rechargement complet de la page, les deux gardant chacune leur propre copie
// optimiste. Comportement d'écriture inchangé — seul l'endroit où l'état vit
// a changé.
export function useArticleActions(favoritedIds: string[]) {
  const supabase = useMemo(() => createClient(), []);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(favoritedIds),
  );
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
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
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      console.error("dismissed_articles: échec de l'écriture", error);
    }
  }

  return {
    userId,
    favoriteIds,
    dismissedIds,
    pendingIds,
    toggleFavorite,
    dismissArticle,
  };
}
