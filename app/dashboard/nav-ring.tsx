"use client";

const PAGES = [
  { key: "dashboard", num: "01", name: "Tableau de bord" },
  { key: "articles", num: "02", name: "Articles" },
  { key: "stats", num: "03", name: "Statistiques" },
  { key: "sources", num: "04", name: "Sources" },
] as const;

export type DashboardPageKey = (typeof PAGES)[number]["key"];

export default function NavRing({
  activePage,
  onChange,
}: {
  activePage: DashboardPageKey;
  onChange: (page: DashboardPageKey) => void;
}) {
  const active = PAGES.find((p) => p.key === activePage)!;

  const quadrantPath: Record<DashboardPageKey, string> = {
    dashboard:
      "M 10.79 10.79 A 30 30 0 0 1 53.21 10.79 L 44.73 19.27 A 18 18 0 0 0 19.27 19.27 Z",
    articles:
      "M 53.21 10.79 A 30 30 0 0 1 53.21 53.21 L 44.73 44.73 A 18 18 0 0 0 44.73 19.27 Z",
    stats:
      "M 53.21 53.21 A 30 30 0 0 1 10.79 53.21 L 19.27 44.73 A 18 18 0 0 0 44.73 44.73 Z",
    sources:
      "M 10.79 53.21 A 30 30 0 0 1 10.79 10.79 L 19.27 19.27 A 18 18 0 0 0 19.27 44.73 Z",
  };

  const labelPos: Record<DashboardPageKey, { x: number; y: number }> = {
    dashboard: { x: 32, y: 8 },
    articles: { x: 56, y: 32 },
    stats: { x: 32, y: 56 },
    sources: { x: 8, y: 32 },
  };

  const digit: Record<DashboardPageKey, string> = {
    dashboard: "1",
    articles: "2",
    stats: "3",
    sources: "4",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-end" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ink-dim)",
            letterSpacing: "0.05em",
          }}
        >
          {active.num} —
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}>
          {active.name}
        </div>
      </div>

      <div style={{ animation: "navBreathe 3.2s ease-in-out infinite" }}>
        <svg width="60" height="60" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="navRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8b7cf6" />
              <stop offset="100%" stopColor="#6d5fd0" />
            </linearGradient>
          </defs>
          {PAGES.map((p) => (
            <path
              key={p.key}
              d={quadrantPath[p.key]}
              fill={activePage === p.key ? "url(#navRingGrad)" : "#e2dcc9"}
              onClick={() => onChange(p.key)}
              style={{ cursor: "pointer", transition: "fill 0.25s ease" }}
            />
          ))}
          <circle cx="32" cy="32" r="17" fill="var(--cream)" stroke="var(--line)" strokeWidth="1" />
          <text
            x="32"
            y="32"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-mono)"
            fontSize="13"
            fontWeight="600"
            fill="var(--ink)"
          >
            {active.num}
          </text>
          {PAGES.map((p) => (
            <text
              key={p.key}
              x={labelPos[p.key].x}
              y={labelPos[p.key].y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="var(--font-mono)"
              fontSize="7"
              fill={activePage === p.key ? "#f2ede3" : "var(--ink-dim)"}
            >
              {digit[p.key]}
            </text>
          ))}
        </svg>
      </div>

      <style>{`
        @keyframes navBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
      `}</style>
    </div>
  );
}
