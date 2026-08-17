"use client";

import styles from "./dashboard.module.css";

// Positions façon horloge : 24h à midi, puis 72h/7j/Tout dans le sens des
// aiguilles, jusqu'à "Tout" à 9h — la durée s'allonge en tournant, comme le
// temps qui s'écoule sur un vrai cadran. "angle" est en degrés SVG standard
// (0° = droite, sens horaire, axe Y vers le bas).
const DIAL_OPTIONS: {
  label: string;
  hours: number | null;
  angle: number;
  left: number;
  top: number;
}[] = [
  { label: "24H", hours: 24, angle: -90, left: 50, top: 2 },
  { label: "72H", hours: 72, angle: 0, left: 98, top: 50 },
  { label: "7J", hours: 168, angle: 90, left: 50, top: 98 },
  { label: "TOUT", hours: null, angle: 180, left: 2, top: 50 },
];

const CENTER = 60;
const NEEDLE_LEN = 34;
const TICK_INNER = 42;
const TICK_OUTER = 50;

function point(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + Math.cos(rad) * radius,
    y: CENTER + Math.sin(rad) * radius,
  };
}

export default function AgeFilterDial({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (hours: number | null) => void;
}) {
  const active =
    DIAL_OPTIONS.find((o) => o.hours === value) ?? DIAL_OPTIONS[1];
  const needleTip = point(active.angle, NEEDLE_LEN);

  return (
    <div className={styles.ageDial}>
      <svg
        viewBox="0 0 120 120"
        className={styles.ageDialSvg}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="ageDialGrad"
            gradientUnits="userSpaceOnUse"
            x1="8"
            y1="8"
            x2="112"
            y2="112"
          >
            <stop offset="0%" stopColor="var(--sy-accent-text)" />
            <stop offset="100%" stopColor="var(--sy-accent-gradient-to)" />
          </linearGradient>
        </defs>

        {/* Anneau pointillé ambiant, tourne en continu — écho du rond de menu */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r="55"
          className={styles.ageDialSpin}
          fill="none"
          stroke="url(#ageDialGrad)"
          strokeWidth="1.5"
          strokeDasharray="3 9"
        />

        <circle cx={CENTER} cy={CENTER} r="46" className={styles.ageDialFace} />

        {DIAL_OPTIONS.map((o) => {
          const inner = point(o.angle, TICK_INNER);
          const outer = point(o.angle, TICK_OUTER);
          const isActive = o.hours === active.hours;
          return (
            <line
              key={o.label}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className={
                isActive ? styles.ageDialTickActive : styles.ageDialTick
              }
            />
          );
        })}

        <line
          x1={CENTER}
          y1={CENTER}
          x2={needleTip.x}
          y2={needleTip.y}
          className={styles.ageDialNeedle}
        />
        <circle cx={CENTER} cy={CENTER} r="4" className={styles.ageDialHub} />
      </svg>

      {DIAL_OPTIONS.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.hours)}
          aria-pressed={o.hours === active.hours}
          className={`${styles.ageDialLabel} ${
            o.hours === active.hours ? styles.ageDialLabelActive : ""
          }`}
          style={{ left: `${o.left}%`, top: `${o.top}%` }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
