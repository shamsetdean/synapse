"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./dashboard.module.css";

type UserSource = {
  id: string;
  name: string;
  url: string;
  type: string;
  category: string | null;
  active: boolean;
  reliability_rating: number;
  language: string | null;
  country: string | null;
  sync_frequency_minutes: number;
  last_synced_at: string | null;
  last_test_status: string | null;
};

const SOURCE_TYPES = [
  { value: "rss", label: "Flux RSS" },
  { value: "website", label: "Site web" },
  { value: "blog", label: "Blog" },
  { value: "newsletter", label: "Newsletter" },
  { value: "youtube", label: "Chaîne YouTube" },
  { value: "podcast", label: "Podcast" },
  { value: "twitter", label: "Compte X (Twitter)" },
  { value: "linkedin", label: "Compte LinkedIn" },
  { value: "reddit", label: "Publication Reddit" },
  { value: "github", label: "Dépôt GitHub" },
  { value: "api", label: "API publique" },
  { value: "other", label: "Autre" },
];

const RSS_COMPATIBLE = new Set(["rss", "website", "blog", "newsletter", "youtube", "podcast"]);

const SYNC_OPTIONS = [
  { value: 20, label: "Toutes les 20 min" },
  { value: 60, label: "Toutes les heures" },
  { value: 360, label: "Toutes les 6h" },
  { value: 1440, label: "1 fois par jour" },
];

function syncLabel(source: UserSource): string {
  if (!RSS_COMPATIBLE.has(source.type)) return "Non connecté";
  if (!source.last_synced_at) return "En attente de sync";
  const minutesAgo = Math.round((Date.now() - new Date(source.last_synced_at).getTime()) / 60000);
  if (minutesAgo < 1) return "synchro. à l'instant";
  if (minutesAgo < 60) return `synchro. il y a ${minutesAgo} min`;
  return `synchro. il y a ${Math.round(minutesAgo / 60)} h`;
}

