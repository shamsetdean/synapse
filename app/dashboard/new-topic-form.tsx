"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AnalysisProgress from "./analysis-progress";
import styles from "./dashboard.module.css";

export default function NewTopicForm() {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<{
    id: string;
    name: string;
    keywordsLabel: string;
  } | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expirée, reconnectez-vous.");
      setLoading(false);
      return;
    }
    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .insert({ user_id: user.id, name: name.trim() })
      .select()
      .single();
    if (topicError || !topic) {
      setError("Impossible de créer le sujet.");
      setLoading(false);
      return;
    }
    const keywordList = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywordList.length > 0) {
      await supabase
        .from("keywords")
        .insert(keywordList.map((term) => ({ topic_id: topic.id, term })));
    }

    setAnalyzing({
      id: topic.id,
      name: topic.name,
      keywordsLabel: keywordList.length > 0 ? keywordList.join(", ") : "Aucun mot-clé",
    });

    setName("");
    setKeywords("");
    setLoading(false);

    supabase.functions.invoke("analyze-topic", {
      body: { topic_id: topic.id },
    });
  }

  function handleAnalysisComplete() {
    setAnalyzing(null);
    router.refresh();
  }

  if (analyzing) {
    return (
      <AnalysisProgress
        topicId={analyzing.id}
        topicName={analyzing.name}
        keywordsLabel={analyzing.keywordsLabel}
        onComplete={handleAnalysisComplete}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.panel}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="topic-name">
          Nom du sujet
        </label>
        <input
          id="topic-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Intelligence artificielle"
          className={styles.input}
        />
      </div>
      <div className={styles.fieldLast}>
        <label className={styles.label} htmlFor="topic-keywords">
          Mots-clés (séparés par des virgules)
        </label>
        <input
          id="topic-keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Ex. GPT, Claude, Gemini"
          className={styles.input}
        />
      </div>
      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 14 }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={styles.btnPrimary}>
        {loading ? "Création..." : "Créer le sujet"}
      </button>
    </form>
  );
}
