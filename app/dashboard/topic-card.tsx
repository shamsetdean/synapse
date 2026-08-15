"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
export default function TopicCard({ topic }: { topic: Topic }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const paused = topic.status !== "active";

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
        <div className={styles.topicName}>{topic.name}</div>
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
