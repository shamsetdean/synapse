"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import NavRing, { type DashboardPageKey } from "./nav-ring";
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

export default function DashboardShell({
  logo,
  signOutButton,
  dashboardSection,
  articlesSection,
  configSection,
}: {
  logo: ReactNode;
  signOutButton: ReactNode;
  dashboardSection: ReactNode;
  articlesSection: ReactNode;
  configSection: ReactNode;
}) {
  // La clé de la vue des sujets s'appelait "dashboard", ce qui prêtait à
  // confusion avec le tableau de bord lui-même. Renommée en "topics", comme
  // dans la charte. Les noms de propriétés restent inchangés pour ne pas
  // toucher aux fichiers appelants à cette étape.
  const [activePage, setActivePage] = useState<DashboardPageKey>("articles");

  return (
    <NavContext.Provider value={setActivePage}>
      <header className={styles.topbar}>
        <div className={styles.brand}>{logo}</div>

        <div className={styles.account}>{signOutButton}</div>

        <NavRing activePage={activePage} onChange={setActivePage} />
      </header>

      <div style={{ display: activePage === "articles" ? "block" : "none" }}>
        {articlesSection}
      </div>
      <div style={{ display: activePage === "topics" ? "block" : "none" }}>
        {dashboardSection}
      </div>
      <div style={{ display: activePage === "config" ? "block" : "none" }}>
        {configSection}
      </div>

      <footer className={styles.footer}>
        <span>SYNAPSE — SYSTÈME DE VEILLE INTELLIGENTE</span>
        <span>Collecte périodique toutes les 20 min</span>
      </footer>
    </NavContext.Provider>
  );
}
