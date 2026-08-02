"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">{topic.name}</h3>
          <p className="mt-1 text-xs text-neutral-500">
            {topic.keywords.length > 0
              ? topic.keywords.map((k) => k.term).join(", ")
              : "Aucun mot-clé"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-neutral-500">
            {topic.status === "active" ? "Actif" : "En pause"}
          </span>
          <button
            onClick={togglePause}
            disabled={loading}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            {topic.status === "active" ? "Mettre en pause" : "Réactiver"}
          </button>
          <button
            onClick={deleteTopic}
            disabled={loading}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
