"use client";

import { useState, type ReactNode } from "react";
import NavRing, { type DashboardPageKey } from "./nav-ring";
import styles from "./dashboard.module.css";

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
  const [activePage, setActivePage] = useState<DashboardPageKey>("articles");

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>{logo}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <NavRing activePage={activePage} onChange={setActivePage} />
          {signOutButton}
        </div>
      </div>

      <div style={{ display: activePage === "articles" ? "block" : "none" }}>
        {articlesSection}
      </div>
      <div style={{ display: activePage === "dashboard" ? "block" : "none" }}>
        {dashboardSection}
      </div>
      <div style={{ display: activePage === "config" ? "block" : "none" }}>
        {configSection}
      </div>
    </>
  );
}
