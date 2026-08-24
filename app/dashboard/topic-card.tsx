"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { topicColorFor, useIsLightTheme } from "./topic-colors";
import styles from "./dashboard.module.css";

type Topic = {
  id: string;
  name: string;
  status: string;
  keywords: { id: string; term: string }[];
};

// Carte de sujet reprise de la charte : pastille de statut, mots-clés en
// puces individuelles, ligne d'actions avec Pause à gauche et Supprimer en
// texte simple à droite.
//
// Ajouts de forme uniquement (cahier des charges §4) : accent nébuleuse
// pulsant à côté du nom (intensité liée au volume d'articles du sujet,
// éteint en pause), et troncature ellipsis du nom pour qu'il ne passe jamais
// sous le badge de statut.
export default function TopicCard({
  topic,
  articleCount,
  maxArticleCount,
}: {
  topic: Topic;
  articleCount: number;
  maxArticleCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const isLight = useIsLightTheme();

  const paused = topic.status !== "active";
  const volFrac = Math.min(1, articleCount / Math.max(1, maxArticleCount));
  const pulseAmp = 1.01 + volFrac * 0.09;
  const pulseDur = 5.2 - volFrac * 3.4;
  const accentColor = topicColorFor(topic.name, isLight);

  async function togglePause() {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase
      .from("topics")
      .update({ status: paused ? "active" : "paused" })
      .eq("id", topic.id);
    setLoading(false);
    // Le retour d'erreur était ignoré : un refus produisait une interface
    // affichant un changement qui n'avait pas eu lieu.
    if (err) {
      setError("Changement d'état impossible.");
      return;
    }
    router.refresh();
  }

  async function deleteTopic() {
    if (!confirm(`Supprimer le sujet "${topic.name}" ?`)) return;
    setLoading(true);
    setError(null);
    const { error: err } = await supabase
      .from("topics")
      .delete()
      .eq("id", topic.id);
    setLoading(false);
    if (err) {
      setError("Suppression impossible.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className={styles.topicHeadRow}>
        <span
          className={`${styles.topicNebulaDot} ${paused ? styles.topicNebulaDotPaused : ""}`}
          style={{
            background: accentColor,
            boxShadow: `0 0 10px 3px ${accentColor}55`,
            ["--sy-pulse-amp" as string]: pulseAmp,
            ["--sy-pulse-dur" as string]: `${pulseDur}s`,
          }}
          aria-hidden="true"
        />
        <div className={styles.topicName} title={topic.name}>
          {topic.name}
        </div>
        <div
          className={`${styles.statusPill} ${
            paused ? styles.statusPillPaused : styles.statusPillActive
          }`}
        >
          {paused ? "En pause" : "Actif"}
        </div>
      </div>

      {topic.keywords.length > 0 ? (
        <div className={styles.keywordChips}>
          {topic.keywords.map((k) => (
            <span key={k.id} className={styles.keywordChip}>
              {k.term}
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.topicNoKeyword}>Aucun mot-clé</div>
      )}

      {error && (
        <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>
      )}

      <div className={styles.topicFooter}>
        <button
          type="button"
          onClick={togglePause}
          disabled={loading}
          className={styles.pauseBtn}
        >
          {loading && <span className={styles.btnSpinner} aria-hidden="true" />}
          {paused ? "Reprendre" : "Pause"}
        </button>
        <button
          type="button"
          onClick={deleteTopic}
          disabled={loading}
          className={styles.deleteBtn}
        >
          {loading && <span className={styles.btnSpinner} aria-hidden="true" />}
          Supprimer
        </button>
      </div>
    </>
  );
}
