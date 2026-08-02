"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewTopicForm() {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setName("");
    setKeywords("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-4"
    >
      <div>
        <label className="block text-sm font-medium" htmlFor="topic-name">
          Nom du sujet
        </label>
        <input
          id="topic-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Intelligence artificielle"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="topic-keywords">
          Mots-clés (séparés par des virgules)
        </label>
        <input
          id="topic-keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Ex. GPT, Claude, Gemini"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Création..." : "Créer le sujet"}
      </button>
    </form>
  );
}
