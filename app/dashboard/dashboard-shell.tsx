"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import NavRing, { type DashboardPageKey } from "./nav-ring";
import AgeFilterDial from "./age-filter-dial";
import styles from "./dashboard.module.css";

// Les vues sont construites dans un composant serveur puis passées en
// propriétés. Elles ne peuvent donc pas recevoir de fonction de rappel
// directement. Ce contexte leur donne accès au changement de vue : il est
// nécessaire à l'état vide de la vue Articles, dont le bouton mène aux
// Sujets de veille.
const NavContext = createContext<((page: DashboardPageKey) => void) | null>(
  null,
);

export function useDashboardNav() {
  const goTo = useContext(NavContext);
  if (!goTo) {
    throw new Error("useDashboardNav doit être appelé dans DashboardShell");
  }
  return goTo;
}

type View = "sphere" | "list";

// Bascule Sphère/Liste + cadran de fraîcheur (24H/48H/72H/TOUT) : remontés
// dans le bandeau du haut (topbar), au-dessus de sa ligne de séparation,
// plutôt que dans le bandeau compact d'ArticlesView plus bas (demande
// explicite). L'état lui-même (view, maxAgeHours) vit donc ici, dans
// DashboardShell — seul ancêtre commun à la fois au header (qui affiche les
// contrôles) et à ArticlesView (qui les applique pour filtrer/choisir sa
// vue). Même raisonnement que NavContext juste au-dessus, pour la même
// contrainte : ArticlesView est construit côté serveur puis reçu ici en
// ReactNode déjà instancié, impossible à joindre par de simples props
// descendantes une fois construit — seul le contexte traverse cette limite.
const ArticlesControlsContext = createContext<{
  view: View;
  setView: (v: View) => void;
  maxAgeHours: number | null;
  setMaxAgeHours: (v: number | null) => void;
  // Légende de la sphère ("X en favoris · Y dans le flux affiché · ...") :
  // affichée juste au-dessus du footer (demande explicite), donc hors de
  // l'arbre d'ArticlesSphere qui la calcule (interiorCount/visibleArticles
  // dépendent de ses propres props). Poussée ici via setSphereLegend
  // (useEffect côté ArticlesSphere, voir articles-sphere.tsx), plutôt que
  // recalculée en double : ce texte contient un compte d'articles filtrés
  // par sujet/fraîcheur/favoris, qui n'existe nulle part ailleurs.
  sphereLegend: string | null;
  setSphereLegend: (v: string | null) => void;
} | null>(null);

export function useArticlesControls() {
  const ctx = useContext(ArticlesControlsContext);
  if (!ctx) {
    throw new Error("useArticlesControls doit être appelé dans DashboardShell");
  }
  return ctx;
}

export default function DashboardShell({
  logo,
  signOutButton,
  dashboardSection,
  articlesSection,
  configSection,
  defaultView,
}: {
  logo: ReactNode;
  signOutButton: ReactNode;
  dashboardSection: ReactNode;
  articlesSection: ReactNode;
  configSection: ReactNode;
  defaultView: View;
}) {
  // La clé de la vue des sujets s'appelait "dashboard", ce qui prêtait à
  // confusion avec le tableau de bord lui-même. Renommée en "topics", comme
  // dans la charte. Les noms de propriétés restent inchangés pour ne pas
  // toucher aux fichiers appelants à cette étape.
  const [activePage, setActivePage] = useState<DashboardPageKey>("articles");
  const [view, setView] = useState<View>(defaultView);
  const [maxAgeHours, setMaxAgeHours] = useState<number | null>(72);
  const [sphereLegend, setSphereLegend] = useState<string | null>(null);

  return (
    <NavContext.Provider value={setActivePage}>
      <ArticlesControlsContext.Provider
        value={{ view, setView, maxAgeHours, setMaxAgeHours, sphereLegend, setSphereLegend }}
      >
        <header className={styles.topbar}>
          <div className={styles.topbarRow}>
            <div className={styles.brand}>{logo}</div>

            <div className={styles.account}>{signOutButton}</div>
          </div>

          {/* Seulement en vue Articles : sur les autres pages (Sujets,
              Config), la bascule Sphère/Liste et le cadran de fraîcheur
              n'ont pas de sens (rien à filtrer). */}
          {activePage === "articles" && (
            <div className={styles.topbarControls}>
              <div
                className={styles.viewToggle}
                role="group"
                aria-label="Vue Articles"
              >
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
              {view === "sphere" && (
                <AgeFilterDial value={maxAgeHours} onChange={setMaxAgeHours} />
              )}
            </div>
          )}
        </header>

        {/* Dock flottant, position: fixed — n'a plus sa place dans la topbar
            depuis la structure v2 (synapse-structure-composants-v2.md,
            section 1). */}
        <NavRing activePage={activePage} onChange={setActivePage} />

        <div style={{ display: activePage === "articles" ? "block" : "none" }}>
          {articlesSection}
        </div>
        <div style={{ display: activePage === "topics" ? "block" : "none" }}>
          {dashboardSection}
        </div>
        <div style={{ display: activePage === "config" ? "block" : "none" }}>
          {configSection}
        </div>

        {/* Juste au-dessus du footer (demande explicite) : uniquement en
            vue Articles/Sphère, quand ArticlesSphere a effectivement publié
            un texte (voir setSphereLegend, articles-sphere.tsx). */}
        {activePage === "articles" && view === "sphere" && sphereLegend && (
          <div className={styles.sphereLegend}>{sphereLegend}</div>
        )}

        <footer className={styles.footer}>
          <span>SYNAPSE — SYSTÈME DE VEILLE INTELLIGENTE</span>
          <span>Collecte périodique toutes les 20 min</span>
          <div className={styles.footerLinks}>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/confidentialite">Confidentialité</Link>
          </div>
        </footer>
      </ArticlesControlsContext.Provider>
    </NavContext.Provider>
  );
}
