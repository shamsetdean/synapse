"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./dashboard.module.css";

type SortBy = "date" | "source" | "topic";
type Density = "compact" | "comfortable";
type VisibleFields = { source: boolean; freshness: boolean; summary: boolean };
type DefaultView = "sphere" | "list";
type CloudDensity = "light" | "normal" | "dense";
type Preferences = {
  sortBy: SortBy;
  density: Density;
  visibleFields: VisibleFields;
  defaultView: DefaultView;
  cloudDensity: CloudDensity;
};

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "topic", label: "Sujet" },
  { value: "date", label: "Date" },
  { value: "source", label: "Source" },
];

// Interrupteurs plutôt que des cases à cocher natives : aucun contrôle de
// formulaire natif n'est stylé nulle part ailleurs dans le dashboard (voir
// .ageFilterPill, .configTab, .thumbBtn — tous des boutons à état, jamais
// un <input>). Même langage visuel, aria-pressed pour l'accessibilité.
const FIELD_OPTIONS: { key: keyof VisibleFields; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "freshness", label: "Fraîcheur" },
  { key: "summary", label: "Résumé" },
];

const VIEW_OPTIONS: { value: DefaultView; label: string }[] = [
  { value: "sphere", label: "Sphère" },
  { value: "list", label: "Liste" },
];

// "Curseur 3 crans" dans le cahier des charges, mais aucun contrôle de
// formulaire natif (input range compris) n'est stylé ailleurs dans ce
// panneau — voir le commentaire sur FIELD_OPTIONS ci-dessus. Trois pilules,
// même langage que le reste du panneau, portent la même information.
const CLOUD_DENSITY_OPTIONS: { value: CloudDensity; label: string }[] = [
  { value: "light", label: "Léger" },
  { value: "normal", label: "Normal" },
  { value: "dense", label: "Dense" },
];

export default function PreferencesPanel({
  initialPreferences,
}: {
  initialPreferences: Preferences;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function setSortBy(value: SortBy) {
    setPreferences((prev) => ({ ...prev, sortBy: value }));
    setSaved(false);
    setError(null);
  }

  function setDensity(value: Density) {
    setPreferences((prev) => ({ ...prev, density: value }));
    setSaved(false);
    setError(null);
  }

  function toggleField(key: keyof VisibleFields) {
    setPreferences((prev) => ({
      ...prev,
      visibleFields: { ...prev.visibleFields, [key]: !prev.visibleFields[key] },
    }));
    setSaved(false);
    setError(null);
  }

  function setDefaultView(value: DefaultView) {
    setPreferences((prev) => ({ ...prev, defaultView: value }));
    setSaved(false);
    setError(null);
  }

  function setCloudDensity(value: CloudDensity) {
    setPreferences((prev) => ({ ...prev, cloudDensity: value }));
    setSaved(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      setError("Session expirée. Recharge la page.");
      return;
    }

    const { error: saveError } = await supabase.from("user_preferences").upsert(
      {
        user_id: userId,
        sort_by: preferences.sortBy,
        density: preferences.density,
        // defaultView et cloudDensity partagent cette même colonne jsonb que
        // visibleFields (voir normalizeDefaultView/normalizeCloudDensity,
        // page.tsx) : pas de nouvelle colonne pour deux réglages de forme.
        visible_fields: {
          ...preferences.visibleFields,
          defaultView: preferences.defaultView,
          cloudDensity: preferences.cloudDensity,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    setSaving(false);

    if (saveError) {
      // Message générique : même logique que partout ailleurs dans le
      // projet, le détail de ce qui a précisément bloqué l'écriture (RLS,
      // réseau) ne doit pas être exposé.
      setError(
        "Échec de l'enregistrement. Réessaie, ou recharge la page si le problème persiste.",
      );
      return;
    }
    setSaved(true);
  }

  return (
    <div className={styles.formPanel}>
      <div className={styles.formField}>
        <span className={styles.formLabel}>Trier les articles par</span>
        <div className={styles.prefPills}>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSortBy(opt.value)}
              aria-pressed={preferences.sortBy === opt.value}
              className={`${styles.prefPill} ${
                preferences.sortBy === opt.value ? styles.prefPillActive : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formField}>
        <span className={styles.formLabel}>Densité d&#8217;affichage</span>
        <div className={styles.prefPills}>
          <button
            type="button"
            onClick={() => setDensity("comfortable")}
            aria-pressed={preferences.density === "comfortable"}
            className={`${styles.prefPill} ${
              preferences.density === "comfortable" ? styles.prefPillActive : ""
            }`}
          >
            Aéré
          </button>
          <button
            type="button"
            onClick={() => setDensity("compact")}
            aria-pressed={preferences.density === "compact"}
            className={`${styles.prefPill} ${
              preferences.density === "compact" ? styles.prefPillActive : ""
            }`}
          >
            Compact
          </button>
        </div>
      </div>

      <div className={styles.formField}>
        <span className={styles.formLabel}>
          Informations visibles sur chaque card
        </span>
        <div className={styles.prefPills}>
          {FIELD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggleField(opt.key)}
              aria-pressed={preferences.visibleFields[opt.key]}
              className={`${styles.prefPill} ${
                preferences.visibleFields[opt.key] ? styles.prefPillActive : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formField}>
        <span className={styles.formLabel}>Vue par défaut des Articles</span>
        <div className={styles.prefPills}>
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDefaultView(opt.value)}
              aria-pressed={preferences.defaultView === opt.value}
              className={`${styles.prefPill} ${
                preferences.defaultView === opt.value ? styles.prefPillActive : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formField}>
        <span className={styles.formLabel}>Densité du nuage (vue sphère)</span>
        <div className={styles.prefPills}>
          {CLOUD_DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCloudDensity(opt.value)}
              aria-pressed={preferences.cloudDensity === opt.value}
              className={`${styles.prefPill} ${
                preferences.cloudDensity === opt.value ? styles.prefPillActive : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.prefFooter}>
        {error && (
          <span className={styles.prefError} role="alert">
            {error}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={styles.createBtn}
        >
          {saving
            ? "Enregistrement..."
            : error
              ? "Réessayer"
              : saved
                ? "Enregistré"
                : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
