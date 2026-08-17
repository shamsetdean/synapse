"use client";

import styles from "./dashboard.module.css";

// Structure reprise de synapse-structure-composants-v2.md, section 2 :
// mini-jauge SVG décorative (icône, non cliquable) + 4 pilules horizontales.
// Remplace l'ancien grand cadran circulaire en croix (24H/72H/7J/TOUT) —
// la fenêtre "7 jours" disparaît au passage, remplacée par "48H" : c'est le
// jeu d'options donné par la maquette (dialAngles), pas un oubli.

const OPTIONS: { label: string; hours: number | null; angle: number }[] = [
  { label: "24H", hours: 24, angle: -60 },
  { label: "48H", hours: 48, angle: -20 },
  { label: "72H", hours: 72, angle: 20 },
  { label: "TOUT", hours: null, angle: 60 },
];

// Pivot de l'aiguille, en bas de la jauge (34×20, cf. maquette). La longueur
// (12) reprend l'écart entre y1=18 et y2=6 du tracé de référence.
const HUB = { x: 17, y: 18 };
const NEEDLE_LEN = 12;

function needleTip(angleDeg: number) {
  // Reproduit `transform: rotate({angle}deg)` avec `transform-origin: 50%
  // 100%` (donc autour du pivot) sur une aiguille verticale par défaut :
  // calculé ici en coordonnées SVG plutôt qu'en transform CSS pour éviter
  // tout écart d'origine de rotation entre navigateurs.
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: HUB.x + Math.sin(rad) * NEEDLE_LEN,
    y: HUB.y - Math.cos(rad) * NEEDLE_LEN,
  };
}

export default function AgeFilterDial({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (hours: number | null) => void;
}) {
  const active = OPTIONS.find((o) => o.hours === value) ?? OPTIONS[2];
  const tip = needleTip(active.angle);

  return (
    <div className={styles.ageFilter}>
      <svg
        width="34"
        height="20"
        viewBox="0 0 34 20"
        className={styles.ageGaugeSvg}
        aria-hidden="true"
      >
        <path
          d="M 3 18 A 14 14 0 0 1 31 18"
          fill="none"
          className={styles.ageGaugeArc}
          strokeWidth="1.5"
        />
        <line
          x1={HUB.x}
          y1={HUB.y}
          x2={tip.x}
          y2={tip.y}
          className={styles.ageGaugeNeedle}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={HUB.x} cy={HUB.y} r="2" className={styles.ageGaugeHub} />
      </svg>

      <div
        className={styles.ageFilterPills}
        role="group"
        aria-label="Fenêtre de fraîcheur"
      >
        {OPTIONS.map((o) => {
          const isActive = o.hours === active.hours;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onChange(o.hours)}
              aria-pressed={isActive}
              className={`${styles.ageFilterPill} ${
                isActive ? styles.ageFilterPillActive : ""
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
