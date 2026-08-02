"use client";

import { useState } from "react";
import { ChevronDown, LayoutGrid, Languages, Layers, BellRing } from "lucide-react";
import styles from "../landing.module.css";

const items = [
  {
    icon: LayoutGrid,
    title: "Sources illimitées",
    body: "RSS, réseaux sociaux, podcasts, communiqués officiels — centralisés au même endroit.",
  },
  {
    icon: Languages,
    title: "Traduction à la volée",
    body: "Chaque article s'affiche dans votre langue, quelle que soit la source d'origine.",
  },
  {
    icon: Layers,
    title: "Zéro doublon",
    body: "Les articles qui parlent du même événement sont automatiquement regroupés.",
  },
  {
    icon: BellRing,
    title: "Notifications intelligentes",
    body: "Prévenu seulement quand plusieurs sources fiables confirment un événement.",
  },
];

export default function Features() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className={styles.features} id="fonctionnalites">
      <div className={styles.sectionHead}>
        <div className={styles.eyebrow}>Fonctionnalités</div>
        <h2>Une veille qui travaille pour vous.</h2>
      </div>

      <div className={styles.accordion}>
        {items.map((item, index) => {
          const Icon = item.icon;
          const isOpen = openIndex === index;

          return (
            <div key={item.title} className={styles.accordionItem}>
              <button
                className={styles.accordionTrigger}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span className={styles.accordionIcon}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  {item.title}
                </span>
                <ChevronDown
                  size={18}
                  className={styles.accordionChevron}
                  style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div className={styles.accordionContent}>{item.body}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
