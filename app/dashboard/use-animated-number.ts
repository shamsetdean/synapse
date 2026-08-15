"use client";

import { useEffect, useRef, useState } from "react";

// Anime un nombre affiché entre son ancienne et sa nouvelle valeur plutôt
// qu'un saut instantané. Partagé entre stats-panel.tsx (compteurs de la page
// Configuration) et article-feed.tsx (compteur du cadran de fraîcheur).
export function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const mountedOnce = useRef(false);

  useEffect(() => {
    // Premier rendu : pas d'animation, on affiche directement la valeur.
    if (!mountedOnce.current) {
      mountedOnce.current = true;
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
