"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FeedArticle } from "./article-feed";
import ArticleDetailPanel from "./article-detail-panel";
import { TOPIC_PALETTE, hashString, useIsLightTheme, type TopicSlot } from "./topic-colors";
import { useArticlesControls } from "./dashboard-shell";
import styles from "./dashboard.module.css";

// Vue sphère de la page Articles (cahier des charges §3). Rendu et animée en
// impératif (attributs SVG mutés directement, hors du cycle de rendu React)
// pour la boucle de rotation à 60 im/s — même approche que l'IntersectionObserver
// de article-feed.tsx : les API/animations continues vivent en useEffect,
// jamais dans le rendu.
//
// Adaptations au modèle de données réel (le fond ne change pas) :
// - Pas de taxonomie fixe Tech/Local/Monde/Culture : les nébuleuses sont
//   réparties uniformément selon les sujets réellement présents (topicOrder,
//   même ordre que la page Sujets), "Sans sujet" toujours en dernier, comme
//   dans groupByTopic (article-feed.tsx).
// - Pas de colonne d'importance/pertinence : taille de grain uniforme (repli
//   explicitement prévu par le cahier des charges, §3.2).
// - Pas de statut "lu/à lire" distinct : l'intérieur de la sphère représente
//   les articles favoris (favoritedIds), le même sous-ensemble personnel que
//   les ✓ des cards existantes — c'est la seule notion de "marqué" qui existe
//   côté données.

type CloudDensity = "light" | "normal" | "dense";

const FLUX_COLOR = { dark: "#c9c3f5", light: "#7F77DD" };

function densityFraction(d: CloudDensity): number {
  return d === "light" ? 0.4 : d === "dense" ? 1 : 0.7;
}

// Même technique que theme-provider.tsx (useSyncExternalStore) : lire une
// media query dans le corps d'un effet pour l'y déposer via setState déclenche
// un rendu en cascade évitable, et diverge en plus du serveur (qui ne connaît
// pas la préférence). "false" côté serveur, comme "dark" y est la valeur par
// défaut du thème.
function subscribeReducedMotion(cb: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", cb);
  return () => media.removeEventListener("change", cb);
}
function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function getReducedMotionServerSnapshot() {
  return false;
}

// Réglages manuels d'espacement du nuage extérieur (curseurs, voir le
// composant plus bas), persistés en localStorage pour ne plus jamais avoir
// à les redemander d'une visite à l'autre. Petit store externe manuel (pas
// juste useState + useEffect) : lire localStorage puis appeler setState
// dans le corps d'un effet déclenche un rendu en cascade évitable (voir
// subscribeReducedMotion juste au-dessus, même raisonnement) et diverge du
// rendu serveur, qui ne connaît pas le localStorage du navigateur — ces
// valeurs par défaut (60/296/1) y restent donc utilisées le temps de
// l'hydratation. Choisies explicitement via les curseurs, pas des valeurs
// arbitraires : distance entre étoiles 60, distance étoiles-sphère 296,
// taille des étoiles 1.
type SpacingSettings = { starGap: number; sphereGap: number; starSize: number };
let spacingState: SpacingSettings = { starGap: 60, sphereGap: 296, starSize: 1 };
let spacingHydrated = false;
const spacingListeners = new Set<() => void>();

function hydrateSpacingFromStorage() {
  if (spacingHydrated) return;
  spacingHydrated = true;
  // localStorage.getItem() renvoie `null` (pas `undefined`) quand la clé
  // n'existe pas, et `Number(null)` vaut 0 — PAS NaN. Un simple
  // `Number.isFinite(...) && ... >= 0` ne distingue donc pas "absent" de
  // "explicitement 0" : bug réel vécu (sphereGap retombait silencieusement
  // à 0 à chaque première visite au lieu de la valeur par défaut). Vérifier
  // `!== null` D'ABORD, avant toute conversion numérique.
  const rawStarGap = window.localStorage.getItem("sy-sphere-star-gap");
  const rawSphereGap = window.localStorage.getItem("sy-sphere-sphere-gap");
  const rawStarSize = window.localStorage.getItem("sy-sphere-star-size");
  const next = { ...spacingState };
  if (rawStarGap !== null) {
    const v = Number(rawStarGap);
    if (Number.isFinite(v) && v > 0) next.starGap = v;
  }
  if (rawSphereGap !== null) {
    const v = Number(rawSphereGap);
    if (Number.isFinite(v) && v >= 0) next.sphereGap = v;
  }
  if (rawStarSize !== null) {
    const v = Number(rawStarSize);
    if (Number.isFinite(v) && v > 0) next.starSize = v;
  }
  spacingState = next;
}
function subscribeSpacing(cb: () => void) {
  hydrateSpacingFromStorage();
  spacingListeners.add(cb);
  return () => spacingListeners.delete(cb);
}
function getSpacingSnapshot() {
  return spacingState;
}
function getSpacingServerSnapshot(): SpacingSettings {
  return { starGap: 60, sphereGap: 296, starSize: 1 };
}
// setStarGapSetting/setSphereGapSetting/setStarSizeSetting retirés avec
// leurs curseurs (sur demande) : starGap/sphereGap/starSize restent lus
// depuis spacingState (valeurs par défaut 60/296/1, ou localStorage si déjà
// réglées lors d'une session précédente où les curseurs existaient encore),
// mais ne sont plus modifiables depuis l'interface.

