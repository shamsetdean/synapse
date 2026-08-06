"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AnalysisProgress from "./analysis-progress";
import styles from "./dashboard.module.css";

// Le matching parcourt chaque mot-clé pour chaque article ingéré : sans borne,
// une saisie massive alourdirait durablement l'ingestion pour tous.
const MAX_KEYWORDS = 50;

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

    const keywordList = Array.from(
      new Set(
        keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      ),
    );

    if (keywordList.length > MAX_KEYWORDS) {
      setError(`Limitez-vous à ${MAX_KEYWORDS} mots-clés par sujet.`);
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

    if (keywordList.length > 0) {
      // Le retour d'erreur était ignoré : un échec laissait un sujet sans
      // aucun mot-clé, qui ne correspondait donc jamais à aucun article, sans
      // que rien ne l'indique à l'utilisateur.
      const { error: keywordError } = await supabase
        .from("keywords")
        .insert(keywordList.map((term) => ({ topic_id: topic.id, term })));

      if (keywordError) {
        setError(
          "Le sujet a été créé mais ses mots-clés n'ont pas pu être enregistrés.",
        );
        setLoading(false);
        router.refresh();
        return;
      }
    }

    // Rafraîchissement immédiat : le sujet apparaît dans la liste en dessous
    // pendant que l'analyse tourne, au lieu d'attendre la fin de celle-ci.
    // C'est le seul router.refresh() qui existait auparavant, et il n'était
    // appelé que depuis handleAnalysisComplete, soit une trentaine de secondes
    // plus tard.
    router.refresh();

    setAnalyzing({
      id: topic.id,
      name: topic.name,
      keywordsLabel:
        keywordList.length > 0 ? keywordList.join(", ") : "Aucun mot-clé",
    });
    setName("");
    setKeywords("");
    setLoading(false);

    // L'appel n'était pas attendu : un échec (réseau, CORS, 401) passait
    // inaperçu et laissait l'écran de progression tourner dans le vide.
    const { error: invokeError } = await supabase.functions.invoke(
      "analyze-topic",
      { body: { topic_id: topic.id } },
    );

    if (invokeError) {
      setError(
        "Le sujet a été créé, mais l'analyse n'a pas pu être lancée. Elle reprendra à la prochaine collecte automatique.",
      );
      setAnalyzing(null);
    }
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

  const disabled = loading || !name.trim();

  return (
    <form onSubmit={handleSubmit} className={styles.formPanel}>
      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label className={styles.formLabel} htmlFor="topic-name">
            Nom du sujet
          </label>
          <input
            id="topic-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Informatique quantique"
            className={styles.formInput}
            maxLength={120}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel} htmlFor="topic-keywords">
            Mots-clés (séparés par des virgules)
          </label>
          <input
            id="topic-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="ex. qubit, cryptographie post-quantique"
            className={styles.formInput}
          />
        </div>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={disabled}
        className={`${styles.createBtn} ${
          disabled ? styles.createBtnDisabled : ""
        }`}
      >
        {loading ? "Création..." : "Créer le sujet"}
      </button>
    </form>
  );
}
