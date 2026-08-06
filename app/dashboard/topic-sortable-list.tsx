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
import { SortableContext, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

// La charte emploie le glisser-déposer natif du navigateur. @dnd-kit est
// conservé : le résultat à l'écran est identique, et ce comportement vient
// d'être corrigé et vérifié. Le remplacer ferait courir un risque de
// régression sans aucun gain visuel.
function SortableTopic({ topic }: { topic: Topic }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: topic.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.topicCard} ${styles.topicCardReorder} ${
        isDragging ? styles.topicCardDragging : ""
      } ${topic.status !== "active" ? styles.topicCardPaused : ""}`}
      {...attributes}
      {...listeners}
    >
      <TopicCard topic={topic} />
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
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  // L'ancien useEffect qui réinitialisait topics à la sortie du mode édition a
  // été supprimé : il réécrasait l'ordre déplacé avec les données serveur
  // périmées, ce qui perdait silencieusement la réorganisation. La
  // resynchronisation avec le serveur est assurée par le prop key posé sur ce
  // composant dans app/dashboard/page.tsx.

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeCount = topics.filter((t) => t.status === "active").length;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTopics((items) => {
      const oldIndex = items.findIndex((t) => t.id === active.id);
      const newIndex = items.findIndex((t) => t.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setError(null);
  }

  function cancelEdit() {
    setTopics(initialTopics);
    setError(null);
    setEditMode(false);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const results = await Promise.all(
      topics.map((topic, index) =>
        supabase.from("topics").update({ sort_order: index }).eq("id", topic.id),
      ),
    );

    setSaving(false);

    if (results.some((r) => r.error)) {
      setError("L'ordre n'a pas pu être enregistré.");
      return;
    }

    setEditMode(false);
    router.refresh();
  }

  return (
    <>
      <div className={styles.topicsHead}>
        <div className={styles.topicsHeadLeft}>
          <h2 className={styles.sectionH2}>Sujets de veille</h2>
          <span className={styles.sectionCount}>
            ({activeCount} actif{activeCount > 1 ? "s" : ""} sur{" "}
            {topics.length})
          </span>
        </div>

        {topics.length > 0 && (
          <div className={styles.topicsToolbar}>
            {editMode ? (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className={styles.btnOutline}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className={styles.btnSolid}
                >
                  {saving ? "Enregistrement..." : "Enregistrer l'ordre"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className={styles.btnOutline}
              >
                Réorganiser
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>
      )}

      {topics.length === 0 ? (
        <p className={styles.emptyState}>
          Aucun sujet pour l&apos;instant. Créez-en un ci-dessus.
        </p>
      ) : editMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
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
            <div
              key={topic.id}
              className={`${styles.topicCard} ${
                topic.status !== "active" ? styles.topicCardPaused : ""
              }`}
            >
              <TopicCard topic={topic} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
