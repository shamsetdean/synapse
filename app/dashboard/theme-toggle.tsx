"use client";

import { useTheme } from "../theme-provider";
import styles from "./dashboard.module.css";

// Structure et libellé repris de synapse-structure-composants-v2.md,
// section 3 : bouton texte mono (plus d'icône Sun/Moon). Le libellé affiché
// est l'action à venir, pas l'état actuel — "SOMBRE" en thème clair propose
// de passer en sombre, "CLAIR" en thème sombre propose l'inverse.
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? "CLAIR" : "SOMBRE";
  const description =
    next === "light" ? "Passer au thème clair" : "Passer au thème sombre";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={description}
      title={description}
      className={styles.themeToggleBtn}
    >
      {label}
    </button>
  );
}