export default function UserSourcesPanel({
  initialSources,
}: {
  initialSources: UserSource[];
}) {
  const [sources, setSources] = useState<UserSource[]>(initialSources);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("rss");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [country, setCountry] = useState("");
  const [syncFrequency, setSyncFrequency] = useState(60);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingForm, setTestingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowTestState, setRowTestState] = useState<Record<string, "idle" | "testing" | "ok" | "error">>({});
  const supabase = createClient();
  const router = useRouter();

  async function handleFormTest() {
    if (!url.trim()) return;
    setTestingForm(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-source", {
        body: { url: url.trim() },
      });
      if (error || !data?.ok) {
        setTestResult({ ok: false, message: data?.error ?? "Échec du test." });
      } else {
        setTestResult({
          ok: true,
          message: `${data.feedTitle ?? "Flux valide"} — ${data.articleCount} article(s) détecté(s).`,
        });
      }
    } catch {
      setTestResult({ ok: false, message: "Erreur lors du test." });
    }
    setTestingForm(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { data: newSource } = await supabase
      .from("user_sources")
      .insert({
        user_id: user.id,
        name: name.trim(),
        url: url.trim(),
        type,
        category: category.trim() || null,
        language: language.trim() || null,
        country: country.trim() || null,
        sync_frequency_minutes: syncFrequency,
        last_test_status: testResult?.ok ? "success" : null,
      })
      .select()
      .single();

    if (newSource) {
      setSources((prev) => [newSource as UserSource, ...prev]);
    }

    setName("");
    setUrl("");
    setCategory("");
    setLanguage("");
    setCountry("");
    setTestResult(null);
    setSaving(false);
    router.refresh();
  }

  async function testRow(source: UserSource) {
    setRowTestState((s) => ({ ...s, [source.id]: "testing" }));
    try {
      const { data, error } = await supabase.functions.invoke("test-source", {
        body: { url: source.url },
      });
      const ok = !error && data?.ok;
      setRowTestState((s) => ({ ...s, [source.id]: ok ? "ok" : "error" }));
      setTimeout(() => {
        setRowTestState((s) => ({ ...s, [source.id]: "idle" }));
      }, 2200);
    } catch {
      setRowTestState((s) => ({ ...s, [source.id]: "error" }));
      setTimeout(() => {
        setRowTestState((s) => ({ ...s, [source.id]: "idle" }));
      }, 2200);
    }
  }

  async function toggleActive(source: UserSource) {
    await supabase.from("user_sources").update({ active: !source.active }).eq("id", source.id);
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, active: !s.active } : s)),
    );
  }

  async function renameSource(source: UserSource) {
    const newName = prompt("Nouveau nom :", source.name);
    if (!newName || !newName.trim()) return;
    await supabase.from("user_sources").update({ name: newName.trim() }).eq("id", source.id);
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, name: newName.trim() } : s)),
    );
  }

  async function deleteSource(source: UserSource) {
    if (!confirm(`Supprimer la source "${source.name}" ?`)) return;
    await supabase.from("user_sources").delete().eq("id", source.id);
    setSources((prev) => prev.filter((s) => s.id !== source.id));
  }

  const showsRssWarning = !RSS_COMPATIBLE.has(type);

  return (
    <div>
      <div className={styles.panel}>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Nom de la source</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. TechCrunch"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Type</label>
            <select
              className={styles.input}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>URL {RSS_COMPATIBLE.has(type) ? "(flux RSS)" : ""}</label>
            <input
              className={styles.input}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
              placeholder="https://..."
            />
          </div>

          {showsRssWarning && (
            <p style={{ fontSize: 11, color: "var(--ink-dim)", marginBottom: 14 }}>
              Ce type de source n&apos;est pas encore synchronisé automatiquement. Elle sera
              enregistrée mais restera en attente d&apos;intégration.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className={styles.field}>
              <label className={styles.label}>Catégorie</label>
              <input
                className={styles.input}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex. Tech"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Langue</label>
              <input
                className={styles.input}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="fr, en..."
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className={styles.field}>
              <label className={styles.label}>Pays</label>
              <input
                className={styles.input}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="FR, US..."
              />
            </div>
            <div className={styles.fieldLast}>
              <label className={styles.label}>Fréquence de sync</label>
              <select
                className={styles.input}
                value={syncFrequency}
                onChange={(e) => setSyncFrequency(Number(e.target.value))}
              >
                {SYNC_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {RSS_COMPATIBLE.has(type) && (
            <div style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={handleFormTest}
                disabled={testingForm || !url.trim()}
                className={styles.btnGhost}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {testingForm ? "Test en cours..." : "Tester la source"}
              </button>
              {testResult && (
                <p
                  style={{
                    fontSize: 12,
                    marginTop: 8,
                    color: testResult.ok ? "var(--violet-deep)" : "var(--danger)",
                  }}
                >
                  {testResult.message}
                </p>
              )}
            </div>
          )}

          <button type="submit" disabled={saving} className={styles.btnPrimary}>
            {saving ? "Ajout..." : "Ajouter la source"}
          </button>
        </form>
      </div>

      <div className={styles.sourceList}>
        {sources.length === 0 && (
          <p className={styles.emptyState}>Aucune source personnalisée pour l&apos;instant.</p>
        )}
        {sources.map((source) => {
          const pending = !RSS_COMPATIBLE.has(source.type);
          const testState = rowTestState[source.id] ?? "idle";
          const testLabel =
            testState === "testing" ? "Test…" : testState === "ok" ? "✓ Connecté" : testState === "error" ? "Échec" : "Tester la connexion";

          return (
            <div key={source.id} className={styles.sourceRow}>
              <div className={styles.sourceRowLeft}>
                <div className={`${styles.sourceIcon} ${pending ? styles.sourceIconPending : ""}`}>
                  {source.name[0]?.toUpperCase() ?? "?"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div className={styles.sourceNameRow}>
                    <span className={styles.sourceName}>{source.name}</span>
                    <span className={styles.sourceTypeTag}>
                      {SOURCE_TYPES.find((t) => t.value === source.type)?.label ?? source.type}
                    </span>
                    {pending && <span className={styles.sourcePendingTag}>Extension prévue</span>}
                  </div>
                  <div className={styles.sourceHandle}>{source.url}</div>
                </div>
              </div>

              <div className={styles.sourceRowRight}>
                <div className={styles.reliabilityBlock}>
                  <div className={styles.reliabilityLabel}>FIABILITÉ</div>
                  <div className={styles.reliabilityBarWrap}>
                    <div
                      className={`${styles.reliabilityBar} ${
                        source.reliability_rating < 3.5 ? styles.reliabilityBarLow : ""
                      }`}
                      style={{ width: `${(source.reliability_rating / 5) * 100}%` }}
                    />
                  </div>
                </div>

                <div className={styles.syncStatus}>
                  <div className={`${styles.syncDot} ${pending ? styles.syncDotPending : ""}`} />
                  <div className={styles.syncLabel}>{syncLabel(source)}</div>
                </div>

                {!pending && (
                  <button
                    onClick={() => testRow(source)}
                    disabled={testState === "testing"}
                    className={`${styles.testBtn} ${
                      testState === "testing" ? styles.testBtnTesting : ""
                    } ${testState === "ok" ? styles.testBtnOk : ""}`}
                  >
                    {testLabel}
                  </button>
                )}

                <button onClick={() => renameSource(source)} className={styles.btnGhost}>
                  Renommer
                </button>
                <button onClick={() => toggleActive(source)} className={styles.btnGhost}>
                  {source.active ? "Désactiver" : "Activer"}
                </button>
                <button
                  onClick={() => deleteSource(source)}
                  className={`${styles.btnGhost} ${styles.btnDanger}`}
                >
                  Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
