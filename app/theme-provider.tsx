"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

// Clé dupliquée dans le script bloquant de app/layout.tsx (celui-ci ne peut
// pas importer ce module : il doit rester une chaîne autonome, injectée
// avant tout JavaScript de page). Garder les deux valeurs synchronisées.
const STORAGE_KEY = "synapse-theme";

type Theme = "dark" | "light";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

// "dark" côté serveur, comme la valeur par défaut de :root dans
// globals.css : le serveur ne peut connaître ni la préférence système ni le
// choix mémorisé du visiteur. useSyncExternalStore gère seul l'écart avec
// la vraie valeur lue côté client au montage, sans avertissement
// d'hydratation ni aller-retour visible.
function getServerSnapshot(): Theme {
  return "dark";
}

function applyTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Tant qu'aucun choix manuel n'est mémorisé, l'app suit les changements de
  // préférence système en direct, pas seulement au chargement initial.
  const media = window.matchMedia("(prefers-color-scheme: light)");
  function onMediaChange() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage indisponible (navigation privée stricte, etc.).
    }
    if (stored) return; // choix manuel prioritaire : on ignore le système
    applyTheme(media.matches ? "light" : "dark");
  }
  media.addEventListener("change", onMediaChange);

  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onMediaChange);
  };
}

function setTheme(next: Theme) {
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Le choix ne survivra pas au rechargement, mais reste actif pour la
    // session en cours.
  }
}

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme doit être appelé dans ThemeProvider");
  }
  return ctx;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
