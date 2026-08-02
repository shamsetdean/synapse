"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import styles from "./dashboard.module.css";

const VIOLET_SHADES = ["#6d5fd0", "#8b7cf6", "#a89bf8", "#c4b8ff", "#dcd5c6"];

type LanguageStat = { language: string | null; count: number };
type SourceStat = { name: string; count: number };
type DailyStat = { day: string; count: number };

function langLabel(code: string | null): string {
  if (code === "fr") return "Français";
  if (code === "en") return "Anglais";
  return "Autre";
}

export default function StatsCharts({
  byLanguage,
  bySource,
  dailyEvolution,
}: {
  byLanguage: LanguageStat[];
  bySource: SourceStat[];
  dailyEvolution: DailyStat[];
}) {
  const languageData = byLanguage.map((l) => ({
    name: langLabel(l.language),
    value: l.count,
  }));

  const sourceData = bySource.slice(0, 6).map((s) => ({
    name: s.name,
    count: s.count,
  }));

  const dailyData = dailyEvolution.map((d) => ({
    day: new Date(d.day).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    }),
    count: d.count,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div className={styles.sectionTitle} style={{ marginBottom: 10 }}>
          Évolution (14 derniers jours)
        </div>
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "16px 12px",
            height: 180,
          }}
        >
          {dailyData.length === 0 ? (
            <p className={styles.emptyState}>Pas encore assez de données.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--ink-dim)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--ink-dim)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6d5fd0"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#6d5fd0" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div className={styles.sectionTitle} style={{ marginBottom: 10 }}>
            Par langue
          </div>
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 12,
              height: 180,
            }}
          >
            {languageData.length === 0 ? (
              <p className={styles.emptyState}>Aucune donnée.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={languageData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={55}
                    label={{ fontSize: 10 }}
                  >
                    {languageData.map((_, i) => (
                      <Cell key={i} fill={VIOLET_SHADES[i % VIOLET_SHADES.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <div className={styles.sectionTitle} style={{ marginBottom: 10 }}>
            Par source
          </div>
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 12,
              height: 180,
            }}
          >
            {sourceData.length === 0 ? (
              <p className={styles.emptyState}>Aucune donnée.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--ink-dim)" }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 9, fill: "var(--ink-dim)" }}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#6d5fd0" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
