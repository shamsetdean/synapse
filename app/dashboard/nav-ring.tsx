"use client";

const PAGES = [
  { key: "articles", num: "01", name: "Articles" },
  { key: "dashboard", num: "02", name: "Sujets de veille" },
  { key: "config", num: "03", name: "Configuration" },
] as const;

export type DashboardPageKey = (typeof PAGES)[number]["key"];

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function ringSegmentPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
) {
  const oStart = polar(cx, cy, outerR, startDeg);
  const oEnd = polar(cx, cy, outerR, endDeg);
  const iEnd = polar(cx, cy, innerR, endDeg);
  const iStart = polar(cx, cy, innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${oStart.x} ${oStart.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y} L ${iEnd.x} ${iEnd.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${iStart.x} ${iStart.y} Z`;
}

export default function NavRing({
  activePage,
  onChange,
}: {
  activePage: DashboardPageKey;
  onChange: (page: DashboardPageKey) => void;
}) {
  const active = PAGES.find((p) => p.key === activePage)!;
  const cx = 32;
  const cy = 32;
  const outerR = 30;
  const innerR = 17;
  const step = 360 / PAGES.length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {active.name}
      </div>

      <div style={{ position: "relative", width: 130, height: 130 }}>
        {/* Anneau décoratif pointillé, purement animé, ne capte pas les clics */}
        <svg
          width="130"
          height="130"
          viewBox="0 0 64 64"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={outerR + 4}
            fill="none"
            stroke="var(--violet)"
            strokeWidth="0.6"
            strokeDasharray="2 4"
            opacity="0.5"
            className="synapseDecoSpin"
          />
        </svg>

        <svg width="130" height="130" viewBox="0 0 64 64" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="navRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8b7cf6" />
              <stop offset="100%" stopColor="#6d5fd0" />
            </linearGradient>
          </defs>
          {PAGES.map((p, i) => {
            const start = i * step;
            const end = start + step - 2;
            return (
              <path
                key={p.key}
                d={ringSegmentPath(cx, cy, outerR, innerR, start, end)}
                fill={activePage === p.key ? "url(#navRingGrad)" : "#e2dcc9"}
                onClick={() => onChange(p.key)}
                className="synapseNavQuad"
              />
            );
          })}
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "var(--cream)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 20,
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            {active.num}
          </div>
        </div>
      </div>

      <style>{`
        .synapseDecoSpin {
          animation: synapseDecoRotate 20s linear infinite;
          transform-origin: 32px 32px;
        }
        @keyframes synapseDecoRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .synapseNavQuad {
          cursor: pointer;
          transition: fill 0.25s ease, opacity 0.2s ease;
        }
        .synapseNavQuad:hover {
          opacity: 0.75;
        }
      `}</style>
    </div>
  );
}
