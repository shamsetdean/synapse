"use client";

import { useState, useEffect } from "react";
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
  const supabase = createClient();

  useEffect(() => {
    if (!editMode) {
      setTopics(initialTopics);
    }
  }, [initialTopics, editMode]);

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
  }

  async function save() {
    setSaving(true);
    await Promise.all(
      topics.map((topic, index) =>
        supabase
          .from("topics")
          .update({ sort_order: index })
          .eq("id", topic.id),
      ),
    );
    setSaving(false);
    setSaved(true);
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
            {saving ? "Enregistrement..." : saved ? "Enregistré" : "Enregistrer l'ordre"}
          </button>
        )}
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`${styles.editToggle} ${editMode ? styles.editToggleActive : ""}`}
        >
          {editMode ? (
            <Check size={14} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -2 }} />
          ) : (
            <Pencil size={14} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -2 }} />
          )}
          {editMode ? "Terminer" : "Réorganiser"}
        </button>
      </div>

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
