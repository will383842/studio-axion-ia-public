/**
 * MISE EN PAGE DE LA DÉMO FACECAM (lot J) — PUR, sans alias « @/ » ni React : lu par le moteur ET par la composition
 * Remotion `DemoFacecam` (`studio-rendu/compositions/demo-facecam/`).
 *
 * Écran partagé MOITIÉ / MOITIÉ : l'écran réel de Williams sur une moitié, sa facecam sur l'autre. Haut/bas pour le
 * 4:5 (format maître), le 9:16 et le 1:1 ; côte à côte pour le 16:9. Le motion design, les zooms, les surlignages et
 * les sous-titres restent DANS la moitié écran : rien ne se pose jamais sur la moitié du visage.
 */
import { adoucir } from "../../briques/jetons-motion";

export type RatioDemo = "4:5" | "9:16" | "1:1" | "16:9";
export const RATIO_MAITRE_DEMO: RatioDemo = "4:5";
export const FPS_DEMO = 25;
/** Carte de fin Axion, après la dernière image de Williams. */
export const DUREE_CARTE_FIN_MS = 2500;

export interface RectPx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export const TAILLES_DEMO: Record<RatioDemo, { largeur: number; hauteur: number }> = {
  "4:5": { largeur: 1080, hauteur: 1350 },
  "9:16": { largeur: 1080, hauteur: 1920 },
  "1:1": { largeur: 1080, hauteur: 1080 },
  "16:9": { largeur: 1920, hauteur: 1080 },
};

export interface MiseEnPageDemo {
  ratio: RatioDemo;
  largeur: number;
  hauteur: number;
  disposition: "haut-bas" | "cote-a-cote";
  ecran: RectPx;
  facecam: RectPx;
  /** Bande des sous-titres : en bas de la moitié écran. */
  sousTitres: RectPx;
}

const pair = (n: number) => 2 * Math.round(n / 2);

export function miseEnPageDemo(ratio: RatioDemo): MiseEnPageDemo {
  const { largeur, hauteur } = TAILLES_DEMO[ratio];
  const coteACote = ratio === "16:9";
  const ecran: RectPx = coteACote ? { x: 0, y: 0, largeur: pair(largeur / 2), hauteur } : { x: 0, y: 0, largeur, hauteur: pair(hauteur / 2) };
  const facecam: RectPx = coteACote ? { x: ecran.largeur, y: 0, largeur: largeur - ecran.largeur, hauteur } : { x: 0, y: ecran.hauteur, largeur, hauteur: hauteur - ecran.hauteur };
  const sousTitres: RectPx = { x: ecran.x + Math.round(ecran.largeur * 0.04), y: ecran.y + Math.round(ecran.hauteur * 0.8), largeur: Math.round(ecran.largeur * 0.92), hauteur: Math.round(ecran.hauteur * 0.17) };
  return { ratio, largeur, hauteur, disposition: coteACote ? "cote-a-cote" : "haut-bas", ecran, facecam, sousTitres };
}

export function dansLeRect(interieur: RectPx, exterieur: RectPx): boolean {
  return interieur.x >= exterieur.x && interieur.y >= exterieur.y && interieur.x + interieur.largeur <= exterieur.x + exterieur.largeur && interieur.y + interieur.hauteur <= exterieur.y + exterieur.hauteur;
}

export function seCroisent(a: RectPx, b: RectPx): boolean {
  return a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
}

/** Partie d'une source (vidéo seule déjà en écran partagé) : « entier » pour une vidéo d'un seul sujet. */
export type PartieSource = "entier" | "gauche" | "droite" | "haut" | "bas";

export function opposee(p: PartieSource): PartieSource {
  return p === "gauche" ? "droite" : p === "droite" ? "gauche" : p === "haut" ? "bas" : p === "bas" ? "haut" : "entier";
}

function partieDe(source: { largeur: number; hauteur: number }, p: PartieSource): RectPx {
  const { largeur: l, hauteur: h } = source;
  switch (p) {
    case "gauche":
      return { x: 0, y: 0, largeur: Math.floor(l / 2), hauteur: h };
    case "droite":
      return { x: Math.ceil(l / 2), y: 0, largeur: Math.floor(l / 2), hauteur: h };
    case "haut":
      return { x: 0, y: 0, largeur: l, hauteur: Math.floor(h / 2) };
    case "bas":
      return { x: 0, y: Math.ceil(h / 2), largeur: l, hauteur: Math.floor(h / 2) };
    default:
      return { x: 0, y: 0, largeur: l, hauteur: h };
  }
}

