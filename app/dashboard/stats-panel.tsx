"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAnimatedNumber } from "./use-animated-number";
import { hashString } from "./topic-colors";
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

// La collecte tourne toutes les 20 minutes (voir le pied de page), donc les
// données elles-mêmes ne changent pas plus vite que ça. Interroger toutes les
// 20 secondes garde malgré tout le panneau "vivant" : la sphère se remet
// doucement à jour dès qu'un cycle de collecte a livré du nouveau, sans
// attendre un rechargement de page.
const POLL_MS = 20_000;

// Géométrie de la sphère statistique (cahier des charges §5.1) : mêmes
// proportions que la sphère Articles (articles-sphere.tsx), en statique — cet
// onglet ne tourne pas, rien dans la charte ne le demande ici.
const CX = 450;
const CY = 290;
const SPHERE_R = 92;
const RAY_INNER = SPHERE_R + 4;
const RAY_LEN_MAX = 72;
const RAY_OUTER_MAX = RAY_INNER + RAY_LEN_MAX;
const SAT_BASE_R = RAY_OUTER_MAX + 55;
const LANG_CY = CY + 340;
const LANG_R = 44;
// FR en violet (accent existant de l'application), EN en teal — même
// vocabulaire de couleur que le reste de la sphère (topic-colors.ts).
const LANG_COLOR_FR = "var(--sy-accent)";
const LANG_COLOR_EN = "#7fe0c0";

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

  const totalFoundShown = useAnimatedNumber(stats?.total_found ?? 0);

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

  // La fonction de statistiques ne renvoie que les jours ayant au moins un
  // article. La charte prévoit quatorze emplacements : les jours vides sont
  // complétés ici, sans quoi peu de jours de données produisaient des rayons
  // occupant tout le pourtour.
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

  const totalLang = (stats.by_language ?? []).reduce((sum, l) => sum + l.count, 0);
  const frCount =
    (stats.by_language ?? []).find((l) => (l.language ?? "").toLowerCase() === "fr")
      ?.count ?? 0;
  const enCount =
    (stats.by_language ?? []).find((l) => (l.language ?? "").toLowerCase() === "en")
      ?.count ?? 0;
  const otherLangCount = Math.max(0, totalLang - frCount - enCount);
  const hasLangData = totalLang > 0;
  const frFrac = hasLangData ? frCount / totalLang : 0;
  const enFrac = hasLangData ? enCount / totalLang : 0;

  const sourceStats = stats.by_source ?? [];
  const maxSource = Math.max(1, ...sourceStats.map((s) => s.count));

  return (
    <div className={styles.configStack}>
      <section className={styles.chartSection}>
        <div className={styles.chartHead}>
          <div className={styles.progressDot} />
          <div className={styles.chartTitle}>APERÇU — VUE SPHÈRE</div>
        </div>

        <svg
          viewBox="0 0 900 720"
          className={styles.statsSphereSvg}
          role="img"
          aria-label="Aperçu statistique en sphère"
        >
          <defs>
            <radialGradient id="statsSphereFill" cx="0.35" cy="0.3" r="75%">
              <stop offset="0%" stopColor="var(--sy-accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--sy-accent-deep)" stopOpacity="0.03" />
            </radialGradient>
            {hasLangData && (
              <>
                <clipPath id="statsLangClipFR">
                  <rect
                    x={CX - LANG_R}
                    y={LANG_CY - LANG_R}
                    width={2 * LANG_R * frFrac}
                    height={2 * LANG_R}
                  />
                </clipPath>
                <clipPath id="statsLangClipEN">
                  <rect
                    x={CX - LANG_R + 2 * LANG_R * frFrac}
                    y={LANG_CY - LANG_R}
                    width={2 * LANG_R * enFrac}
                    height={2 * LANG_R}
                  />
                </clipPath>
              </>
            )}
          </defs>

          {hasDaily &&
            daily.map((d, i) => {
              const ang = (i / daily.length) * Math.PI * 2 - Math.PI / 2;
              const len = 12 + (d.count / maxDaily) * RAY_LEN_MAX;
              const x1 = CX + Math.cos(ang) * RAY_INNER;
              const y1 = CY + Math.sin(ang) * RAY_INNER;
              const x2 = CX + Math.cos(ang) * (RAY_INNER + len);
              const y2 = CY + Math.sin(ang) * (RAY_INNER + len);
              return (
                <line key={d.day} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.statsRay}>
                  <title>
                    {d.day} — {d.count} article{d.count > 1 ? "s" : ""}
                  </title>
                </line>
              );
            })}

          <circle cx={CX} cy={CY} r={SPHERE_R} fill="url(#statsSphereFill)" className={styles.statsSphereCircle} />
          <ellipse cx={CX} cy={CY} rx={SPHERE_R} ry={SPHERE_R * 0.35} className={styles.statsSphereMeridian} />
          <ellipse cx={CX} cy={CY} rx={SPHERE_R * 0.35} ry={SPHERE_R} className={styles.statsSphereMeridian} />

          {sourceStats.map((s, i) => {
            const h = hashString(s.name);
            const baseAng = (i / sourceStats.length) * Math.PI * 2 - Math.PI / 2;
            const ang = baseAng + (((h % 1000) / 1000) * 2 - 1) * 0.3;
            const r = SAT_BASE_R + ((((h >> 10) % 1000) / 1000) * 2 - 1) * 22;
            const sx = CX + Math.cos(ang) * r;
            const sy = CY + Math.sin(ang) * r;
            const volFrac = s.count / maxSource;
            const size = 5 + volFrac * 15;
            const anchor = Math.cos(ang) >= 0 ? "start" : "end";
            const lx = sx + (anchor === "start" ? size + 6 : -(size + 6));
            return (
              <g key={s.name}>
                <circle
                  cx={sx}
                  cy={sy}
                  r={size}
                  className={styles.statsSatellite}
                  style={{
                    ["--sy-pulse-amp" as string]: 1.02 + volFrac * 0.1,
                    ["--sy-pulse-dur" as string]: `${(4.6 - volFrac * 2.6).toFixed(2)}s`,
                  }}
                >
                  <title>
                    {s.name} — {s.count} article{s.count > 1 ? "s" : ""}
                  </title>
                </circle>
                <text x={lx} y={sy + 3} textAnchor={anchor} className={styles.statsSatelliteLabel}>
                  {s.name} · {s.count}
                </text>
              </g>
            );
          })}

          <text x={CX} y={CY - RAY_INNER - 16} textAnchor="middle" className={styles.statsSphereFresh}>
            +{stats.new_last_24h} nouveauté{stats.new_last_24h > 1 ? "s" : ""} (24h)
          </text>
          <text x={CX} y={CY - 4} textAnchor="middle" className={styles.statsSphereTotal}>
            {totalFoundShown}
          </text>
          <text x={CX} y={CY + 18} textAnchor="middle" className={styles.statsSphereTotalLabel}>
            Total trouvé
          </text>

          {hasLangData && (
            <>
              <circle cx={CX} cy={LANG_CY} r={LANG_R} className={styles.statsLangBase} />
              <circle cx={CX} cy={LANG_CY} r={LANG_R} fill={LANG_COLOR_FR} opacity="0.6" clipPath="url(#statsLangClipFR)" />
              <circle cx={CX} cy={LANG_CY} r={LANG_R} fill={LANG_COLOR_EN} opacity="0.6" clipPath="url(#statsLangClipEN)" />
              <ellipse cx={CX} cy={LANG_CY} rx={LANG_R} ry={LANG_R * 0.35} className={styles.statsSphereMeridian} />
              <text x={CX - LANG_R - 10} y={LANG_CY + 4} textAnchor="end" className={styles.statsLangLabel}>
                FR {Math.round(frFrac * 100)}%
              </text>
              <text x={CX + LANG_R + 10} y={LANG_CY + 4} textAnchor="start" className={styles.statsLangLabel}>
                EN {Math.round(enFrac * 100)}%
              </text>
              {otherLangCount > 0 && (
                <text x={CX} y={LANG_CY + LANG_R + 22} textAnchor="middle" className={styles.statsLangLabel}>
                  +{otherLangCount} autre{otherLangCount > 1 ? "s" : ""} langue
                  {otherLangCount > 1 ? "s" : ""}
                </text>
              )}
            </>
          )}
        </svg>

        {/* Total lu, En favori, Écarté : restent en texte simple tant que ces
            registres ne sont pas alimentés (voir le fond, inchangé), sans
            forme sphérique tant qu'ils sont à zéro (cahier des charges §5.1). */}
        <div className={styles.statsPlainRow}>
          <div className={styles.statsPlainItem}>
            <span className={styles.statsPlainLabel}>Total lu</span>
            <span className={styles.statsPlainValue}>Registre non alimenté</span>
          </div>
          <div className={styles.statsPlainItem}>
            <span className={styles.statsPlainLabel}>En favori</span>
            <span className={styles.statsPlainValue}>Registre non alimenté</span>
          </div>
          <div className={styles.statsPlainItem}>
            <span className={styles.statsPlainLabel}>Écarté</span>
            <span className={styles.statsPlainValue}>Registre non alimenté</span>
          </div>
        </div>

        <div className={styles.chartNote}>
          Rayons = volume quotidien sur 14 jours · satellites = sources connectées, taille ∝
          volume · sphère inférieure = répartition FR/EN. Exclut les sources personnalisées non
          natives.
        </div>
      </section>
    </div>
  );
}
