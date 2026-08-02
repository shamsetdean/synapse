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
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleTest() {
    if (!url.trim()) return;
    setTesting(true);
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
    setTesting(false);
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

  async function toggleActive(source: UserSource) {
    await supabase
      .from("user_sources")
      .update({ active: !source.active })
      .eq("id", source.id);
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
              style={{ background: "transparent" }}
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
                style={{ background: "transparent" }}
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
                onClick={handleTest}
                disabled={testing || !url.trim()}
                className={styles.btnGhost}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {testing ? "Test en cours..." : "Tester la source"}
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

      <div className={styles.topicList}>
        {sources.length === 0 && (
          <p className={styles.emptyState}>Aucune source personnalisée pour l&apos;instant.</p>
        )}
        {sources.map((source) => (
          <div key={source.id} className={styles.topicCard}>
            <div className={styles.topicInfo}>
              <div className={styles.topicName}>{source.name}</div>
              <div className={styles.topicKeywords}>
                {SOURCE_TYPES.find((t) => t.value === source.type)?.label ?? source.type}
                {source.category ? ` · ${source.category}` : ""}
                {source.language ? ` · ${source.language}` : ""}
                {source.country ? ` · ${source.country}` : ""}
                {" · ★ "}
                {source.reliability_rating}
              </div>
            </div>
            <div className={styles.topicActions}>
              <span
                className={`${styles.statusBadge} ${
                  source.active ? "" : styles.statusBadgePaused
                }`}
              >
                {source.active ? "Actif" : "Inactif"}
              </span>
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
        ))}
      </div>
    </div>
  );
}
