"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FeedArticle } from "./article-feed";
import ArticleDetailPanel from "./article-detail-panel";
import AgeFilterDial from "./age-filter-dial";
import { TOPIC_PALETTE, hashString, useIsLightTheme } from "./topic-colors";
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

type TopicSlot = { name: string; angleDeg: number; colorDark: string; colorLight: string };

type GrainState = {
  theta: number;
  phi: number;
  baseAngleDeg: number;
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
const MAX_R = 368;
const AUTO_SPIN_RAD_S = (4.2 * Math.PI) / 180;

export default function ArticlesSphere({
  articles,
  topicOrder,
  cloudDensity = "normal",
  favoriteIds,
  dismissedIds,
  pendingIds,
  userId,
  onToggleFavorite,
  onDismiss,
}: {
  articles: FeedArticle[];
  topicOrder: string[];
  cloudDensity?: CloudDensity;
  // État favori/écarté remonté dans use-article-actions.ts, partagé avec la
  // vue liste (articles-view.tsx) — voir le commentaire sur ce hook.
  favoriteIds: Set<string>;
  dismissedIds: Set<string>;
  pendingIds: Set<string>;
  userId: string | null;
  onToggleFavorite: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [maxAgeHours, setMaxAgeHours] = useState<number | null>(72);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  // Pas d'effet pour fermer le panneau si l'article sélectionné vient d'être
  // écarté depuis l'autre vue (état favori/écarté désormais partagé, voir
  // plus haut) : inutile, selectedArticle (plus bas) est dérivé de
  // visibleArticles, qui exclut déjà les articles écartés — le panneau et
  // l'anneau de sélection disparaissent donc d'eux-mêmes au rendu suivant.

  const visibleArticles = useMemo(() => {
    const remaining = articles.filter((a) => !dismissedIds.has(a.id));
    return maxAgeHours === null
      ? remaining
      : remaining.filter((a) => a.ageHours < maxAgeHours);
  }, [articles, dismissedIds, maxAgeHours]);

  // --- Répartition des sujets : même ordre que la page Sujets, "Sans
  // sujet" toujours en dernier (voir groupByTopic, article-feed.tsx). ------
  const topicSlots: TopicSlot[] = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const name of topicOrder) {
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
    for (const a of visibleArticles) {
      const key = a.topicName || "Sans sujet";
      if (key !== "Sans sujet" && !seen.has(key)) {
        seen.add(key);
        names.push(key);
      }
    }
    if (visibleArticles.some((a) => !a.topicName)) names.push("Sans sujet");
    const n = Math.max(1, names.length);
    return names.map((name, i) => {
      const palette = TOPIC_PALETTE[hashString(name) % TOPIC_PALETTE.length];
      return {
        name,
        angleDeg: -90 + (360 / n) * i,
        colorDark: palette.dark,
        colorLight: palette.light,
      };
    });
  }, [topicOrder, visibleArticles]);

  const topicSlotByName = useMemo(() => {
    const map = new Map<string, TopicSlot>();
    for (const slot of topicSlots) map.set(slot.name, slot);
    return map;
  }, [topicSlots]);

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
  const selectionRingRef = useRef<SVGCircleElement>(null);
  const connectorRef = useRef<SVGSVGElement>(null);
  const connectorLineRef = useRef<SVGLineElement | null>(null);
  const limbRef = useRef<SVGEllipseElement>(null);
  const fillGradRef = useRef<SVGRadialGradientElement>(null);

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

      let gs = grainStateRef.current.get(a.id);
      if (!gs) {
        gs = {
          theta: ((angleDeg + angleJitter * 36) * Math.PI) / 180,
          phi: ((90 + (((h >>> 20) % 640) / 10 - 32)) * Math.PI) / 180,
          baseAngleDeg: angleDeg + angleJitter * 36,
          r3current: interior ? 6 : SPHERE_R * 1.3,
          r3target: 0,
          interior,
          size: 4.7,
          fill: fluxColor,
          baseOpacity: 0.6,
          driftPhase: ((h >>> 4) % 1000) / 1000 * Math.PI * 2,
          driftSpeed: 0.15 + (((h >>> 8) % 1000) / 1000) * 0.25,
          driftRadius: 3 + (((h >>> 12) % 1000) / 1000) * 5,
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
      gs.size = 4.7;
      if (interior) {
        gs.r3target = 16 + fraction * (SPHERE_R * 0.84 - 16) + radialJitter * 8;
        gs.fill = topicColor(topicKey);
        gs.baseOpacity = 0.78;
      } else {
        gs.r3target = SPHERE_R * 1.12 + fraction * (MAX_R - SPHERE_R * 1.12) + radialJitter * 8;
        gs.fill = fluxColor;
        gs.baseOpacity = 0.62;
      }

      let el = grainElsRef.current.get(a.id);
      if (!el) {
        el = document.createElementNS(SVG_NS, "circle");
        el.setAttribute("class", styles.sphereGrain);
        el.setAttribute("r", "0");
        el.setAttribute("opacity", "0");
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.addEventListener("click", () => setSelectedId(a.id));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedId(a.id);
          }
        });
        layer.appendChild(el);
        grainElsRef.current.set(a.id, el);
      }
      el.setAttribute("aria-label", a.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleArticles, favoriteIds, topicSlotByName, maxAgeHours, cloudDensity, isLight]);

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
          el.setAttribute("r", (gs.size * (0.72 + 0.32 * depth) * (1 + pulse)).toFixed(2));
        } else {
          if (!immediate && !reduced) {
            gs.driftPhase += dt * gs.driftSpeed;
            gs.twinklePhase += dt * gs.twinkleSpeed;
          }
          const angRad = (gs.baseAngleDeg * Math.PI) / 180 + Math.sin(gs.driftPhase) * 0.05;
          sx = CX + gs.r3current * Math.cos(angRad) + Math.sin(gs.driftPhase * 0.6) * gs.driftRadius;
          sy = CY + gs.r3current * Math.sin(angRad) + Math.cos(gs.driftPhase * 0.5) * gs.driftRadius;
          depth = reduced ? 1 : 0.82 + 0.18 * Math.sin(gs.twinklePhase);
          el.setAttribute("r", (gs.size * (1 + pulse)).toFixed(2));
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
    }

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

  // --- Glisser-déposer (rotation) et molette (zoom) -----------------------
  useEffect(() => {
    const svg = containerRef.current?.querySelector("svg[data-sphere-svg]") as SVGSVGElement | null;
    if (!svg) return;

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
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomRef.current = Math.max(0.85, Math.min(1.3, zoomRef.current - e.deltaY * 0.0007));
      applyZoom();
    }

    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerUp);
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerUp);
      svg.removeEventListener("wheel", onWheel);
    };
  }, []);

  const interiorCount = visibleArticles.filter((a) => favoriteIds.has(a.id)).length;
  const selectedArticle = selectedId ? visibleArticles.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div className={styles.sphereRoot}>
      {/* Légende permanente des sujets (remplace l'ancien badge flottant au
          survol d'une nébuleuse : superposé à la sphère, il masquait ce qu'il
          y avait dessous et n'était pas accessible sans pointeur). */}
      {topicSlots.length > 0 && (
        <div className={styles.sphereTopicLegend} aria-label="Sujets actifs">
          {topicSlots.map((slot) => (
            <span key={slot.name} className={styles.sphereTopicLegendItem}>
              <span
                className={styles.detailTopicDot}
                style={{ background: isLight ? slot.colorLight : slot.colorDark }}
                aria-hidden="true"
              />
              {slot.name}
            </span>
          ))}
        </div>
      )}

      <div className={styles.articleFilterBar}>
        <span className={styles.sectionCount}>
          {interiorCount} en favori{interiorCount > 1 ? "s" : ""} · {visibleArticles.length} dans le flux affiché
        </span>
        <AgeFilterDial value={maxAgeHours} onChange={setMaxAgeHours} />
      </div>

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

      <div className={styles.sphereLegend}>
        distance au centre = fraîcheur · intérieur/extérieur = favori ou non · glisser pour pivoter, molette pour zoomer
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
