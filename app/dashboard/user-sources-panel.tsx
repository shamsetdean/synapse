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

const RSS_COMPATIBLE = new Set([
  "rss",
  "website",
  "blog",
  "newsletter",
  "youtube",
  "podcast",
]);

const SYNC_OPTIONS = [
  { value: 20, label: "Toutes les 20 min" },
  { value: 60, label: "Toutes les heures" },
  { value: 360, label: "Toutes les 6h" },
  { value: 1440, label: "Une fois par jour" },
];

function syncLabel(source: UserSource): string {
  if (!RSS_COMPATIBLE.has(source.type)) return "Non synchronisé";
  if (!source.active) return "Désactivée";
  if (!source.last_synced_at) return "En attente de sync";
  const minutesAgo = Math.round(
    (Date.now() - new Date(source.last_synced_at).getTime()) / 60000,
  );
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
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testingForm, setTestingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowState, setRowState] = useState<
    Record<string, "idle" | "testing" | "ok" | "error">
  >({});
  const supabase = createClient();
  const router = useRouter();

  const rssCompatible = RSS_COMPATIBLE.has(type);

  async function handleFormTest() {
    if (!url.trim()) return;
    setTestingForm(true);
    setTestResult(null);
    try {
      const { data, error: err } = await supabase.functions.invoke(
        "test-source",
        { body: { url: url.trim() } },
      );
      if (err || !data?.ok) {
        setTestResult({ ok: false, message: data?.error ?? "Échec du test." });
      } else {
        setTestResult({
          ok: true,
          message: `${data.feedTitle ?? "Flux valide"} — ${
            data.articleCount
          } article(s) détecté(s).`,
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
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expirée, reconnectez-vous.");
      setSaving(false);
      return;
    }

    const { data: newSource, error: err } = await supabase
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

    setSaving(false);

    // Les retours d'erreur étaient ignorés : un refus produisait une interface
    // affichant un ajout qui n'avait pas eu lieu.
    if (err || !newSource) {
      setError("La source n'a pas pu être ajoutée.");
      return;
    }

    setSources((prev) => [newSource as UserSource, ...prev]);
    setName("");
    setUrl("");
    setCategory("");
    setLanguage("");
    setCountry("");
    setTestResult(null);
    router.refresh();
  }

  async function testRow(source: UserSource) {
    setRowState((s) => ({ ...s, [source.id]: "testing" }));
    try {
      const { data, error: err } = await supabase.functions.invoke(
        "test-source",
        { body: { url: source.url } },
      );
      const ok = !err && data?.ok;
      setRowState((s) => ({ ...s, [source.id]: ok ? "ok" : "error" }));
    } catch {
      setRowState((s) => ({ ...s, [source.id]: "error" }));
    }
    setTimeout(() => {
      setRowState((s) => ({ ...s, [source.id]: "idle" }));
    }, 2200);
  }

  async function toggleActive(source: UserSource) {
    const { error: err } = await supabase
      .from("user_sources")
      .update({ active: !source.active })
      .eq("id", source.id);
    if (err) {
      setError("Le changement d'état n'a pas pu être enregistré.");
      return;
    }
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, active: !s.active } : s)),
    );
  }

  async function renameSource(source: UserSource) {
    const newName = prompt("Nouveau nom :", source.name);
    if (!newName || !newName.trim()) return;
    const { error: err } = await supabase
      .from("user_sources")
      .update({ name: newName.trim() })
      .eq("id", source.id);
    if (err) {
      setError("Le renommage n'a pas pu être enregistré.");
      return;
    }
    setSources((prev) =>
      prev.map((s) =>
        s.id === source.id ? { ...s, name: newName.trim() } : s,
      ),
    );
  }

  async function deleteSource(source: UserSource) {
    if (!confirm(`Supprimer la source "${source.name}" ?`)) return;
    const { error: err } = await supabase
      .from("user_sources")
      .delete()
      .eq("id", source.id);
    if (err) {
      setError("La suppression n'a pas pu être effectuée.");
      return;
    }
    setSources((prev) => prev.filter((s) => s.id !== source.id));
  }

  return (
    <div className={styles.configStack}>
      <form onSubmit={handleSubmit} className={styles.sourceForm}>
        <div className={styles.sourceFormTitle}>AJOUTER UNE SOURCE</div>

        <div className={styles.sourceFormGrid}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la source"
            className={styles.sourceFormInput}
            aria-label="Nom de la source"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={styles.sourceFormInput}
            aria-label="Type de source"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setTestResult(null);
            }}
            placeholder="URL du flux"
            className={styles.sourceFormInput}
            aria-label="URL du flux"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Catégorie"
            className={styles.sourceFormInput}
            aria-label="Catégorie"
          />
          <input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Langue (ex. FR)"
            maxLength={2}
            className={styles.sourceFormInput}
            aria-label="Langue"
          />
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Pays (ex. FR)"
            maxLength={2}
            className={styles.sourceFormInput}
            aria-label="Pays"
          />
          <select
            value={syncFrequency}
            onChange={(e) => setSyncFrequency(Number(e.target.value))}
            className={styles.sourceFormInput}
            aria-label="Fréquence de synchronisation"
          >
            {SYNC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {!rssCompatible && (
          <div className={styles.chartNote}>
            Ce type de source est enregistré mais n&apos;est pas encore
            collecté.
          </div>
        )}

        {testResult && (
          <div
            className={styles.testResult}
            style={{
              color: testResult.ok ? "var(--violet-deep)" : "var(--danger)",
            }}
          >
            {testResult.message}
          </div>
        )}

        {error && (
          <div className={styles.testResult} style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <div className={styles.sourceFormActions}>
          <button
            type="button"
            onClick={handleFormTest}
            disabled={testingForm || !url.trim() || !rssCompatible}
            className={styles.btnTest}
          >
            {testingForm ? "Test en cours..." : "Tester la source"}
          </button>
          <button type="submit" disabled={saving} className={styles.btnAdd}>
            {saving ? "Ajout..." : "Ajouter la source"}
          </button>
        </div>
      </form>

      <div className={styles.sourceList}>
        {sources.length === 0 && (
          <p className={styles.emptyState}>
            Aucune source personnalisée pour l&apos;instant.
          </p>
        )}

        {sources.map((source) => {
          const unsupported = !RSS_COMPATIBLE.has(source.type);
          const state = rowState[source.id] ?? "idle";
          const testLabel =
            state === "testing"
              ? "Test…"
              : state === "ok"
                ? "Connecté"
                : state === "error"
                  ? "Échec"
                  : "Tester la connexion";

          return (
            <div
              key={source.id}
              className={`${styles.sourceRow} ${
                source.active ? "" : styles.sourceRowInactive
              }`}
            >
              <div className={styles.sourceRowLeft}>
                <div
                  className={`${styles.sourceIcon} ${
                    unsupported ? styles.sourceIconPending : ""
                  }`}
                >
                  {source.name[0]?.toUpperCase() ?? "?"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.sourceNameRow}>
                    <span className={styles.sourceName}>{source.name}</span>
                    <span className={styles.sourceTypeTag}>
                      {SOURCE_TYPES.find((t) => t.value === source.type)
                        ?.label ?? source.type}
                    </span>
                    {unsupported && (
                      <span className={styles.sourcePendingTag}>
                        Non collecté pour l&apos;instant
                      </span>
                    )}
                  </div>
                  <div className={styles.sourceHandle}>{source.url}</div>
                </div>
              </div>

              <div className={styles.sourceRowRight}>
                <div className={styles.reliabilityBlock}>
                  <div className={styles.reliabilityLabel}>FIABILITÉ</div>
                  <div className={styles.reliabilityValue}>
                    {source.reliability_rating} / 5
                  </div>
                </div>

                <div className={styles.syncStatus}>
                  <div
                    className={`${styles.syncDot} ${
                      source.active && !unsupported ? "" : styles.syncDotPending
                    }`}
                  />
                  <div className={styles.syncLabel}>{syncLabel(source)}</div>
                </div>

                {!unsupported && (
                  <button
                    type="button"
                    onClick={() => testRow(source)}
                    disabled={state === "testing"}
                    className={`${styles.testBtn} ${
                      state === "testing" ? styles.testBtnTesting : ""
                    } ${state === "ok" ? styles.testBtnOk : ""}`}
                  >
                    {testLabel}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => renameSource(source)}
                  className={styles.sourceActionBtn}
                >
                  Renommer
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(source)}
                  className={styles.sourceActionBtn}
                >
                  {source.active ? "Désactiver" : "Activer"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteSource(source)}
                  className={styles.deleteBtn}
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
