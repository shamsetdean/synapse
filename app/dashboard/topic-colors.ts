"use client";

import { useEffect, useState } from "react";

// Couleur par sujet, dérivée du nom (hash) plutôt que d'une taxonomie fixe :
// il n'existe pas de "Tech/Local/Monde/Culture" en base, les sujets sont
// entièrement créés par chaque utilisateur (table topics). Partagé entre
// articles-sphere.tsx (nébuleuses) et topic-card.tsx (accent de la carte
// Sujets) pour qu'un même sujet porte la même couleur aux deux endroits.
// Accumulation polynomiale + finalisation (fmix32, façon Murmur3). La seule
// accumulation (h = h*31 + code) a un effet avalanche faible : deux chaînes
// qui ne diffèrent que par leur dernier caractère produisent des hachages
// proches. articles-sphere.tsx en dérive à la fois l'angle et le décalage
// radial d'un grain à partir de son id — un mauvais effet avalanche corrèle
// alors silencieusement l'angle avec l'ordre d'insertion (ou tout id qui
// varie peu d'un article à l'autre), et le nuage extérieur se dessine en
// rayons quasi rectilignes au lieu d'un nuage dispersé. La finalisation
// ci-dessous casse cette corrélation.
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export const TOPIC_PALETTE: { dark: string; light: string }[] = [
  { dark: "#7fe0c0", light: "#1D9E75" },
  { dark: "#a89af0", light: "#534AB7" },
  { dark: "#f0997b", light: "#D85A30" },
  { dark: "#ed93b1", light: "#D4537E" },
  { dark: "#e3c76b", light: "#b8862e" },
  { dark: "#7bb8f0", light: "#2f6fb0" },
];

export function topicColorFor(name: string, isLight: boolean): string {
  const key = name || "Sans sujet";
  const palette = TOPIC_PALETTE[hashString(key) % TOPIC_PALETTE.length];
  return isLight ? palette.light : palette.dark;
}

// Un sujet actif = un secteur angulaire (nébuleuse/nuage extérieur de la
// sphère) + une couleur. Type partagé (et non plus local à
// articles-sphere.tsx) : articles-view.tsx en a aussi besoin pour la légende
// du bandeau compact au-dessus de la sphère (§ layout compact demandé),
// calculée une seule fois là-haut puis transmise en prop à ArticlesSphere —
// pas de second calcul divergent.
export type TopicSlot = { name: string; angleDeg: number; colorDark: string; colorLight: string };

// Même ordre que la page Sujets (topicOrder), "Sans sujet" toujours en
// dernier (voir groupByTopic, article-feed.tsx). `articles` doit déjà être
// filtré (écartés + fenêtre temporelle) par l'appelant.
export function computeTopicSlots(
  topicOrder: string[],
  articles: { topicName: string }[],
): TopicSlot[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of topicOrder) {
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  for (const a of articles) {
    const key = a.topicName || "Sans sujet";
    if (key !== "Sans sujet" && !seen.has(key)) {
      seen.add(key);
      names.push(key);
    }
  }
  if (articles.some((a) => !a.topicName)) names.push("Sans sujet");
  const n = Math.max(1, names.length);
  return names.map((name, i) => {
    const palette = TOPIC_PALETTE[hashString(name) % TOPIC_PALETTE.length];
    return {
      name,
      angleDeg: -90 + (360 / n) * i,
      colorDark: palette.dark,
      colorLight: palette.light,
    };
  });
}

// Même lecture de data-theme que theme-provider.tsx, pour les composants qui
// n'ont besoin que de savoir clair/sombre sans le reste du contexte de thème
// (setTheme, etc.) — évite d'imposer useTheme() (qui exige ThemeProvider en
// ancêtre direct) à des composants qui n'en ont besoin que pour une couleur.
export function useIsLightTheme(): boolean {
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    function read() {
      setIsLight(document.documentElement.getAttribute("data-theme") === "light");
    }
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return isLight;
}