/**
 * Recadrage propre : la plus grande région de la partie de la source aux proportions de la cible (rien d'étiré, pas
 * de bande), centrée sur `centre` (0 à 1 dans la partie), sans sortir de la partie.
 */
export function recadrage(source: { largeur: number; hauteur: number }, partie: PartieSource, cible: { largeur: number; hauteur: number }, centre = { x: 0.5, y: 0.5 }): RectPx {
  const p = partieDe(source, partie);
  const rapport = cible.largeur / cible.hauteur;
  const largeur = Math.min(p.largeur, p.hauteur * rapport);
  const hauteur = largeur / rapport;
  const borne = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const x = borne(p.x + centre.x * p.largeur - largeur / 2, p.x, p.x + p.largeur - largeur);
  const y = borne(p.y + centre.y * p.hauteur - hauteur / 2, p.y, p.y + p.hauteur - hauteur);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r(x), y: r(y), largeur: r(largeur), hauteur: r(hauteur) };
}

/* --- Zooms doux sur la zone où Williams agit (en % de l'écran) ------------------------------------------------- */

export interface ZoomEcran {
  debutMs: number;
  finMs: number;
  /** Point visé, en % de l'écran. */
  x: number;
  y: number;
  facteur: number;
}

export const FACTEUR_ZOOM_MAX = 2.5;
const RAMPE_ZOOM_MS = 450;

/** Zoom à l'instant `ms` : facteur 1 hors des zooms, montée et descente douces (sans rebond). PUR. */
export function zoomA(zooms: readonly ZoomEcran[], ms: number): { facteur: number; x: number; y: number } {
  const z = zooms.find((e) => ms >= e.debutMs && ms < e.finMs);
  if (!z) return { facteur: 1, x: 50, y: 50 };
  const rampe = Math.min(RAMPE_ZOOM_MS, (z.finMs - z.debutMs) / 2);
  const t = Math.min(1, (ms - z.debutMs) / rampe, (z.finMs - ms) / rampe);
  const f = Math.min(FACTEUR_ZOOM_MAX, Math.max(1, z.facteur));
  return { facteur: Math.round((1 + (f - 1) * adoucir(Math.max(0, t))) * 1000) / 1000, x: z.x, y: z.y };
}

/** Transformation CSS du zoom (origine au point visé : le bord de l'écran ne se décolle jamais). */
export function transformZoom(z: { facteur: number; x: number; y: number }): { transform: string; transformOrigin: string } {
  return { transform: `scale(${z.facteur})`, transformOrigin: `${z.x}% ${z.y}%` };
}

/* --- Synchronisation des deux vidéos par l'audio (les mots transcrits de chacune) ------------------------------- */

export interface MotDate {
  mot: string;
  debutSec: number;
}

const normaliser = (m: string) =>
  m
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * Décalage (s) tel que `temps facecam = temps écran + decalageSec`, trouvé par les suites de 3 mots communes aux deux
 * transcriptions (la voix de Williams s'entend dans les deux fichiers). `null` : moins de 2 ancres concordantes.
 */
export function decalageParLesMots(facecam: readonly MotDate[], ecran: readonly MotDate[]): { decalageSec: number; ancres: number } | null {
  const cles = (mots: readonly MotDate[]) => {
    const n = mots.map((m) => normaliser(m.mot));
    const sortie = new Map<string, number[]>();
    for (let i = 0; i + 2 < n.length; i++) {
      if (!n[i] || !n[i + 1] || !n[i + 2]) continue;
      const k = `${n[i]} ${n[i + 1]} ${n[i + 2]}`;
      sortie.set(k, [...(sortie.get(k) ?? []), i]);
    }
    return sortie;
  };
  const a = cles(facecam);
  const b = cles(ecran);
  const ecarts: number[] = [];
  for (const [k, ia] of a) {
    const ib = b.get(k);
    // Suite unique des deux côtés seulement (une répétition donnerait une ancre douteuse).
    if (ia.length === 1 && ib?.length === 1) ecarts.push(facecam[ia[0]].debutSec - ecran[ib[0]].debutSec);
  }
  if (ecarts.length < 2) return null;
  ecarts.sort((x, y) => x - y);
  const mediane = ecarts[Math.floor(ecarts.length / 2)];
  const concordantes = ecarts.filter((e) => Math.abs(e - mediane) <= 0.25);
  if (concordantes.length < 2) return null;
  const moyenne = concordantes.reduce((s, e) => s + e, 0) / concordantes.length;
  return { decalageSec: Math.round(moyenne * 1000) / 1000, ancres: concordantes.length };
}
