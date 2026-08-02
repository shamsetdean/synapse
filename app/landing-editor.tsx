"use client";

import { useState } from "react";
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, Pencil, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { blockRegistry, type BlockId } from "./blocks/registry";
import styles from "./landing.module.css";

type Block = { id: string; visible: boolean };

function SortableBlock({
  block,
  editMode,
  onToggleVisible,
}: {
  block: Block;
  editMode: boolean;
  onToggleVisible: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const entry = blockRegistry[block.id as BlockId];
  if (!entry) return null;
  const { Component, label } = entry;

  if (!editMode) {
    return block.visible ? <Component /> : null;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={block.visible ? undefined : styles.blockHidden}
    >
      <div className={styles.blockControls}>
        <span className={styles.dragHandle} {...attributes} {...listeners}>
          <GripVertical size={16} aria-hidden="true" />
        </span>
        <span style={{ fontSize: 13 }}>{label}</span>
        <button
          className={styles.visToggle}
          onClick={() => onToggleVisible(block.id)}
        >
          {block.visible ? (
            <Eye size={14} aria-hidden="true" />
          ) : (
            <EyeOff size={14} aria-hidden="true" />
          )}
          {block.visible ? "Visible" : "Masqué"}
        </button>
      </div>
      <Component />
    </div>
  );
}

export default function LandingEditor({
  initialBlocks,
  isAdmin,
}: {
  initialBlocks: Block[];
  isAdmin: boolean;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setBlocks((items) => {
      const oldIndex = items.findIndex((b) => b.id === active.id);
      const newIndex = items.findIndex((b) => b.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setSaved(false);
  }

  function toggleVisible(id: string) {
    setBlocks((items) =>
      items.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)),
    );
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await supabase
      .from("site_layout")
      .update({ blocks, updated_at: new Date().toISOString() })
      .eq("id", "landing");
    setSaving(false);
    setSaved(true);
  }

  return (
    <>
      {isAdmin && (
        <div className={styles.editorToolbar}>
          {editMode && (
            <button onClick={save} disabled={saving} className={styles.btn}>
              {saving ? "Enregistrement..." : saved ? "Enregistré" : "Enregistrer"}
            </button>
          )}
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`${styles.editToggle} ${
              editMode ? styles.editToggleActive : ""
            }`}
          >
            {editMode ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Pencil size={14} aria-hidden="true" />
            )}
            {editMode ? "Terminer" : "Modifier la page"}
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              editMode={editMode}
              onToggleVisible={toggleVisible}
            />
          ))}
        </SortableContext>
      </DndContext>
    </>
  );
}