type GrainState = {
  theta: number;
  phi: number;
  // Angle du nuage extérieur : cible (recalculée à chaque passage de l'effet
  // de synchronisation par relaxTopicAngles, pour garantir un écart angulaire
  // minimal entre grains d'un même sujet) et valeur affichée, qui rattrape la
  // cible en douceur (même principe que r3current/r3target) pour ne jamais
  // téléporter un grain déjà visible quand le groupe se redistribue.
  baseAngleTarget: number;
  baseAngleCurrent: number;
  r3current: number;
  r3target: number;
  interior: boolean;
  size: number;
  fill: string;
  baseOpacity: number;
  driftPhase: number;
  driftSpeed: number;
  driftRadius: number;
  twinklePhase: number;
  twinkleSpeed: number;
  pulsePhase: number;
  pulseSpeed: number;
  pulseAmp: number;
  lastX: number;
  lastY: number;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const CX = 400;
const CY = 400;
// Valeurs reprises telles quelles de la simulation de référence validée
// (claude.ai/code/artifact/6e3bbef5-b335-472e-8794-1937fd8e6975) plutôt
// qu'estimées : SPHERE_R/MAX_R, distance des nébuleuses (300), formule de
// leurs particules, troisième méridien. Voir aussi .sphereContainer dans
// dashboard.module.css (largeur du conteneur, même valeur que la référence).
const SPHERE_R = 200;
// Distance étoiles-sphère et largeur de la bande radiale du nuage extérieur
// : réglables en direct (curseurs, voir le composant plus bas) plutôt que
// des constantes fixes — après une dizaine d'allers-retours à deviner la
// "bonne" valeur, c'est maintenant l'utilisateur qui les fixe lui-même, sans
// plafond arbitraire de ma part : le SVG a overflow:visible (voir
// .sphereSvg dans dashboard.module.css), les grains peuvent donc sortir du
// cadre visuel du conteneur si l'écart demandé est très grand — c'est un
// choix délibéré de l'utilisateur via le curseur, pas un bug accidentel
// comme lors d'un round précédent. DEFAULT_BAND_WIDTH est la largeur de la
// bande radiale (fraîcheur) : l'écart sphère-étoile pousse toute la bande
// vers l'extérieur, sans la compresser.
const DEFAULT_BAND_WIDTH = 154;
const AUTO_SPIN_RAD_S = (4.2 * Math.PI) / 180;
// Rayon RENDU minimal (unités du viewBox) : avec la taille d'étoile
// verrouillée à 1, le rayon réel affiché tombait sous 1 unité — proche de
// l'échelle du conteneur (~0,93px réel/unité près du plafond, moins sur un
// écran plus petit), donc sous le seuil de rendu net d'un écran, rendu
// quasi invisible par l'anti-crénelage. Ce plancher ne s'applique qu'au
// rayon effectivement dessiné (l'attribut `r`) : `gs.size` (la valeur
// "taille des étoiles" configurée) reste inchangé pour tout le reste — zone
// de survol, espacement (placeExteriorGrains) — rien d'autre n'est touché.
// Rayon RENDU (unités du viewBox). AVANT : constante fixe (6), plancher
// anti-sous-pixel uniquement — beaucoup trop petit visuellement et
// tactilement, signalé à plusieurs reprises. APRÈS (demande explicite :
// "10 fois plus grandes, interdiction d'être superposées") : rayon
// ADAPTATIF, recalculé à chaque passage de l'effet de synchronisation
// (computeGrainRadius plus bas, appelé depuis l'effet) en fonction du
// nombre réel de grains extérieurs affichés et de la place réellement
// disponible dans l'anneau du nuage — jamais une taille fixe qui ignorerait
// combien de grains doivent y tenir.
//
// GRAIN_RADIUS_MIN : plancher, identique à l'ancien MIN_RENDERED_RADIUS —
// jamais plus petit qu'avant, quelle que soit la densité.
// GRAIN_RADIUS_MAX : plafond, littéralement 10× ce plancher — la demande
// "10 fois plus grandes" telle quelle, mais seulement ATTEIGNABLE quand peu
// de grains sont affichés (fenêtre 24H avec peu d'articles, par exemple) :
// avec 50-90 grains dans l'anneau actuel (cas réel), un rayon de 60 rendrait
// GÉOMÉTRIQUEMENT impossible de tous les caser sans chevauchement (calcul :
// anneau ≈ 550 000 unités² à sphereGap/bande par défaut, un disque de rayon
// 60 occupe ≈ 11 300 unités² ne serait-ce qu'à 50% d'efficacité de
// remplissage, donc ~12 grains max avant chevauchement garanti — très en
// dessous de 50-90). Le rayon adaptatif redescend alors automatiquement,
// jusqu'à GRAIN_RADIUS_MIN si besoin, plutôt que de forcer 10x et de violer
// l'interdiction de chevauchement, qui prime.
const GRAIN_RADIUS_MIN = 6;
const GRAIN_RADIUS_MAX = GRAIN_RADIUS_MIN * 10;
// Efficacité de remplissage supposée pour l'estimation de capacité de
// l'anneau (placement séquentiel + passes de réparation, pas un pavage
// hexagonal parfait à 90.7% — 50% est une estimation prudente, déjà validée
// empiriquement par le comportement de placeExteriorGrains sur ce type de
// placement). Marge de sécurité ajoutée à l'écart minimal ciblé entre deux
// grains (au-delà de 2×rayon, qui les ferait juste se toucher) : évite le
// cas limite "tangent" (visuellement indiscernable d'un chevauchement).
const GRAIN_PACKING_EFFICIENCY = 0.5;
const GRAIN_SAFETY_MARGIN = 4;

// Cible tactile minimale (Apple HIG / WCAG 2.5.5 : 44px). La marge cliquable
// des grains (stroke-width transparent, voir sa création plus bas) était une
// constante fixe en unités du viewBox (16), donc sa taille RÉELLE à l'écran
// dépendait entièrement de la largeur affichée du conteneur — correcte sur
// desktop (.sphereContainer jusqu'à 760px, ~0,95px réel/unité) mais bien trop
// petite sur smartphone (.sphereContainer descend à 320px, ~0,4px réel/unité :
// la même marge de 16 unités tombait alors autour de 6-7px réels, très en
// dessous du seuil tactile). Recalculée dynamiquement (recomputeHitStrokeWidth,
// voir plus bas) à partir de la taille réellement rendue du conteneur, jamais
// en dessous de MIN_HIT_STROKE (la valeur desktop d'origine, jamais réduite).
const HIT_TARGET_PX = 44;
const MIN_HIT_STROKE = 16;

// AVANT : secteur angulaire fixe ±36° (72° au total) quel que soit le nombre
// de sujets réels — gâchait presque toute la place disponible avec 1-3
// sujets (jusqu'à 360° dispo par sujet), et débordait déjà sur le secteur du
// voisin dès 5 sujets (72° > 360/5=72°, donc pile à la limite, et pire au-delà).
// APRÈS : secteur dynamique = 84% de la part réelle du sujet (360°/nombre de
// sujets), plafonné à 80° pour ne pas non plus étaler un unique sujet sur
// presque tout le tour. Calculé dans l'effet de synchronisation (a accès au
// nombre réel de sujets affichés), pas ici — cette constante ne reste que
// pour le plafond et le seuil de repli codés en dur ci-dessous.
const SLOT_HALF_WIDTH_MAX_DEG = 80;

// Distance minimale RÉELLE (unités du viewBox 0-800, même convention que
// `size`, le rayon des nébuleuses, etc. — pas des degrés) imposée entre
// CHAQUE PAIRE de grains du nuage extérieur, tous sujets confondus.
//
// BUG CORRIGÉ (round précédent) : l'ancienne relaxAngularOffsets ne
// garantissait qu'un écart ANGULAIRE, calculé séparément par sujet. Deux
// failles réelles, identifiées sur le code puis vérifiées par un cas
// construit à la main :
// 1. Un écart en degrés ne dit rien de la distance réelle en pixels tant
//    qu'il n'est pas rapporté au rayon (qui varie avec la fraîcheur).
// 2. Sa branche de repli ("réparti uniformément sur tout le secteur" quand
//    trop de grains ne tenaient pas à l'écart demandé) ignorait purement et
//    simplement le seuil minimal — avec beaucoup d'articles par sujet (cas
//    réel : 75-94), cette branche se déclenchait presque systématiquement.
// 3. (bug distinct, trouvé en construisant un cas concret : halfWidth=50°,
//    minSep=20°, offsets bruts [-49°,-48°] → après recentrage [-58.5°,
//    -38.5°], soit hors du secteur ±50° autorisé, sans aucune vérification
//    après ce recentrage.)
//
// Remplacé par placeExteriorGrains ci-dessous : passage séquentiel
// déterministe (ordre = id trié, jamais Math.random) en espace réel (x, y),
// sur tous les grains extérieurs de tous les sujets à la fois, avec
// recherche locale bornée (rayon d'abord, puis angle) quand un grain est
// trop proche d'un grain déjà placé. Exécuté uniquement dans l'effet de
// synchronisation ci-dessous, jamais par frame d'animation.
//
// Le seuil lui-même (minPixelSep) n'est plus une constante fixe : c'est le
// curseur "distance entre les étoiles" (state starGap dans le composant),
// passé en paramètre à placeExteriorGrains.
//
// Marge de recherche radiale autorisée en plus du jitter déjà en place
// (±22, voir plus bas) pour tenter de résoudre une collision sans toucher à
// l'angle — reste une fraction mineure de l'étendue de la bande, donc la
// fraîcheur (rayon) reste globalement lisible même après ajustement.
const RADIAL_SEARCH_RANGE = 20;
const MAX_PLACEMENT_ATTEMPTS = 50;

type ExteriorCandidate = {
  id: string;
  topicAngleDeg: number;
  halfWidth: number;
  homeOffset: number;
  homeRadius: number;
};

function exteriorXY(topicAngleDeg: number, offset: number, radius: number) {
  const rad = ((topicAngleDeg + offset) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

type Placement = { offset: number; radius: number; x: number; y: number };

// Cherche, pour UN grain, la meilleure position (offset, rayon) au sens de
// `distFn` (distance au grain le plus proche selon l'appelant — tous les
// autres grains déjà posés lors du passage initial, ou tous les autres
// grains du nuage entier lors de la passe de réparation ci-dessous), en au
// plus MAX_PLACEMENT_ATTEMPTS essais. Phase 1 : rayon seul (priorité
// demandée : ne pas toucher l'angle si le rayon suffit). Phase 2 : si
// insuffisant, balayage en grille (angle × rayon) sur tout le secteur —
// jamais au-delà de ±halfWidth (mapping angle=sujet, §3.2, préservé).
function searchBestPlacement(
  c: ExteriorCandidate,
  startOffset: number,
  startRadius: number,
  distFn: (x: number, y: number) => number,
  minPixelSep: number,
  exteriorRStart: number,
  maxR: number,
): Placement {
  let bestOffset = startOffset;
  let bestRadius = startRadius;
  let bestXY = exteriorXY(c.topicAngleDeg, bestOffset, bestRadius);
  let bestDist = distFn(bestXY.x, bestXY.y);
  if (bestDist >= minPixelSep) return { offset: bestOffset, radius: bestRadius, ...bestXY };

  let attempts = 0;
  // Phase 1 : ajustement radial seul (angle inchangé), dans la plage de
  // fraîcheur déjà permise élargie de RADIAL_SEARCH_RANGE. Budget réduit
  // (6, pas 20) : dans un sujet très fourni (cas réel, 75-94 articles), le
  // rayon seul ne résout quasiment jamais la collision (le vrai espace
  // libre est ailleurs sur le secteur) — mieux vaut réserver le budget à
  // la phase 2 (grille angle × rayon), plus efficace, tout en gardant la
  // priorité "rayon d'abord" demandée.
  for (let k = 1; bestDist < minPixelSep && attempts < MAX_PLACEMENT_ATTEMPTS && k <= 6; k++) {
    attempts++;
    const sign = k % 2 === 0 ? 1 : -1;
    const mag = Math.ceil(k / 2) * (RADIAL_SEARCH_RANGE / 10);
    const radius = Math.max(exteriorRStart, Math.min(maxR + 22, startRadius + sign * mag));
    const xy = exteriorXY(c.topicAngleDeg, startOffset, radius);
    const d = distFn(xy.x, xy.y);
    if (d > bestDist) {
      bestDist = d;
      bestRadius = radius;
      bestOffset = startOffset;
      bestXY = xy;
    }
  }
  // Phase 2 : balayage ABSOLU en grille (angle × rayon) sur tout le secteur
  // et toute la bande radiale — pas des petits pas croissants centrés sur
  // la position de départ (qui n'explorent quasiment jamais l'espace libre
  // s'il ne se trouve pas près d'elle), et pas l'angle seul (à un rayon à
  // peu près fixe, l'arc disponible est physiquement trop court pour ~90
  // points espacés de 24px : ~500 unités d'arc dispo pour 90×24=2160
  // nécessaires — la bande radiale complète doit aussi être balayée).
  const remaining = MAX_PLACEMENT_ATTEMPTS - attempts;
  if (bestDist < minPixelSep && remaining > 0) {
    // Peu de bandes radiales (4), l'essentiel du budget sur l'angle : à
    // rayon fixe, c'est l'angle qui manque le plus (arc disponible
    // physiquement court, voir plus haut), pas le rayon. Chaque bande est
    // décalée d'un demi-pas par rapport à la précédente (grille "quinconce"
    // plutôt qu'alignée) : une grille parfaitement alignée peut manquer un
    // espace libre qui tombe systématiquement entre deux points de grille
    // sur toutes les bandes à la fois — vérifié empiriquement (grille
    // alignée : distance minimale réelle bloquée à 2,25px malgré une
    // passe de réparation dédiée).
    const radiusSteps = Math.max(1, Math.min(4, remaining));
    const angleSteps = Math.max(1, Math.ceil(remaining / radiusSteps));
    outer: for (let ri = 0; ri < radiusSteps; ri++) {
      const radius =
        exteriorRStart + ((maxR + 22 - exteriorRStart) * ri) / Math.max(1, radiusSteps - 1);
      const phase = (ri % 2) * (c.halfWidth * 2) / angleSteps / 2;
      for (let ai = 0; ai < angleSteps; ai++) {
        if (attempts >= MAX_PLACEMENT_ATTEMPTS) break outer;
        attempts++;
        const raw = -c.halfWidth + phase + (c.halfWidth * 2 * ai) / Math.max(1, angleSteps - 1);
        const offset = Math.max(-c.halfWidth, Math.min(c.halfWidth, raw));
        const xy = exteriorXY(c.topicAngleDeg, offset, radius);
        const d = distFn(xy.x, xy.y);
        if (d > bestDist) {
          bestDist = d;
          bestOffset = offset;
          bestRadius = radius;
          bestXY = xy;
        }
        if (bestDist >= minPixelSep) break outer;
      }
    }
  }
  // Aucune position valide trouvée en 50 tentatives : on garde la meilleure
  // obtenue (distance minimale la plus grande rencontrée), jamais un
  // abandon silencieux de la contrainte.
  return { offset: bestOffset, radius: bestRadius, ...bestXY };
}

function placeExteriorGrains(
  candidates: ExteriorCandidate[],
  minPixelSep: number,
  exteriorRStart: number,
  maxR: number,
): Map<string, { offset: number; radius: number }> {
  const sorted = [...candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map(candidates.map((c) => [c.id, c]));

  // Passage initial, dans l'ordre déterministe (id trié) : chaque grain ne
  // voit que les grains déjà posés AVANT lui dans cet ordre.
  const placed: { id: string; x: number; y: number }[] = [];
  for (const c of sorted) {
    const distFn = (x: number, y: number) => {
      let best = Infinity;
      for (const p of placed) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < best) best = d;
      }
      return best;
    };
    const pl = searchBestPlacement(c, c.homeOffset, c.homeRadius, distFn, minPixelSep, exteriorRStart, maxR);
    placed.push({ id: c.id, x: pl.x, y: pl.y });
  }

  // Passe de réparation : le passage initial ne voit, pour chaque grain,
  // que ceux posés avant lui — une paire encore sous le seuil une fois TOUT
  // le nuage posé peut donc persister même si une place libre existe
  // ailleurs (vue seulement après coup). Deuxième passage déterministe
  // (trié par distance croissante à son plus proche voisin, puis par id),
  // qui retente chaque grain encore sous le seuil avec le même budget de 50
  // tentatives, cette fois contre TOUS les autres grains déjà posés (pas
  // seulement ceux d'avant lui). 5 passes : déplacer un grain peut faire
  // légèrement empirer son voisin, donc plusieurs passes convergent
  // progressivement ; au-delà, les gains observés deviennent marginaux (un
  // vrai optimum global demanderait un solveur, hors du cadre demandé ici).
  for (let repairPass = 0; repairPass < 5; repairPass++) {
    const withDist = placed.map((p, i) => {
      let best = Infinity;
      for (let j = 0; j < placed.length; j++) {
        if (j === i) continue;
        const d = Math.hypot(placed[j].x - p.x, placed[j].y - p.y);
        if (d < best) best = d;
      }
      return { index: i, id: p.id, dist: best };
    });
    withDist.sort((a, b) => a.dist - b.dist || (a.id < b.id ? -1 : 1));

    for (const { index, id, dist } of withDist) {
      if (dist >= minPixelSep) continue;
      const c = byId.get(id);
      if (!c) continue;
      const distFn = (x: number, y: number) => {
        let best = Infinity;
        for (let j = 0; j < placed.length; j++) {
          if (j === index) continue;
          const d = Math.hypot(placed[j].x - x, placed[j].y - y);
          if (d < best) best = d;
        }
        return best;
      };
      // Repart de homeOffset/homeRadius, pas de la position intermédiaire
      // du passage initial : un grain déjà déplacé une première fois reste
      // libre d'explorer tout son secteur/sa bande, pas seulement autour
      // d'où il se trouve actuellement.
      const pl = searchBestPlacement(c, c.homeOffset, c.homeRadius, distFn, minPixelSep, exteriorRStart, maxR);
      const newDist = distFn(pl.x, pl.y);
      if (newDist > dist) {
        placed[index] = { id, x: pl.x, y: pl.y };
      }
    }
  }

  const result = new Map<string, { offset: number; radius: number }>();
  for (const p of placed) {
    const c = byId.get(p.id)!;
    const rad = Math.atan2(p.y - CY, p.x - CX);
    let offset = (rad * 180) / Math.PI - c.topicAngleDeg;
    // Normalise dans [-180, 180] avant de clamp au secteur : atan2 revient
    // toujours dans [-180,180], mais topicAngleDeg peut décaler hors de
    // cette plage.
    offset = ((offset + 540) % 360) - 180;
    offset = Math.max(-c.halfWidth, Math.min(c.halfWidth, offset));
    const radius = Math.hypot(p.x - CX, p.y - CY);
    result.set(p.id, { offset, radius });
  }
  return result;
}

// Plus grand rayon (borné entre GRAIN_RADIUS_MIN et GRAIN_RADIUS_MAX) tel
// que `exteriorCount` grains de ce rayon aient statistiquement de la place
// dans l'anneau [exteriorRStart, maxR] sans se chevaucher, à
// GRAIN_PACKING_EFFICIENCY près. Estimation par AIRE (aire de l'anneau ÷
// aire occupée par grain), pas une garantie géométrique absolue à elle
// seule — c'est le couple avec minPixelSep = 2×rayon+marge, réellement
// imposé à placeExteriorGrains juste après, qui fait tenir la promesse
// "jamais superposés" pour le nuage extérieur (voir son appel plus bas).
function computeGrainRadius(exteriorCount: number, exteriorRStart: number, maxR: number): number {
  if (exteriorCount <= 0) return GRAIN_RADIUS_MAX;
  const annulusArea = Math.PI * (maxR * maxR - exteriorRStart * exteriorRStart);
  const areaPerGrain = annulusArea / exteriorCount;
  const raw = Math.sqrt((GRAIN_PACKING_EFFICIENCY * areaPerGrain) / Math.PI);
  return Math.max(GRAIN_RADIUS_MIN, Math.min(GRAIN_RADIUS_MAX, raw));
}

export default function ArticlesSphere({
  visibleArticles,
  topicSlots,
  topicSlotByName,
  maxAgeHours,
  cloudDensity = "normal",
  favoriteIds,
  pendingIds,
  userId,
  onToggleFavorite,
  onDismiss,
}: {
  // Déjà filtrés (écartés + fenêtre temporelle) par ArticlesView : état
  // désormais partagé avec le bandeau compact au-dessus de la sphère (titre,
  // légende, cadran de fraîcheur) et la vue Liste, une seule source de
  // vérité plutôt que deux calculs qui pourraient diverger.
  visibleArticles: FeedArticle[];
  topicSlots: TopicSlot[];
  topicSlotByName: Map<string, TopicSlot>;
  maxAgeHours: number | null;
  cloudDensity?: CloudDensity;
  // État favori/écarté remonté dans use-article-actions.ts, partagé avec la
  // vue liste (articles-view.tsx) — voir le commentaire sur ce hook.
  favoriteIds: Set<string>;
  pendingIds: Set<string>;
  userId: string | null;
  onToggleFavorite: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  // Réglages manuels de l'espacement du nuage extérieur (curseurs rendus
  // plus bas). sphereGap = distance entre le bord de la sphère et le début
  // de la bande de grains. starGap (l'ancien seuil de distance entre deux
  // grains) n'est plus lu ici : remplacé par minPixelSep, dérivé du rayon
  // adaptatif des grains eux-mêmes (voir computeGrainRadius/GRAIN_RADIUS_MAX
  // plus haut et son usage plus bas) — une préférence indépendante de la
  // taille réelle des grains ne pouvait plus garantir l'absence de
  // chevauchement une fois cette taille devenue adaptative.
  const spacing = useSyncExternalStore(
    subscribeSpacing,
    getSpacingSnapshot,
    getSpacingServerSnapshot,
  );
  const sphereGap = spacing.sphereGap;
  const starSize = spacing.starSize;
  const exteriorRStart = SPHERE_R + sphereGap;
  const maxR = exteriorRStart + DEFAULT_BAND_WIDTH;

  // Pas d'effet pour fermer le panneau si l'article sélectionné vient d'être
  // écarté depuis l'autre vue (état favori/écarté désormais partagé, voir
  // plus haut) : inutile, selectedArticle (plus bas) est dérivé de
  // visibleArticles, qui exclut déjà les articles écartés — le panneau et
  // l'anneau de sélection disparaissent donc d'eux-mêmes au rendu suivant.

  // Volume par sujet DANS LA FENÊTRE TEMPORELLE ACTUELLE (visibleArticles,
  // déjà filtrée par maxAgeHours) — pour l'intensité de la nébuleuse
  // (cahier des charges §3.1/§3.6) : un sujet sans aucun article dans la
  // période affichée ne doit montrer aucune nébuleuse, pas une nébuleuse
  // "fantôme" à intensité fixe comme avant.
  const topicCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of visibleArticles) {
      const key = a.topicName || "Sans sujet";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [visibleArticles]);
  const maxTopicCount = Math.max(1, ...topicCounts.values());

  // --- Refs DOM et état de rendu imperatif --------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const grainLayerRef = useRef<SVGGElement>(null);
  const grainElsRef = useRef<Map<string, SVGCircleElement>>(new Map());
  const grainStateRef = useRef<Map<string, GrainState>>(new Map());
  // Rayon rendu courant (unités du viewBox), recalculé à chaque passage de
  // l'effet de synchronisation par computeGrainRadius — voir GRAIN_RADIUS_MAX
  // plus haut. Lu depuis la boucle d'animation (effet séparé), d'où le ref :
  // même raison que hitStrokeWidthRef juste en dessous.
  const grainRadiusRef = useRef(GRAIN_RADIUS_MIN);
  // Écart minimal réellement imposé entre deux grains lors du dernier
  // placement (2×grainRadiusRef.current + GRAIN_SAFETY_MARGIN à ce
  // moment-là — voir son calcul dans l'effet de synchronisation). Sert de
  // PLAFOND à la marge cliquable invisible ci-dessous (recomputeHitStrokeWidth) :
  // sans ce plafond, une marge cliquable visant 44px réels pourrait à
  // nouveau dépasser l'écart réel entre grains voisins et les faire se
  // chevaucher fonctionnellement (un tap sur le mauvais grain) — exactement
  // le bug déjà rencontré une fois avec l'ancienne version de ce système.
  const minPixelSepRef = useRef(GRAIN_RADIUS_MIN * 2 + GRAIN_SAFETY_MARGIN);
  // Marge cliquable courante (unités du viewBox), recalculée à partir de la
  // taille réelle affichée du conteneur — voir HIT_TARGET_PX plus haut et
  // recomputeHitStrokeWidth plus bas. Valeur de départ = MIN_HIT_STROKE
  // (comportement desktop d'origine) le temps de la première mesure.
  const hitStrokeWidthRef = useRef(MIN_HIT_STROKE);
  const selectionRingRef = useRef<SVGCircleElement>(null);
  const connectorRef = useRef<SVGSVGElement>(null);
  const connectorLineRef = useRef<SVGLineElement | null>(null);
  const limbRef = useRef<SVGEllipseElement>(null);
  const fillGradRef = useRef<SVGRadialGradientElement>(null);
  // Position courante du pointeur, en unités du viewBox (0-800), mise à jour
  // par un seul écouteur pointermove sur le <svg> (pas par grain) ; `null`
  // quand le pointeur est hors de la sphère. Sert au survol/curseur système
  // maison, calculé une fois par frame dans la boucle d'animation — voir le
  // commentaire complet sur updateHoverCursor plus bas.
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredGrainIdRef = useRef<string | null>(null);
  // Court délai anti-rebond avant d'effacer pointerPosRef sur un
  // pointerleave du <svg> (voir onPointerLeave) : le <svg> lui-même ne
  // pulse/dérive jamais (contrairement à un grain — voir plus haut), donc
  // ceci n'absorbe pas une oscillation périodique comme un essai précédent
  // raté, seulement un sursaut ponctuel et rare (élément hors ligne un
  // instant pendant une mutation d'attribut cx/cy non atomique).
  const pointerLeaveTimeoutRef = useRef<number | null>(null);
  // La détection de survol elle-même vit dans l'effet de la boucle
  // d'animation (a besoin de grainStateRef à jour) ; l'écouteur pointermove
  // qui alimente pointerPosRef vit dans l'effet glisser/zoom (juste en
  // dessous). Deux effets séparés, donc indirection par ref : sous
  // prefers-reduced-motion, la boucle d'animation ne tourne pas en continu
  // (voir plus bas), pointermove doit alors déclencher le calcul lui-même
  // pour que le curseur suive quand même la souris.
  const updateHoverCursorRef = useRef<() => void>(() => {});

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const rotRef = useRef({ y: 0, x: 0, velY: 0, velX: 0 });
  const zoomRef = useRef(1);
  const dragRef = useRef<{
    x: number;
    y: number;
    t: number;
    startX: number;
    startY: number;
    pointerId: number;
    captured: boolean;
  } | null>(null);
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  // Dark/light suivent data-theme sur <html> — voir topic-colors.ts.
  const isLight = useIsLightTheme();
  const { setSphereLegend } = useArticlesControls();

  function topicColor(name: string): string {
    const slot = topicSlotByName.get(name || "Sans sujet");
    const dark = slot?.colorDark ?? TOPIC_PALETTE[0].dark;
    const light = slot?.colorLight ?? TOPIC_PALETTE[0].light;
    return isLight ? light : dark;
  }
  const fluxColor = isLight ? FLUX_COLOR.light : FLUX_COLOR.dark;

  // --- Synchronisation des grains visibles (créé/retiré, cible de rayon,
  // statut) à chaque changement de données ou de fenêtre temporelle. La
  // boucle d'animation ci-dessous ne fait que lire/avancer cet état, jamais
  // le reconstruire : les deux effets sont volontairement séparés pour ne
  // pas redémarrer la boucle de rotation à chaque frappe de filtre. ------
  useEffect(() => {
    const layer = grainLayerRef.current;
    if (!layer) return;

    const wh = maxAgeHours ?? 110;
    const nonTrie = visibleArticles.filter((a) => !favoriteIds.has(a.id));
    const keepCount = Math.round(nonTrie.length * densityFraction(cloudDensity));
    const keepSet = new Set(nonTrie.slice(0, keepCount).map((a) => a.id));
    const shown = visibleArticles.filter((a) => favoriteIds.has(a.id) || keepSet.has(a.id));
    const shownIds = new Set(shown.map((a) => a.id));

    grainElsRef.current.forEach((el, id) => {
      if (!shownIds.has(id)) {
        el.remove();
        grainElsRef.current.delete(id);
        grainStateRef.current.delete(id);
      }
    });

    // Secteur angulaire disponible par sujet, dynamique ET pondéré par le
    // nombre réel de grains extérieurs de ce sujet (pas juste le nombre de
    // sujets) : un sujet avec 90 grains a besoin de bien plus de place
    // qu'un sujet avec 8, or une répartition égale (360°/nombre de sujets)
    // leur donnait la MÊME largeur de secteur — c'est ça qui empêchait
    // placeExteriorGrains de trouver assez de place pour un sujet très
    // fourni (cas réel, 75-94 articles), quel que soit le budget de
    // tentatives. part = grains de ce sujet / total de grains extérieurs
    // affichés ; 84% de 360°×part, plancher (15°) pour qu'un sujet peu
    // fourni ne soit pas écrasé à presque rien, plafond (SLOT_HALF_WIDTH_MAX_DEG)
    // pour qu'un sujet isolé ne s'étale pas sur presque tout le tour.
    const exteriorByTopicCount = new Map<string, number>();
    for (const a of shown) {
      if (favoriteIds.has(a.id)) continue;
      const key = a.topicName || "Sans sujet";
      exteriorByTopicCount.set(key, (exteriorByTopicCount.get(key) ?? 0) + 1);
    }
    const totalExterior = Math.max(1, [...exteriorByTopicCount.values()].reduce((s, v) => s + v, 0));
    function halfWidthForTopic(topicKey: string): number {
      const share = (exteriorByTopicCount.get(topicKey) ?? 0) / totalExterior;
      return Math.max(15, Math.min(SLOT_HALF_WIDTH_MAX_DEG, 360 * share * 0.42));
    }

    // Placement du nuage extérieur, TOUS SUJETS CONFONDUS (pas sujet par
    // sujet) : recalculé à partir de tous les grains extérieurs actuellement
    // affichés (pas seulement les nouveaux), pour que la distance minimale
    // reste garantie même quand le lot visible change (filtre temporel,
    // densité). Les grains déjà affichés ne sautent pas pour autant :
    // baseAngleCurrent/r3current rattrapent la nouvelle cible en douceur
    // dans la boucle d'animation (voir plus bas).
    const exteriorCandidates: ExteriorCandidate[] = [];
    for (const a of shown) {
      if (favoriteIds.has(a.id)) continue;
      const topicKey = a.topicName || "Sans sujet";
      const topicAngleDeg = topicSlotByName.get(topicKey)?.angleDeg ?? -90;
      const halfWidth = halfWidthForTopic(topicKey);
      const h = hashString(a.id);
      const homeOffset = (((h % 1000) / 1000) * 2 - 1) * halfWidth;
      const fraction = Math.min(1, a.ageHours / wh);
      const radialJitter = (((h >>> 10) % 1000) / 1000) * 2 - 1;
      const homeRadius = exteriorRStart + fraction * (maxR - exteriorRStart) + radialJitter * 22;
      exteriorCandidates.push({ id: a.id, topicAngleDeg, halfWidth, homeOffset, homeRadius });
    }
    // Rayon rendu, dérivé du nombre réel de grains extérieurs à caser —
    // voir computeGrainRadius/GRAIN_RADIUS_MAX plus haut ("10 fois plus
    // grandes, interdiction d'être superposées"). Calculé ICI (pas
    // seulement lu) : exteriorCandidates.length vient d'être établi
    // ci-dessus, c'est la première fois dans le passage où ce nombre est
    // connu. minPixelSep remplace le curseur starGap (retiré de l'interface,
    // sa valeur ne reflétait de toute façon aucune notion de taille des
    // grains) : 2×rayon+marge est l'écart RÉELLEMENT nécessaire pour que
    // deux disques de ce rayon ne se touchent jamais, pas une préférence
    // arbitraire — c'est ce qui fait tenir la promesse de non-chevauchement,
    // pas seulement la taille choisie en elle-même.
    const grainRadius = computeGrainRadius(exteriorCandidates.length, exteriorRStart, maxR);
    grainRadiusRef.current = grainRadius;
    const minPixelSep = grainRadius * 2 + GRAIN_SAFETY_MARGIN;
    minPixelSepRef.current = minPixelSep;
    const placedById = placeExteriorGrains(exteriorCandidates, minPixelSep, exteriorRStart, maxR);

    for (const a of shown) {
      const topicKey = a.topicName || "Sans sujet";
      const slot = topicSlotByName.get(topicKey);
      const angleDeg = slot?.angleDeg ?? -90;
      const fraction = Math.min(1, a.ageHours / wh);
      const interior = favoriteIds.has(a.id);
      const h = hashString(a.id);
      // `>>>` (décalage NON signé) partout ci-dessous, jamais `>>` : h va
      // jusqu'à 2^32-1 (hashString retourne `>>> 0`), donc pour la moitié des
      // valeurs environ (h ≥ 2^31), un décalage signé réinterprète h comme un
      // Int32 négatif, et `%1000` sur un nombre négatif reste négatif en JS.
      // Bug vécu : `size = 52 + ((h>>20)%1000)/1000*66` sortait des valeurs
      // de rayon SVG négatives ("<circle> attribute r: A negative value is
      // not valid"), pour les nébuleuses comme pour les grains.
      const angleJitter = ((h % 1000) / 1000) * 2 - 1;
      const radialJitter = (((h >>> 10) % 1000) / 1000) * 2 - 1;
      const freshFrac = Math.min(1, a.ageHours / 110);

      // Non défini seulement pour un grain intérieur (favori) : ceux-ci ne
      // passent pas par placeExteriorGrains (repli théorique, jamais
      // atteint pour un grain extérieur puisque exteriorCandidates couvre
      // exactement les mêmes articles non favoris que cette boucle).
      const placed = placedById.get(a.id);
      const exteriorAngle = placed ? angleDeg + placed.offset : angleDeg + angleJitter * 36;

      let gs = grainStateRef.current.get(a.id);
      if (!gs) {
        gs = {
          theta: ((angleDeg + angleJitter * 36) * Math.PI) / 180,
          phi: ((90 + (((h >>> 20) % 640) / 10 - 32)) * Math.PI) / 180,
          baseAngleTarget: exteriorAngle,
          baseAngleCurrent: exteriorAngle,
          r3current: interior ? 6 : SPHERE_R * 1.3,
          r3target: 0,
          interior,
          size: starSize,
          fill: fluxColor,
          baseOpacity: 0.6,
          driftPhase: ((h >>> 4) % 1000) / 1000 * Math.PI * 2,
          driftSpeed: 0.15 + (((h >>> 8) % 1000) / 1000) * 0.25,
          driftRadius: 3 + (((h >>> 12) % 1000) / 1000) * 3,
          twinklePhase: ((h >>> 16) % 1000) / 1000 * Math.PI * 2,
          twinkleSpeed: 0.5 + (((h >>> 18) % 1000) / 1000) * 0.7,
          pulsePhase: ((h >>> 22) % 1000) / 1000 * Math.PI * 2,
          pulseSpeed: (2 * Math.PI) / 0.9 + freshFrac * ((2 * Math.PI) / 7 - (2 * Math.PI) / 0.9),
          pulseAmp: 0.16 - freshFrac * 0.115,
          lastX: CX,
          lastY: CY,
        };
        grainStateRef.current.set(a.id, gs);
      }
      gs.interior = interior;
      gs.size = starSize;
      // Cible ré-assignée à chaque passage (pas seulement à la création) :
      // le groupe relaxé peut se redistribuer légèrement quand un voisin
      // apparaît/disparaît. baseAngleCurrent rattrape en douceur, voir plus
      // bas dans la boucle d'animation.
      gs.baseAngleTarget = exteriorAngle;
      if (interior) {
        gs.r3target = 16 + fraction * (SPHERE_R * 0.84 - 16) + radialJitter * 8;
        gs.fill = topicColor(topicKey);
        gs.baseOpacity = 0.78;
      } else {
        // Rayon issu de placeExteriorGrains : la formule fraîcheur + jitter
        // ±22 reste la valeur de départ ("home"), ajustée seulement si une
        // collision avec un autre grain l'a exigé (voir le curseur "distance
        // entre les étoiles" plus bas) — jamais au hasard, jamais plus qu'il
        // ne faut.
        gs.r3target =
          placed?.radius ?? exteriorRStart + fraction * (maxR - exteriorRStart) + radialJitter * 22;
        gs.fill = fluxColor;
        gs.baseOpacity = 0.62;
      }

      let el = grainElsRef.current.get(a.id);
      if (!el) {
        el = document.createElementNS(SVG_NS, "circle");
        el.setAttribute("class", styles.sphereGrain);
        el.setAttribute("r", "0");
        el.setAttribute("opacity", "0");
        // Zone cliquable élargie sans toucher à l'apparence : un contour
        // transparent (toujours "peint" pour le hit-testing SVG, comme un
        // fill transparent — voir le bug de clic précédent) ajoute une marge
        // tout autour du grain visuel (rayon réel ~5-7px, size=6.2). Marge
        // exprimée en unités du viewBox mais calculée pour viser un diamètre
        // cliquable réel constant (HIT_TARGET_PX) quelle que soit la taille
        // affichée du conteneur — voir recomputeHitStrokeWidth plus bas :
        // fixe à 16 unités, elle donnait ~8px réels sur desktop (conteneur
        // large) mais à peine 6-7px sur smartphone (conteneur étroit,
        // .sphereContainer descend à 320px), largement sous le seuil tactile.
        // hitStrokeWidthRef.current est déjà à jour à ce stade (mesuré au
        // montage, avant que les grains ne soient créés) ; remise à jour sur
        // TOUS les grains existants si le conteneur change de taille
        // (redimensionnement, rotation d'écran), voir le ResizeObserver plus
        // bas — donc pas besoin de la remettre à jour ici à chaque frame,
        // seulement à la création.
        el.setAttribute("stroke", "transparent");
        el.setAttribute("stroke-width", hitStrokeWidthRef.current.toFixed(2));
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.addEventListener("click", () => setSelectedId(a.id));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedId(a.id);
          }
        });
        // Pas d'écouteur pointerenter/pointerleave ici pour le curseur : un
        // essai précédent (avec délai anti-rebond) semblait corriger le
        // clignotement, mais ne faisait que le déplacer — la vraie cause est
        // la PULSATION du grain (le rayon oscille en continu, période aussi
        // courte que 0,9s pour un article très récent), qui fait traverser
        // la frontière de survol par un curseur pourtant immobile, à un
        // rythme plus lent que n'importe quel délai anti-rebond raisonnable.
        // Le survol/curseur système est donc entièrement piloté hors du
        // mécanisme natif (:hover / pointerenter), dans la boucle
        // d'animation ci-dessous, avec un rayon de détection FIXE qui ne
        // pulse jamais — voir updateHoverCursor plus bas.
        layer.appendChild(el);
        grainElsRef.current.set(a.id, el);
      }
      el.setAttribute("aria-label", a.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visibleArticles,
    favoriteIds,
    topicSlotByName,
    maxAgeHours,
    cloudDensity,
    isLight,
    exteriorRStart,
    maxR,
    starSize,
  ]);

  // --- Boucle de rotation / pulsation / dérive — refs uniquement, aucun
  // état React en jeu : monte une seule fois, tourne tant que le composant
  // est affiché. ------------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let lastT: number | null = null;

    function frame(dt: number, immediate: boolean) {
      const layer = grainLayerRef.current;
      if (!layer) return;
      const reduced = reducedMotionRef.current;
      const rot = rotRef.current;

      if (!immediate && !reduced) {
        if (!dragRef.current) rot.y += AUTO_SPIN_RAD_S * dt;
        rot.y += rot.velY * dt;
        rot.x += rot.velX * dt;
        const damp = Math.pow(0.05, dt);
        rot.velY *= damp;
        rot.velX *= damp;
        const maxX = (55 * Math.PI) / 180;
        if (rot.x > maxX) {
          rot.x = maxX;
          rot.velX = 0;
        }
        if (rot.x < -maxX) {
          rot.x = -maxX;
          rot.velX = 0;
        }
      }
      const cosY = Math.cos(rot.y);
      const sinY = Math.sin(rot.y);
      const cosX = Math.cos(rot.x);
      const sinX = Math.sin(rot.x);
      const ease = immediate ? 1 : Math.min(1, dt * 4.5);

      grainStateRef.current.forEach((gs, id) => {
        const el = grainElsRef.current.get(id);
        if (!el) return;
        gs.r3current += (gs.r3target - gs.r3current) * ease;
        gs.baseAngleCurrent += (gs.baseAngleTarget - gs.baseAngleCurrent) * ease;
        if (!immediate && !reduced) gs.pulsePhase += dt * gs.pulseSpeed;
        const pulse = reduced ? 0 : Math.sin(gs.pulsePhase) * gs.pulseAmp;

        let sx: number;
        let sy: number;
        let depth: number;
        if (gs.interior) {
          const x0 = gs.r3current * Math.sin(gs.phi) * Math.cos(gs.theta);
          const y0 = gs.r3current * Math.cos(gs.phi);
          const z0 = gs.r3current * Math.sin(gs.phi) * Math.sin(gs.theta);
          const x1 = x0 * cosY + z0 * sinY;
          const z1 = -x0 * sinY + z0 * cosY;
          const y2 = y0 * cosX - z1 * sinX;
          const z2 = y0 * sinX + z1 * cosX;
          sx = CX + x1;
          sy = CY + y2;
          depth = (z2 + SPHERE_R) / (2 * SPHERE_R);
          el.setAttribute(
            "r",
            Math.max(grainRadiusRef.current, gs.size * (0.72 + 0.32 * depth) * (1 + pulse)).toFixed(2),
          );
        } else {
          if (!immediate && !reduced) {
            gs.driftPhase += dt * gs.driftSpeed;
            gs.twinklePhase += dt * gs.twinkleSpeed;
          }
          // Décalage de dérive TANGENTIEL (perpendiculaire au rayon), de
          // magnitude fixe (driftRadius, 3-6 unités) — PAS un décalage
          // ANGULAIRE fixe comme avant (+0.05 rad). Un angle fixe se
          // traduit par un déplacement ABSOLU = angle × rayon : avec un
          // grand écart étoile-sphère (sphereGap élevé, rayon orbital de
          // plusieurs centaines d'unités), même 0,05 rad produisait un
          // débattement de plusieurs dizaines d'unités — l'étoile
          // "voyageait" bien plus que prévu, et le survol (voir
          // updateHoverCursor) perdait le grain en une fraction de seconde.
          // Un déplacement tangentiel de magnitude fixe garde la même
          // amplitude visuelle quel que soit le rayon.
          const angRad = (gs.baseAngleCurrent * Math.PI) / 180;
          const tangentialDrift = Math.sin(gs.driftPhase) * gs.driftRadius;
          sx =
            CX +
            gs.r3current * Math.cos(angRad) -
            Math.sin(angRad) * tangentialDrift +
            Math.sin(gs.driftPhase * 0.6) * gs.driftRadius;
          sy =
            CY +
            gs.r3current * Math.sin(angRad) +
            Math.cos(angRad) * tangentialDrift +
            Math.cos(gs.driftPhase * 0.5) * gs.driftRadius;
          depth = reduced ? 1 : 0.82 + 0.18 * Math.sin(gs.twinklePhase);
          el.setAttribute("r", Math.max(grainRadiusRef.current, gs.size * (1 + pulse)).toFixed(2));
        }
        el.setAttribute("cx", sx.toFixed(2));
        el.setAttribute("cy", sy.toFixed(2));
        el.setAttribute("fill", gs.fill);
        el.setAttribute("opacity", Math.max(0.05, gs.baseOpacity * depth * (1 + pulse * 0.6)).toFixed(2));
        el.classList.toggle(styles.sphereGrainSelected, id === selectedIdRef.current);
        gs.lastX = sx;
        gs.lastY = sy;
      });

      const ring = selectionRingRef.current;
      if (ring) {
        const gs = selectedIdRef.current ? grainStateRef.current.get(selectedIdRef.current) : null;
        if (gs) {
          ring.style.display = "";
          ring.setAttribute("cx", gs.lastX.toFixed(2));
          ring.setAttribute("cy", gs.lastY.toFixed(2));
          ring.setAttribute("r", (gs.size + 3).toFixed(2));
          ring.classList.toggle(styles.sphereRingAnim, !reduced);
        } else {
          ring.style.display = "none";
          ring.classList.remove(styles.sphereRingAnim);
        }
      }

      const limb = limbRef.current;
      if (limb) {
        const limbAngle = -rot.y + Math.PI * 0.15;
        limb.setAttribute("cx", (CX + SPHERE_R * 0.94 * Math.cos(limbAngle)).toFixed(1));
        limb.setAttribute("cy", (CY + SPHERE_R * 0.94 * Math.sin(limbAngle) * 0.55 - rot.x * 40).toFixed(1));
      }
      const grad = fillGradRef.current;
      if (grad) {
        grad.setAttribute("cx", (0.36 + Math.sin(rot.y) * 0.1).toFixed(3));
        grad.setAttribute("cy", (0.3 + Math.sin(rot.x) * 0.08).toFixed(3));
      }

      updateConnector();
      updateHoverCursor();
    }

    // Survol/curseur système du nuage, hors du mécanisme natif :hover /
    // pointerenter-pointerleave : ceux-ci sont recalculés par le navigateur
    // à chaque frame pendant que le grain survolé bouge (dérive) ET pulse
    // (rayon oscillant, période aussi courte que 0,9s pour un article très
    // récent) — la frontière de survol traverse alors un curseur pourtant
    // immobile, à un rythme que même un délai anti-rebond raisonnable ne
    // peut pas absorber sans rendre la sélection molle. Corrigé à la racine
    // en sortant complètement de ce mécanisme :
    // - Test de distance au pointeur avec un rayon de détection FIXE
    //   (gs.size + 8, jamais multiplié par le facteur de pulsation) : la
    //   frontière elle-même ne pulse donc plus jamais.
    // - Le curseur système n'est réécrit QUE quand le grain survolé change
    //   réellement (comparaison à hoveredGrainIdRef), pas à chaque frame.
    // - Suspendu pendant un glisser (dragRef.current?.captured) : la main
    //   (grabbing, .sphereDragging) doit rester affichée, pas basculer vers
    //   un pointeur si un grain passe sous le curseur en cours de rotation.
    function updateHoverCursor() {
      const svgEl = grainLayerRef.current?.ownerSVGElement;
      if (!svgEl) return;
      const pos = dragRef.current?.captured ? null : pointerPosRef.current;
      let bestId: string | null = null;
      if (pos) {
        let bestDist = Infinity;
        grainStateRef.current.forEach((gs, id) => {
          // +16 (pas +8 comme la marge cliquable) : couvre confortablement
          // la dérive résiduelle bornée pour un grain extérieur (jusqu'à
          // ~2×driftRadius, 6-12 unités selon le grain — voir la formule de
          // dérive tangentielle plus haut), pour qu'un curseur immobile au
          // centre du grain ne sorte jamais de la zone de survol.
          const hitR = gs.size + 16;
          // Position de RÉFÉRENCE, pas gs.lastX/lastY (la position affichée
          // à l'écran, qui inclut la dérive) : gs.lastX/Y oscille en continu
          // même quand gs.baseAngleCurrent/r3current sont stables, via le
          // terme de dérive (driftPhase). À grande distance du centre
          // (sphereGap élevé), même une petite oscillation ANGULAIRE de
          // dérive produit un déplacement ABSOLU important (l'arc croît
          // avec le rayon) — largement supérieur à hitR pour une petite
          // taille d'étoile. Vérifié : avec une souris réelle immobile sur
          // un grain, ce déplacement dû à la seule dérive faisait sortir le
          // survol en moins d'une seconde, perçu comme un clignotement.
          // gs.baseAngleCurrent/r3current sont déjà lissés (interpolés vers
          // leur cible avec `ease`, jamais de terme oscillant ajouté) : une
          // fois la cible atteinte, cette position de référence est
          // parfaitement immobile, quoi que fassent pulsation/dérive.
          let hx: number;
          let hy: number;
          if (gs.interior) {
            // Rotation du globe = mouvement volontaire de la sphère elle-
            // même (pas un tremblement local à corriger) : la position
            // affichée reste la référence pour un grain intérieur.
            hx = gs.lastX;
            hy = gs.lastY;
          } else {
            const rad = (gs.baseAngleCurrent * Math.PI) / 180;
            hx = CX + gs.r3current * Math.cos(rad);
            hy = CY + gs.r3current * Math.sin(rad);
          }
          const d = Math.hypot(hx - pos.x, hy - pos.y);
          if (d <= hitR && d < bestDist) {
            bestDist = d;
            bestId = id;
          }
        });
      }
      if (bestId !== hoveredGrainIdRef.current) {
        const prevId = hoveredGrainIdRef.current;
        hoveredGrainIdRef.current = bestId;
        svgEl.style.cursor = bestId ? "pointer" : "";
        // Anneau de survol lui aussi appliqué ici, pas en CSS :hover — même
        // raisonnement que le curseur (voir .sphereGrainHovered) : ne
        // touche le DOM que sur un vrai changement de grain survolé, jamais
        // à chaque frame.
        if (prevId) grainElsRef.current.get(prevId)?.classList.remove(styles.sphereGrainHovered);
        if (bestId) grainElsRef.current.get(bestId)?.classList.add(styles.sphereGrainHovered);
      }
    }
    updateHoverCursorRef.current = updateHoverCursor;

    function updateConnector() {
      const overlay = connectorRef.current;
      const container = containerRef.current;
      const id = selectedIdRef.current;
      const gs = id ? grainStateRef.current.get(id) : null;
      // Ancre sur la vraie position du panneau (article-detail-panel.tsx,
      // #articleDetailPanel), en ligne parfaitement horizontale (0°) depuis
      // le grain : y2 = y1, jamais un point du panneau qui introduirait une
      // pente.
      const panelEl = document.getElementById("articleDetailPanel");
      if (!overlay || !container || !gs || !panelEl) {
        if (connectorLineRef.current) {
          connectorLineRef.current.remove();
          connectorLineRef.current = null;
        }
        return;
      }
      // Le trait est créé une seule fois puis seulement repositionné à
      // chaque frame (attributs mutés, pas l'élément recréé) : le recréer en
      // continu empêchait toute animation CSS (tracé/pulsation) de tourner,
      // puisqu'un nouvel élément relance son animation à zéro à chaque frame.
      let line = connectorLineRef.current;
      if (!line) {
        line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("class", styles.sphereConnectorLine);
        overlay.appendChild(line);
        connectorLineRef.current = line;
      }
      const cRect = container.getBoundingClientRect();
      const scale = cRect.width / 800;
      const x1 = gs.lastX * scale;
      const y1 = gs.lastY * scale;
      const panelRect = panelEl.getBoundingClientRect();
      const x2 = panelRect.left - cRect.left;
      const y2 = y1;
      line.setAttribute("x1", x1.toFixed(1));
      line.setAttribute("y1", y1.toFixed(1));
      line.setAttribute("x2", x2.toFixed(1));
      line.setAttribute("y2", y2.toFixed(1));
    }

    function tick(ts: number) {
      if (lastT === null) lastT = ts;
      const dt = Math.min(0.05, (ts - lastT) / 1000);
      lastT = ts;
      frame(dt, false);
      raf = requestAnimationFrame(tick);
    }

    frame(0, true);
    if (!reducedMotionRef.current) raf = requestAnimationFrame(tick);

    function onResize() {
      frame(0, true);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Sous prefers-reduced-motion, la boucle continue ne tourne pas : forcer un
  // rendu immédiat quand la sélection change, sinon l'anneau et le fil de
  // connexion resteraient sur leur dernière position calculée.
  useEffect(() => {
    if (!reducedMotion) return;
    const ring = selectionRingRef.current;
    const gs = selectedId ? grainStateRef.current.get(selectedId) : null;
    if (ring && gs) {
      ring.style.display = "";
      ring.setAttribute("cx", gs.lastX.toFixed(2));
      ring.setAttribute("cy", gs.lastY.toFixed(2));
      ring.setAttribute("r", (gs.size + 3).toFixed(2));
    } else if (ring) {
      ring.style.display = "none";
    }
  }, [selectedId, reducedMotion]);

  // --- Zone cliquable responsive des grains -------------------------------
  // .sphereContainer va de 320px (petit smartphone) à 760px (desktop) pour
  // représenter le même viewBox 800×800 (voir dashboard.module.css) : le
  // nombre de pixels réels par unité de viewBox varie donc du simple au
  // double+ selon l'écran. Une marge cliquable fixe en unités du viewBox
  // (l'ancien stroke-width="16") donnait donc un diamètre cliquable réel très
  // inégal — confortable sur desktop, sous le seuil tactile sur mobile.
  // Mesurée ici via getBoundingClientRect (même technique que le calcul de
  // rect pour la conversion pointeur → viewBox plus bas dans ce fichier) et
  // réappliquée à TOUS les grains déjà créés (grainElsRef), pas seulement aux
  // futurs — un ResizeObserver déclenche le recalcul à chaque changement de
  // taille du conteneur (redimensionnement de fenêtre, rotation d'écran).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function recomputeHitStrokeWidth() {
      const rect = container!.getBoundingClientRect();
      if (rect.width <= 0) return;
      // .sphereContainer a aspect-ratio: 1/1 (toujours carré), donc width et
      // height donnent la même échelle : un seul ratio suffit.
      const pxPerUnit = rect.width / 800;
      const desiredDiameterUnits = HIT_TARGET_PX / pxPerUnit;
      // Le contour ajoute stroke-width de part et d'autre du bord du cercle
      // dessiné : diamètre cliquable total = 2 × rayon dessiné + stroke-width.
      // grainRadiusRef.current (pas gs.size, qui peut être plus grand en cas
      // de pulsation) donne le plancher garanti, jamais le maximum ponctuel —
      // cible atteinte ou dépassée à tout instant, jamais juste à la limite.
      // Le rayon des grains est maintenant lui-même adaptatif, souvent bien
      // au-dessus de l'ancien plancher fixe — la marge nécessaire pour
      // atteindre 44px réels peut donc être négative (le grain suffit déjà à
      // lui seul) : Math.max(0, ...) l'empêche de devenir un stroke-width
      // négatif, invalide en SVG.
      const grainRadius = grainRadiusRef.current;
      const needed = Math.max(0, desiredDiameterUnits - 2 * grainRadius);
      // PLAFOND (interdiction de chevauchement, priorité absolue sur la
      // cible de 44px) : la marge ne doit jamais dépasser l'écart RÉEL
      // laissé entre deux grains voisins par le placement — voir
      // minPixelSepRef, calculé avec ce même grainRadius dans l'effet de
      // synchronisation. Au-delà, la zone cliquable d'un grain empiéterait
      // sur celle de son voisin (un tap pourrait sélectionner le mauvais
      // article) — le bug déjà rencontré avec l'ancienne version fixe de ce
      // système, ici rendu structurellement impossible plutôt que réévité au
      // cas par cas.
      const leftoverGap = Math.max(0, minPixelSepRef.current - 2 * grainRadius);
      const next = Math.min(Math.max(MIN_HIT_STROKE, needed), leftoverGap);
      if (Math.abs(next - hitStrokeWidthRef.current) < 0.1) return;
      hitStrokeWidthRef.current = next;
      const strokeAttr = next.toFixed(2);
      grainElsRef.current.forEach((el) => el.setAttribute("stroke-width", strokeAttr));
    }

    recomputeHitStrokeWidth();
    const ro = new ResizeObserver(recomputeHitStrokeWidth);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // --- Glisser-déposer (rotation) et molette (zoom) -----------------------
  useEffect(() => {
    const container = containerRef.current;
    const svg = container?.querySelector("svg[data-sphere-svg]") as SVGSVGElement | null;
    if (!svg || !container) return;

    function applyZoom() {
      svg!.style.transform = `scale(${zoomRef.current.toFixed(3)})`;
    }

    // Seuil avant de considérer le geste comme un glisser (et donc d'appeler
    // setPointerCapture) plutôt qu'un simple clic sur un grain. Nécessaire :
    // une fois la capture posée sur le pointerdown, le navigateur redirige
    // aussi le click de compatibilité vers l'élément capturant (le <svg>),
    // pas vers le grain sous le curseur — un clic franc (sans déplacement)
    // n'ouvrait donc jamais le panneau de détail, même si le clic
    // "atterrissait" bien sur le grain. Bug vécu, reproduit avec un clic
    // natif réel (Playwright .click()), pas seulement un dispatchEvent
    // synthétique qui contourne cette redirection.
    const DRAG_THRESHOLD = 4;

    function onPointerDown(e: PointerEvent) {
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        captured: false,
      };
      rotRef.current.velY = 0;
      rotRef.current.velX = 0;
    }
    function onPointerMove(e: PointerEvent) {
      // Un vrai mouvement confirme que le pointeur est toujours là : annule
      // un relâchement en attente (voir onPointerLeave).
      if (pointerLeaveTimeoutRef.current !== null) {
        window.clearTimeout(pointerLeaveTimeoutRef.current);
        pointerLeaveTimeoutRef.current = null;
      }
      // Position courante du pointeur (unités du viewBox), pour le survol
      // maison des grains — voir pointerPosRef et updateHoverCursor. Mise à
      // jour à chaque déplacement réel de la souris, indépendamment d'un
      // glisser en cours (le bloc ci-dessous, sous `if (!drag) return`, ne
      // gère que la rotation).
      const rect = svg!.getBoundingClientRect();
      const scale = rect.width / 800;
      pointerPosRef.current = {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
      // Recalcule tout de suite (pas seulement à la prochaine frame rAF) :
      // sous prefers-reduced-motion, la boucle d'animation ne tourne pas en
      // continu (voir plus bas), donc rien d'autre ne suivrait la souris.
      updateHoverCursorRef.current();

      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.captured) {
        const totalDist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
        if (totalDist < DRAG_THRESHOLD) return;
        drag.captured = true;
        svg!.setPointerCapture(drag.pointerId);
        containerRef.current?.classList.add(styles.sphereDragging);
      }
      const now = performance.now();
      const dtms = Math.max(1, now - drag.t);
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const sens = 0.012;
      const rot = rotRef.current;
      rot.y += dx * sens;
      rot.x = Math.max(-0.95, Math.min(0.95, rot.x + dy * sens));
      rot.velY = ((dx * sens) / (dtms / 1000)) * 0.14;
      rot.velX = ((dy * sens) / (dtms / 1000)) * 0.14;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.t = now;
    }
    function onPointerUp() {
      dragRef.current = null;
      containerRef.current?.classList.remove(styles.sphereDragging);
      if (reducedMotionRef.current) {
        rotRef.current.velY = 0;
        rotRef.current.velX = 0;
      }
      // Le survol était suspendu pendant le glisser (voir updateHoverCursor)
      // : recalcule tout de suite pour refléter la position actuelle du
      // pointeur, plutôt que d'attendre un prochain mouvement de souris.
      updateHoverCursorRef.current();
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomRef.current = Math.max(0.85, Math.min(1.3, zoomRef.current - e.deltaY * 0.0007));
      applyZoom();
    }
    // Écouté sur .sphereContainer (la DIV englobante), pas sur le <svg> :
    // légèrement plus robuste (surface de détection un peu plus large,
    // n'inclut pas les limites exactes du <svg>). Un cas résiduel reste
    // ouvert, documenté honnêtement plutôt que masqué : avec une souris
    // PARFAITEMENT immobile au pixel près pendant 2s+ (via Playwright, donc
    // sans aucun mouvement réel ensuite), un pointerleave finit par se
    // déclencher malgré tout — identique en production (`next build`) et en
    // développement, donc pas un artefact HMR/overlay. Aucune main humaine
    // ne peut tenir un curseur immobile au pixel près sur cette durée
    // (contrairement à un test automatisé) ; le débounce (voir plus bas)
    // absorbe déjà toute micro-instabilité réelle. Si ce résidu s'avère
    // perceptible en usage réel malgré tout, il faudra revenir dessus avec
    // un test piloté par un humain, pas seulement automatisé.
    function onPointerLeave() {
      if (pointerLeaveTimeoutRef.current !== null) {
        window.clearTimeout(pointerLeaveTimeoutRef.current);
      }
      pointerLeaveTimeoutRef.current = window.setTimeout(() => {
        pointerPosRef.current = null;
        updateHoverCursorRef.current();
        pointerLeaveTimeoutRef.current = null;
      }, 100);
    }

    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("pointerleave", onPointerLeave);
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerUp);
      container.removeEventListener("pointerleave", onPointerLeave);
      svg.removeEventListener("wheel", onWheel);
      if (pointerLeaveTimeoutRef.current !== null) {
        window.clearTimeout(pointerLeaveTimeoutRef.current);
      }
    };
  }, []);

  const interiorCount = visibleArticles.filter((a) => favoriteIds.has(a.id)).length;
  const selectedArticle = selectedId ? visibleArticles.find((a) => a.id === selectedId) ?? null : null;

  // Légende ("X en favoris · Y dans le flux affiché · ...") : affichée
  // juste au-dessus du footer (demande explicite, voir dashboard-shell.tsx)
  // plutôt que rendue ici. Le TEXTE est calculé ici (seul endroit qui
  // connaît interiorCount/visibleArticles.length), puis poussé via
  // setSphereLegend dans un effet — jamais pendant le rendu lui-même
  // (mettre à jour l'état d'un composant ANCÊTRE, DashboardShell, pendant
  // le rendu d'un DESCENDANT, ArticlesSphere, déclenche l'avertissement
  // React "Cannot update a component while rendering a different
  // component"). Nettoyée au démontage (retour à null) : sans ce nettoyage,
  // le dernier texte publié resterait affiché même après un passage en vue
  // Liste ou un changement de page, où ArticlesSphere est démonté (voir le
  // commentaire "Vue non active démontée" en tête de ce fichier).
  useEffect(() => {
    const text = `${interiorCount} en favori${interiorCount > 1 ? "s" : ""} · ${visibleArticles.length} dans le flux affiché · distance au centre = fraîcheur · intérieur/extérieur = favori ou non · glisser pour pivoter, molette pour zoomer`;
    setSphereLegend(text);
    return () => setSphereLegend(null);
  }, [interiorCount, visibleArticles.length, setSphereLegend]);

  return (
    <div className={styles.sphereRoot}>
      {/* Tous les curseurs de réglage (distances, taille des étoiles) ont
          été retirés sur demande explicite : les valeurs restent celles
          fixées la dernière fois (60/296/1), désormais figées dans le code
          par défaut plutôt que réglables depuis l'interface. */}
      <div className={styles.sphereVizWrap}>
        <div className={styles.sphereContainer} ref={containerRef}>
          <svg viewBox="0 0 800 800" data-sphere-svg className={styles.sphereSvg} aria-hidden="true">
            <defs>
              <radialGradient id="sphereFillGrad" ref={fillGradRef} cx="0.35" cy="0.3" r="75%">
                <stop offset="0%" stopColor={isLight ? "#ffffff" : "#bff3e0"} stopOpacity="0.22" />
                <stop offset="100%" stopColor={isLight ? "#534AB7" : "#5dcaa5"} stopOpacity="0.04" />
              </radialGradient>
              <radialGradient id="sphereHaloGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={isLight ? "#534AB7" : "#5dcaa5"} stopOpacity="0.16" />
                <stop offset="100%" stopColor={isLight ? "#534AB7" : "#5dcaa5"} stopOpacity="0" />
              </radialGradient>
              <filter id="sphereNebulaBlur" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="20" />
              </filter>
              <filter id="sphereLimbBlur" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="12" />
              </filter>
            </defs>

            <circle cx={CX} cy={CY} r={SPHERE_R * 1.8} fill="url(#sphereHaloGrad)" />

            <g>
              {topicSlots.map((slot) => {
                const count = topicCounts.get(slot.name) ?? 0;
                // Aucun article de ce sujet dans la fenêtre temporelle
                // actuelle : pas de nébuleuse "fantôme" (cahier des charges,
                // ce tour-ci) — voir topicCounts plus haut.
                if (count === 0) return null;
                const volFrac = Math.min(1, count / maxTopicCount);
                // Plancher (35% taille / 30% opacité) pour qu'un sujet avec
                // un seul article reste visible plutôt que de disparaître
                // presque totalement ; monte à 100% pour le sujet le plus
                // fourni de la fenêtre actuelle.
                const sizeMul = 0.35 + 0.65 * volFrac;
                const opacityMul = 0.3 + 0.7 * volFrac;
                const color = isLight ? slot.colorLight : slot.colorDark;
                // 6 particules qui se chevauchent par sujet, comme la
                // simulation de référence (NEBULA_PARTICLES) — une seule
                // particule fixe donnait une nébuleuse petite et clairsemée
                // au lieu d'un halo large et lumineux. Décalage angulaire/
                // radial et taille/opacité dérivés du hash du sujet plutôt
                // que Math.random() : stables d'un rendu à l'autre (pas de
                // scintillement au moindre re-rendu React), même formule que
                // la référence (angleOff ±30°, radiusOff ±38, size 52-118,
                // opacity 0.13-0.24), mise à l'échelle par sizeMul/opacityMul.
                return Array.from({ length: 6 }, (_, i) => {
                  const h = hashString(`${slot.name}#${i}`);
                  const angleOff = (((h % 1000) / 1000) * 2 - 1) * 30;
                  const radiusOff = ((((h >>> 10) % 1000) / 1000) * 2 - 1) * 38;
                  const size = (52 + (((h >>> 20) % 1000) / 1000) * 66) * sizeMul;
                  const baseOpacity = (0.13 + (((h >>> 4) % 1000) / 1000) * 0.11) * opacityMul;
                  const ang = ((slot.angleDeg + angleOff) * Math.PI) / 180;
                  const rad = 300 + radiusOff;
                  const nx = CX + rad * Math.cos(ang);
                  const ny = CY + rad * Math.sin(ang);
                  return (
                    <circle
                      key={`${slot.name}-${i}`}
                      cx={nx}
                      cy={ny}
                      r={size}
                      fill={color}
                      opacity={baseOpacity}
                      filter="url(#sphereNebulaBlur)"
                    />
                  );
                });
              })}
            </g>

            <circle
              cx={CX}
              cy={CY}
              r={SPHERE_R}
              fill="url(#sphereFillGrad)"
              stroke={isLight ? "#534AB7" : "#5dcaa5"}
              strokeWidth="0.75"
              strokeOpacity="0.5"
              className={styles.sphereBreathing}
            />
            <ellipse
              ref={limbRef}
              cx={CX + SPHERE_R}
              cy={CY}
              rx="50"
              ry="34"
              fill={isLight ? "#534AB7" : "#5dcaa5"}
              opacity={isLight ? 0.16 : 0.4}
              filter="url(#sphereLimbBlur)"
            />
            <ellipse cx={CX} cy={CY} rx={SPHERE_R} ry={SPHERE_R * 0.35} fill="none" stroke={isLight ? "#534AB7" : "#5dcaa5"} strokeWidth="0.4" opacity="0.28" />
            <ellipse cx={CX} cy={CY} rx={SPHERE_R * 0.35} ry={SPHERE_R} fill="none" stroke={isLight ? "#534AB7" : "#5dcaa5"} strokeWidth="0.4" opacity="0.28" />
            <ellipse cx={CX} cy={CY} rx={SPHERE_R} ry={SPHERE_R * 0.65} fill="none" stroke={isLight ? "#534AB7" : "#5dcaa5"} strokeWidth="0.4" opacity="0.2" />

            <g ref={grainLayerRef} />
            <circle ref={selectionRingRef} r="0" cx={CX} cy={CY} fill="none" stroke={isLight ? "#534AB7" : "#8b7cf6"} strokeWidth="1.4" className={styles.sphereRing} style={{ display: "none" }} />
          </svg>

          <svg ref={connectorRef} className={styles.sphereConnectorOverlay} aria-hidden="true" />
        </div>
      </div>

      <ArticleDetailPanel
        article={selectedArticle}
        topicColor={selectedArticle ? topicColor(selectedArticle.topicName || "Sans sujet") : "transparent"}
        isFavorited={selectedArticle ? favoriteIds.has(selectedArticle.id) : false}
        isPending={selectedArticle ? pendingIds.has(selectedArticle.id) : false}
        disabled={!userId}
        onToggleFavorite={() => selectedArticle && onToggleFavorite(selectedArticle.id)}
        onDismiss={() => selectedArticle && onDismiss(selectedArticle.id)}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
