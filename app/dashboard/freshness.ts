// Fraîcheur d'un article : couleur de jauge et libellé d'âge, extraits de
// article-feed.tsx pour être partagés avec la vue sphère et le panneau de
// détail (cahier des charges, §3.3 : "reprendre la même jauge FRAÎCHEUR que
// dans la vue liste actuelle, pour garder un repère identique entre les deux
// vues"). Comportement inchangé, purement un déplacement de code.
//
// Bornes recopiées en dur (thème DARK uniquement), comme dans l'original :
// voir le commentaire resté sur FeedArticle.ageHours dans article-feed.tsx
// pour la raison (pureté du composant serveur/client), et à revoir pour le
// thème LIGHT au même moment que ce TODO préexistant, pas ici.
const FRESH_WINDOW_HOURS = 72;
const COLD_COLOR = "#5c5b64";
const HOT_COLOR = "#8b7cf6";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixColor(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(
    lerp(a[1], b[1], t),
  )},${Math.round(lerp(a[2], b[2], t))})`;
}

export function freshnessFraction(ageHours: number): number {
  return Math.max(0, Math.min(1, 1 - ageHours / FRESH_WINDOW_HOURS));
}

export function freshnessColor(ageHours: number): string {
  return mixColor(COLD_COLOR, HOT_COLOR, freshnessFraction(ageHours));
}

export function ageLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.floor(hours / 24)} j ${Math.round(hours % 24)} h`;
}
