import { createClient } from "@/lib/supabase/server";
import StatsCharts from "./stats-charts";
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

export default async function StatsPanel({ userId }: { userId: string }) {
  const supabase = createClient();
  const { data } = await supabase.rpc("get_dashboard_stats", {
    p_user_id: userId,
  });

  const stats = data as DashboardStats | null;

  if (!stats) {
    return (
      <div className={styles.panel}>
        <p className={styles.emptyState}>Statistiques indisponibles.</p>
      </div>
    );
  }

  const readRate =
    stats.total_found > 0
      ? Math.round((stats.total_read / stats.total_found) * 100)
      : 0;

  const cards = [
    { label: "Articles trouvés", value: stats.total_found },
    { label: "Articles lus", value: stats.total_read },
    { label: "Favoris", value: stats.total_favorited },
    { label: "Ignorés", value: stats.total_dismissed },
    { label: "Nouveaux (24h)", value: stats.new_last_24h },
    { label: "Taux de lecture", value: `${readRate}%` },
  ];

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                fontFamily: "'Courier New', monospace",
              }}
            >
              {card.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      <StatsCharts
        byLanguage={stats.by_language}
        bySource={stats.by_source}
        dailyEvolution={stats.daily_evolution}
      />
    </div>
  );
}
