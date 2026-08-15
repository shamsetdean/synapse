"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./dashboard.module.css";

type DashboardStats = {
  total_found: number;
  total_read: number;
  total_favorited: number;
  total_dismissed: number;
  new_last_24h: number;
  by_language: { language: string | null; count: number }[];
  by_source: { name: string; count: number }[];
  daily_evolution: { day: string; count: number }[];
};

// Couleurs de langue de la charte.
const LANG_COLORS: Record<string, string> = {
  fr: "#8b7cf6",
  en: "#6d5fd0",
};
const LANG_FALLBACK = "#c9c2b0";

// La collecte tourne toutes les 20 minutes (voir le pied de page), donc les
// données elles-mêmes ne changent pas plus vite que ça. Interroger toutes les
// 20 secondes garde malgré tout le panneau "vivant" : les compteurs et les
// barres se remettent doucement à jour dès qu'un cycle de collecte a livré du
// nouveau, sans attendre un rechargement de page.
const POLL_MS = 20_000;

// Anime un nombre affiché entre son ancienne et sa nouvelle valeur, plutôt
// qu'un saut instantané — utilisé pour les cinq compteurs.
function useAnimatedNumber(target: number, duration = 700) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const mountedOnce = useRef(false);

  useEffect(() => {
    // Premier rendu : pas d'animation, on affiche directement la valeur.
    if (!mountedOnce.current) {
      mountedOnce.current = true;
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

function Counter({
  label,
  value,
  color,
  note,
}: {
  label: string;
  value: number;
  color: string;
  note?: string;
}) {
  const shown = useAnimatedNumber(value);
  return (
    <div className={styles.counterCard}>
      <div className={styles.counterLabel}>{label}</div>
      <div className={styles.counterValue} style={{ color }}>
        {shown}
      </div>
      {note && <div className={styles.counterNote}>{note}</div>}
    </div>
  );
}

export default function StatsPanel({ userId }: { userId: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadError, setLoadError] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_user_id: userId,
      });
      if (cancelled) return;
      if (error || !data) {
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setStats(data as DashboardStats);
    }

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loadError && !stats) {
    return (
      <div className={styles.chartSection}>
        <p className={styles.emptyState}>
          Statistiques indisponibles pour le moment.
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={styles.chartSection}>
        <p className={styles.emptyState}>Chargement des statistiques...</p>
      </div>
    );
  }

  // Les cinq compteurs de la charte. Les trois registres qui ne sont alimentés
  // par aucune action de l'interface portent une mention explicite : ils
  // afficheraient sinon un zéro permanent que rien n'expliquerait.
  const counters = [
    { label: "TOTAL TROUVÉ", value: stats.total_found, color: "var(--ink)" },
    {
      label: "TOTAL LU",
      value: stats.total_read,
      color: "var(--ink-dim)",
      note: "Registre non alimenté",
    },
    {
      label: "EN FAVORI",
      value: stats.total_favorited,
      color: "var(--ink-dim)",
      note: "Registre non alimenté",
    },
    {
      label: "ÉCARTÉ",
      value: stats.total_dismissed,
      color: "var(--ink-dim)",
      note: "Registre non alimenté",
    },
    {
      label: "NOUVEAUTÉS (<24H)",
      value: stats.new_last_24h,
      color: "var(--violet-deep)",
    },
  ];

  // La fonction de statistiques ne renvoie que les jours ayant au moins un
  // article. La charte prévoit quatorze emplacements : les jours vides sont
  // complétés ici, sans quoi deux jours de données produisaient deux barres
  // occupant toute la largeur.
  const byDay = new Map(
    (stats.daily_evolution ?? []).map((d) => [d.day.slice(0, 10), d.count]),
  );
  const today = new Date();
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: key, count: byDay.get(key) ?? 0 };
  });
  const maxDaily = Math.max(1, ...daily.map((d) => d.count));
  const hasDaily = daily.some((d) => d.count > 0);

  const langs = (stats.by_language ?? []).filter((l) => l.count > 0);
  const totalLang = langs.reduce((sum, l) => sum + l.count, 0);
  // Les positions de départ de chaque secteur sont calculées à partir des
  // éléments précédents, sans variable d'accumulation : la règle
  // d'immuabilité de React interdit de modifier une variable extérieure
  // pendant le rendu. Le nombre de langues étant très faible, le coût est nul.
  const langSlices = langs.map((l, i) => {
    const key = (l.language ?? "").toLowerCase();
    const color = LANG_COLORS[key] ?? LANG_FALLBACK;
    const before = langs
      .slice(0, i)
      .reduce((sum, prev) => sum + prev.count, 0);
    const start = totalLang > 0 ? (before / totalLang) * 100 : 0;
    const pct = totalLang > 0 ? (l.count / totalLang) * 100 : 0;
    return {
      label: (l.language ?? "??").toUpperCase(),
      color,
      slice: `${color} ${start.toFixed(1)}% ${(start + pct).toFixed(1)}%`,
      pctLabel: `${Math.round(pct)}%`,
    };
  });

  const sourceStats = stats.by_source ?? [];
  const maxSource = Math.max(1, ...sourceStats.map((s) => s.count));

  return (
    <div className={styles.configStack}>
      <div className={styles.counterGrid}>
        {counters.map((c) => (
          <Counter key={c.label} {...c} />
        ))}
      </div>

      <section className={styles.chartSection}>
        <div className={styles.chartHead}>
          <div className={styles.progressDot} />
          <div className={styles.chartTitle}>
            ÉVOLUTION QUOTIDIENNE — 14 DERNIERS JOURS
          </div>
        </div>
        {!hasDaily ? (
          <p className={styles.emptyState}>Pas encore assez de données.</p>
        ) : (
          <div className={styles.dailyChart}>
            {daily.map((d, i) => (
              <div key={d.day} className={styles.dailyCol}>
                <div
                  className={styles.dailyBar}
                  style={{
                    height: `${((d.count / maxDaily) * 100).toFixed(0)}%`,
                    animationDelay: `${i * 0.04}s`,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={styles.chartPair}>
        <section className={styles.chartSection}>
          <div className={styles.chartTitle}>RÉPARTITION PAR LANGUE</div>
          {langSlices.length === 0 ? (
            <p className={styles.emptyState}>Aucune donnée.</p>
          ) : (
            <div className={styles.langRow}>
              <div
                className={styles.langDonut}
                style={{
                  background: `conic-gradient(${langSlices
                    .map((l) => l.slice)
                    .join(",")})`,
                }}
              />
              <div className={styles.langLegend}>
                {langSlices.map((l) => (
                  <div key={l.label} className={styles.langItem}>
                    <div
                      className={styles.langDot}
                      style={{ background: l.color }}
                    />
                    <div className={styles.langName}>{l.label}</div>
                    <div className={styles.langPct}>{l.pctLabel}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={styles.chartSection}>
          <div className={styles.chartTitle}>RÉPARTITION PAR SOURCE</div>
          {sourceStats.length === 0 ? (
            <p className={styles.emptyState}>Aucune donnée.</p>
          ) : (
            sourceStats.map((s, i) => (
              <div key={s.name} className={styles.sourceStatRow}>
                <div className={styles.sourceStatLeft}>
                  <div className={styles.sourceStatName}>{s.name}</div>
                  <div className={styles.sourceStatTrack}>
                    <div
                      className={styles.sourceStatBar}
                      style={{
                        width: `${((s.count / maxSource) * 100).toFixed(0)}%`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  </div>
                </div>
                <div className={styles.sourceStatCount}>{s.count}</div>
              </div>
            ))
          )}
          <div className={styles.chartNote}>
            Exclut les sources personnalisées non natives.
          </div>
        </section>
      </div>
    </div>
  );
}
