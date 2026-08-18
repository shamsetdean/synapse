"use client";

import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { useTheme } from "../theme-provider";
import SignOutButton from "./sign-out-button";
import styles from "./dashboard.module.css";

// Remplace, dans le header, l'ancien affichage direct (ThemeToggle +
// SignOutButton + email côte à côte) par un seul bouton icône ouvrant ce
// menu déroulant.
//
// SignOutButton ferme le menu via sa prop onSignOut, appelée en tout premier
// dans signOut() — pas via onClickCapture sur un conteneur : cette première
// version fermait le menu au clic mais empêchait le clic d'atteindre le
// gestionnaire de SignOutButton lui-même, donc la déconnexion elle-même ne
// se déclenchait jamais.
//
// La logique de bascule de thème est réimplémentée ici via useTheme()
// plutôt que de réutiliser <ThemeToggle /> tel quel : ce composant est
// stylé comme une pilule autonome de topbar (bordure, opacity 0.7), pas
// comme une ligne de menu pleine largeur — les deux contextes veulent des
// styles différents pour la même logique.
export default function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const themeLabel = next === "light" ? "CLAIR" : "SOMBRE";
  const themeDescription =
    next === "light" ? "Passer au thème clair" : "Passer au thème sombre";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.profileMenu} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Menu profil"
        className={`${styles.profileMenuBtn} ${
          open ? styles.profileMenuBtnOpen : ""
        }`}
      >
        <User size={16} strokeWidth={2} />
      </button>

      {open && (
        <div className={styles.profileMenuPanel}>
          <button
            type="button"
            onClick={() => setTheme(next)}
            className={styles.profileMenuItem}
          >
            {themeDescription}
            <span className={styles.profileMenuItemValue}>{themeLabel}</span>
          </button>

          <div className={styles.profileMenuEmail}>{email}</div>

          <div className={styles.profileMenuSignOut}>
            <SignOutButton onSignOut={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
