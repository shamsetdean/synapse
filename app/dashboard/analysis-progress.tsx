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
const STAGES = [
  "Collecte des sources",
  "Analyse des articles",
  "Filtrage par mots-clés",
  "Classement",
];

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
  // Horodatage courant, mis à jour uniquement depuis le rappel de
  // l'intervalle. Zéro signifie « pas encore de mesure côté client ».
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
        <div className={styles.progressPanel}>
          <p className={styles.emptyState}>
            L&apos;analyse n&apos;a pas démarré. Le sujet a bien été créé, mais
            la collecte n&apos;a pas pu être lancée.
          </p>
          <button
            type="button"
            onClick={onComplete}
            className={styles.btnOutline}
            style={{ alignSelf: "flex-start" }}
          >
            Retour
          </button>
        </div>
      );
    }
    return (
      <div className={styles.progressPanel}>
        <div className={styles.progressHead}>
          <div className={styles.progressDot} />
          <div className={styles.progressTitle}>
            SUIVI D&apos;ANALYSE — {topicName}
          </div>
        </div>
        <p className={styles.emptyState}>
          Initialisation de l&apos;analyse...
        </p>
      </div>
    );
  }

  const currentIndex = STEP_ORDER.indexOf(job.current_step);
  const done = job.status === "completed";
  const secondsLeft = nowMs > 0 ? estimateSecondsRemaining(job, nowMs) : null;

  return (
    <div className={styles.progressPanel}>
      <div className={styles.progressHead}>
        <div className={styles.progressDot} />
        <div className={styles.progressTitle}>
          SUIVI D&apos;ANALYSE — {topicName}
        </div>
      </div>

      <div className={styles.stages}>
        {STAGES.map((label, i) => {
          const reached = done || currentIndex > i;
          const active = !done && currentIndex === i;
          // Une impulsion voyage le long de la liaison qui alimente l'étape
          // en cours, et un halo éclot sur le nœud qu'elle atteint.
          const feeding = !done && currentIndex - 1 === i;

          return (
            <div key={label} className={styles.stage}>
              <div
                className={`${styles.stageNode} ${
                  reached || active ? styles.stageNodeReached : ""
                } ${active ? styles.stageNodeActive : ""}`}
              >
                {active && <div className={styles.stageFlash} />}
              </div>

              <div
                className={`${styles.stageLabel} ${
                  reached || active ? styles.stageLabelReached : ""
                }`}
              >
                {label}
              </div>

              {i < STAGES.length - 1 && (
                <div
                  className={`${styles.stageLine} ${
                    reached ? styles.stageLineDone : ""
                  }`}
                >
                  {feeding && <div className={styles.stageSpark} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${job.progress_percent}%` }}
        />
      </div>

      <div className={styles.progressFooter}>
        <span>
          {job.articles_processed} / {job.articles_total} articles traités
        </span>
        <span>
          {job.progress_percent >= 100 || done
            ? "Terminé"
            : secondsLeft === null
              ? "Estimation en cours"
              : `~${Math.max(1, secondsLeft)}s restantes`}
        </span>
      </div>

      <div className={styles.progressFooter}>
        <span>{keywordsLabel}</span>
      </div>
    </div>
  );
}
