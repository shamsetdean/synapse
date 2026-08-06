"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import TopicCard from "./topic-card";
import styles from "./dashboard.module.css";

type Topic = {
  id: string;
  name: string;
  status: string;
  sort_order: number;
  keywords: { id: string; term: string }[];
};

function SortableTopic({ topic }: { topic: Topic }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: topic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.topicCard} ${isDragging ? styles.topicCardDragging : ""}`}
      {...attributes}
      {...listeners}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <div className={styles.topicName}>{topic.name}</div>
        <div
          className={`${styles.statusDot} ${topic.status === "active" ? styles.statusDotActive : ""}`}
        />
      </div>
      <div className={styles.topicMeta}>
        <span>
          {topic.keywords.length > 0
            ? topic.keywords.map((k) => k.term).join(", ")
            : "Aucun mot-clé"}
        </span>
      </div>
    </div>
  );
}

export default function TopicSortableList({
  initialTopics,
}: {
  initialTopics: Topic[];
}) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  // L'ancien useEffect qui réinitialisait topics à la sortie du mode édition a
  // été supprimé : il réécrasait l'ordre déplacé avec les données serveur
  // périmées, ce qui perdait silencieusement la réorganisation. La
  // resynchronisation avec le serveur est désormais assurée par le prop key
  // posé sur ce composant dans app/dashboard/page.tsx, qui le remonte dès que
  // la liste des sujets change côté serveur.

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTopics((items) => {
      const oldIndex = items.findIndex((t) => t.id === active.id);
      const newIndex = items.findIndex((t) => t.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setSaved(false);
    setError(null);
  }

  function cancelEdit() {
    // Sortie sans enregistrer : on revient explicitement à l'ordre serveur.
    setTopics(initialTopics);
    setSaved(false);
    setError(null);
    setEditMode(false);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const results = await Promise.all(
      topics.map((topic, index) =>
        supabase
          .from("topics")
          .update({ sort_order: index })
          .eq("id", topic.id),
      ),
    );

    setSaving(false);

    // Les retours d'erreur étaient ignorés : un refus de la RLS produisait une
    // interface affichant un succès qui n'avait pas eu lieu.
    if (results.some((r) => r.error)) {
      setError("L'ordre n'a pas pu être enregistré.");
      return;
    }

    setSaved(true);
    setEditMode(false);
    router.refresh();
  }

  if (topics.length === 0) {
    return (
      <p className={styles.emptyState}>
        Aucun sujet pour l&apos;instant. Créez-en un ci-dessus.
      </p>
    );
  }

  return (
    <>
      <div className={styles.editorToolbar} style={{ justifyContent: "flex-end", marginBottom: 14 }}>
        {editMode && (
          <button onClick={save} disabled={saving} className={styles.btnGhost}>
            {saving ? "Enregistrement..." : "Enregistrer l'ordre"}
          </button>
        )}
        <button
          onClick={() => (editMode ? cancelEdit() : setEditMode(true))}
          className={`${styles.editToggle} ${editMode ? styles.editToggleActive : ""}`}
        >
          {editMode ? (
            <Check size={14} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -2 }} />
          ) : (
            <Pencil size={14} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -2 }} />
          )}
          {editMode ? "Annuler" : "Réorganiser"}
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 14 }}>{error}</p>
      )}
      {saved && !editMode && (
        <p style={{ color: "var(--violet-deep)", fontSize: 13, marginBottom: 14 }}>
          Ordre enregistré.
        </p>
      )}

      {editMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={topics.map((t) => t.id)}>
            <div className={styles.topicGrid}>
              {topics.map((topic) => (
                <SortableTopic key={topic.id} topic={topic} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className={styles.topicGrid}>
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </>
  );
}
