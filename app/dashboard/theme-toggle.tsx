"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "../theme-provider";
import styles from "./dashboard.module.css";

// Icônes lucide-react, déjà utilisées ailleurs dans le dashboard (pouces de
// article-feed.tsx) : même taille et même graisse de trait, pour rester
// cohérent avec les autres boutons-icônes plutôt que d'introduire un nouveau
// style de SVG.
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label =
    next === "light" ? "Passer au thème clair" : "Passer au thème sombre";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={styles.themeToggleBtn}
    >
      {theme === "dark" ? (
        <Moon size={14} strokeWidth={2.25} />
      ) : (
        <Sun size={14} strokeWidth={2.25} />
      )}
    </button>
  );
}
