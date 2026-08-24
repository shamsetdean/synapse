"use client";

import { useEffect, useState } from "react";

// Couleur par sujet, dérivée du nom (hash) plutôt que d'une taxonomie fixe :
// il n'existe pas de "Tech/Local/Monde/Culture" en base, les sujets sont
// entièrement créés par chaque utilisateur (table topics). Partagé entre
// articles-sphere.tsx (nébuleuses) et topic-card.tsx (accent de la carte
// Sujets) pour qu'un même sujet porte la même couleur aux deux endroits.
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
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
