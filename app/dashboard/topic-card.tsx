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

export default function TopicCard({ topic }: { topic: Topic }) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function togglePause() {
    setLoading(true);
    await supabase
      .from("topics")
      .update({ status: topic.status === "active" ? "paused" : "active" })
      .eq("id", topic.id);
    setLoading(false);
    router.refresh();
  }

  async function deleteTopic() {
    if (!confirm(`Supprimer le sujet "${topic.name}" ?`)) return;
    setLoading(true);
    await supabase.from("topics").delete().eq("id", topic.id);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className={styles.topicCard}>
      <div className={styles.topicInfo}>
        <h3 className={styles.topicName}>{topic.name}</h3>
        <p className={styles.topicKeywords}>
          {topic.keywords.length > 0
            ? topic.keywords.map((k) => k.term).join(", ")
            : "Aucun mot-clé"}
        </p>
      </div>
      <div className={styles.topicActions}>
        <span
          className={`${styles.statusBadge} ${
            topic.status === "active" ? "" : styles.statusBadgePaused
          }`}
        >
          {topic.status === "active" ? "Actif" : "En pause"}
        </span>
        <button onClick={togglePause} disabled={loading} className={styles.btnGhost}>
          {topic.status === "active" ? "Mettre en pause" : "Réactiver"}
        </button>
        <button
          onClick={deleteTopic}
          disabled={loading}
          className={`${styles.btnGhost} ${styles.btnDanger}`}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
