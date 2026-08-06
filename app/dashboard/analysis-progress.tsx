"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./dashboard.module.css";

type Job = {
  id: string;
  status: string;
  current_step: string;
  progress_percent: number;
  articles_total: number;
  articles_processed: number;
  topic_matches: number;
  started_at: string;
};

const STEP_ORDER = ["collecte", "analyse", "filtrage", "classement", "termine"];
const STEP_LABELS: Record<string, string> = {
  collecte: "Collecte des sources",
  analyse: "Analyse des articles",
  filtrage: "Filtrage par mots-clés",
  classement: "Classement",
};

// Délai au-delà duquel on considère que l'analyse n'a jamais démarré : sans
// lui, un échec d'appel à analyze-topic laissait l'utilisateur bloqué
// indéfiniment sur l'écran d'initialisation, sans retour possible.
const STARTUP_TIMEOUT_MS = 20000;

function estimateSecondsRemaining(job: Job, nowMs: number): number {
  if (job.progress_percent <= 0) return 0;
  const elapsedSec = (nowMs - new Date(job.started_at).getTime()) / 1000;
  const totalEstimate = (elapsedSec / job.progress_percent) * 100;
  return Math.max(0, Math.round(totalEstimate - elapsedSec));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function AnalysisProgress({
  topicId,
  topicName,
  keywordsLabel,
  onComplete,
}: {
  topicId: string;
  topicName: string;
  keywordsLabel: string;
  onComplete: () => void;
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  // Horodatage courant, mis à jour uniquement depuis le rappel de l'intervalle.
  // Zéro signifie « pas encore de mesure côté client » : le compte à rebours
  // était auparavant stocké en état et décrémenté à l'aveugle, ce qui le
  // faisait dériver et imposait un setState dans le corps d'un effet.
  const [nowMs, setNowMs] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    let active = true;

    async function loadLatestJob() {
      const { data } = await supabase
        .from("analysis_jobs")
        .select("*")
        .eq("topic_id", topicId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && data) setJob(data as Job);
    }

    loadLatestJob();

    function handleChange(payload: { new: unknown }) {
      if (!active) return;
      const updated = payload.new as Job;
      if (!updated || !updated.id) return;
      setJob(updated);
      if (updated.status === "completed" || updated.status === "failed") {
        setTimeout(() => {
          if (active) onComplete();
        }, 1200);
      }
    }

    // Restreint aux insertions et mises à jour : sur une suppression,
    // payload.new est vide et produisait une progression NaN.
    const channel = supabase
      .channel(`analysis_jobs_${topicId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "analysis_jobs",
          filter: `topic_id=eq.${topicId}`,
        },
        handleChange,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analysis_jobs",
          filter: `topic_id=eq.${topicId}`,
        },
        handleChange,
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    const timeout = setTimeout(() => setTimedOut(true), STARTUP_TIMEOUT_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  if (!job) {
    if (timedOut) {
      return (
        <div className={styles.panel}>
          <p className={styles.emptyState}>
            L&apos;analyse n&apos;a pas démarré. Le sujet a bien été créé, mais
            la collecte n&apos;a pas pu être lancée.
          </p>
          <button onClick={onComplete} className={styles.btnGhost}>
            Retour
          </button>
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <p className={styles.emptyState}>Initialisation de l&apos;analyse...</p>
      </div>
    );
  }

  const currentIndex = STEP_ORDER.indexOf(job.current_step);
  const visibleSteps = STEP_ORDER.slice(0, 4);
  const secondsLeft = nowMs > 0 ? estimateSecondsRemaining(job, nowMs) : null;

  return (
    <div className={styles.panel}>
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{topicName}</div>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-dim)",
          fontFamily: "'Courier New', monospace",
          marginBottom: 20,
        }}
      >
        {keywordsLabel}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 26, fontWeight: 600, fontFamily: "'Courier New', monospace" }}>
          {secondsLeft === null ? "--:--" : formatTime(secondsLeft)}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>temps restant estimé</span>
      </div>

      <div
        style={{
          height: 6,
          background: "#e8e2d3",
          borderRadius: 4,
          overflow: "hidden",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${job.progress_percent}%`,
            borderRadius: 4,
            background:
              "linear-gradient(90deg,#8b7cf6,#6d5fd0,#a89bf8,#6d5fd0,#8b7cf6)",
            backgroundSize: "200% 100%",
            animation: "synapseShimmer 1.6s linear infinite",
            transition: "width 0.6s ease",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleSteps.map((step, i) => {
          const isDone = currentIndex > i || job.status === "completed";
          const isActive = currentIndex === i && job.status === "running";

          return (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isDone ? (
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#8b7cf6,#6d5fd0)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    animation: "synapsePulseDone 2.2s ease-in-out infinite",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="#fff"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              ) : isActive ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  style={{ flexShrink: 0, animation: "synapseSpin 0.9s linear infinite" }}
                >
                  <circle cx="12" cy="12" r="9" stroke="#e8e2d3" strokeWidth="3" fill="none" />
                  <path
                    d="M12 3a9 9 0 0 1 9 9"
                    stroke="#6d5fd0"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background:
                      "linear-gradient(#fbf8f2,#fbf8f2) padding-box, linear-gradient(135deg,#8b7cf6,#6d5fd0) border-box",
                    border: "1.5px solid transparent",
                    animation: "synapsePulsePending 1.8s ease-in-out infinite",
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  color: isDone ? "var(--ink-dim)" : isActive ? "var(--ink)" : "var(--ink-faint)",
                  textDecoration: isDone ? "line-through" : "none",
                }}
              >
                {STEP_LABELS[step]}
              </span>
              {step === "analyse" && job.articles_total > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    fontFamily: "'Courier New', monospace",
                    marginLeft: "auto",
                  }}
                >
                  {job.articles_processed}/{job.articles_total}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes synapseSpin { to { transform: rotate(360deg); } }
        @keyframes synapsePulseDone { 0%,100% { box-shadow: 0 0 0 0 rgba(109,95,208,0.35); } 50% { box-shadow: 0 0 0 5px rgba(109,95,208,0); } }
        @keyframes synapsePulsePending { 0%,100% { opacity: 0.35; } 50% { opacity: 0.9; } }
        @keyframes synapseShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
      `}</style>
    </div>
  );
}
