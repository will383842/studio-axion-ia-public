/**
 * CONTRÔLE SANS IA DE LA VIDÉO FINIE : pièce COMMUNE, 0 €, appelable par tout générateur (T-EXT-23).
 * = `controlerImageFinale` repris tel quel + contrôles de charte sur ce qui est réellement rendu (couleurs, polices).
 * PUR : aucune lecture, aucun appel, aucune horloge. Rien ne l'appelle encore (aucun branchement sur un générateur).
 * Couleurs ou polices absentes : « non fait », jamais « réussi ».
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import { COULEURS_CHARTE, FAMILLE_CSS, POLICE } from "@/briques/charte/axion-2026";
import { zoneSureDe } from "./mise-en-page";
import { controlerImageFinale } from "./rapport";
import type { EtatControle, MesuresExport, MiseEnPage, RapportControleImage } from "./types";

/** Contrôle de charte : type propre à ce fichier (n'élargit pas `IdControle`). */
export interface ResultatCharte {
  id: "couleurs" | "polices";
  libelle: string;
  bloquant: boolean;
  etat: EtatControle;
  raison: string;
  /** Une ligne lisible par défaut trouvé. */
  details: string[];
}

export interface ElementHorsCharte {
  valeur: string;
  motif: "bleu" | "jaune" | "hors charte";
}

/** Saturation HSL en dessous de laquelle une couleur est un gris neutre (permis). */
export const SATURATION_GRIS_MAX = 0.08;
const SATURATION_TEINTE_MIN = 0.2;

interface Rvb {
  r: number;
  g: number;
  b: number;
}

function canal(texte: string): number | null {
  const t = texte.trim();
  const v = t.endsWith("%") ? (Number(t.slice(0, -1)) * 255) / 100 : Number(t);
  return Number.isFinite(v) && v >= 0 && v <= 255 ? Math.round(v) : null;
}

/** Hex 3, 6 ou 8 chiffres, `rgb()` ou `rgba()` ; l'opacité est ignorée. `null` si illisible. */
export function lireCouleur(brut: string): Rvb | null {
  const t = String(brut ?? "").trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const f = /^rgba?\(\s*([^,\s/]+)[\s,]+([^,\s/]+)[\s,]+([^,\s/)]+)\s*(?:[,/]\s*[^)]+)?\)$/i.exec(t);
  if (f) {
    const [r, g, b] = [canal(f[1]!), canal(f[2]!), canal(f[3]!)];
    if (r !== null && g !== null && b !== null) return { r, g, b };
  }
  return null;
}

function hsl({ r, g, b }: Rvb): { teinte: number; saturation: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { teinte: 0, saturation: 0 };
  const saturation = d / (1 - Math.abs(2 * l - 1));
  let teinte: number;
  if (max === R) teinte = ((G - B) / d) % 6;
  else if (max === G) teinte = (B - R) / d + 2;
  else teinte = (R - G) / d + 4;
  teinte = (teinte * 60 + 360) % 360;
  return { teinte, saturation };
}

const enMajuscules = ({ r, g, b }: Rvb): string => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** Couleurs refusées : hors `COULEURS_CHARTE` (opacité ignorée) et qui ne sont pas un gris neutre. */
export function couleursHorsCharte(couleurs: readonly string[]): ElementHorsCharte[] {
  const refus: ElementHorsCharte[] = [];
  for (const brut of couleurs) {
    const c = lireCouleur(brut);
    if (!c) {
      refus.push({ valeur: String(brut), motif: "hors charte" });
      continue;
    }
    if (COULEURS_CHARTE.includes(enMajuscules(c))) continue;
    const { teinte, saturation } = hsl(c);
    if (saturation < SATURATION_GRIS_MAX) continue;
    if (saturation >= SATURATION_TEINTE_MIN && teinte >= 180 && teinte <= 260) refus.push({ valeur: String(brut), motif: "bleu" });
    else if (saturation >= SATURATION_TEINTE_MIN && teinte >= 45 && teinte <= 70) refus.push({ valeur: String(brut), motif: "jaune" });
    else refus.push({ valeur: String(brut), motif: "hors charte" });
  }
  return refus;
}

const REPLIS_PERMIS: readonly string[] = ["sans-serif", "system-ui"];

const nomPolice = (p: string): string => p.trim().replace(/^["']+|["']+$/g, "").trim();

/**
 * Polices refusées. Une valeur peut être une pile CSS (« "Axion Manrope", "Manrope", sans-serif ») : la première
 * police doit être `POLICE` ou `FAMILLE_CSS` ; `sans-serif` et `system-ui` ne sont permis qu'en repli.
 */
export function policesHorsCharte(polices: readonly string[]): ElementHorsCharte[] {
  const refus: ElementHorsCharte[] = [];
  const marque = [POLICE.toLowerCase(), FAMILLE_CSS.toLowerCase()];
  for (const brut of polices) {
    const noms = String(brut ?? "").split(",").map(nomPolice).filter((n) => n.length > 0);
    const premiere = (noms[0] ?? "").toLowerCase();
    const bon = noms.length > 0 && marque.includes(premiere) && noms.slice(1).every((n) => marque.includes(n.toLowerCase()) || REPLIS_PERMIS.includes(n.toLowerCase()));
    if (!bon) refus.push({ valeur: String(brut), motif: "hors charte" });
  }
  return refus;
}

function controleCharte(id: ResultatCharte["id"], libelle: string, rendus: readonly string[] | undefined, refus: (v: readonly string[]) => ElementHorsCharte[], ok: string): ResultatCharte {
  if (!rendus) return { id, libelle, bloquant: true, etat: "non-fait", raison: `${libelle} : rien n'a été relevé sur la vidéo.`, details: [] };
  const mauvais = refus(rendus);
  if (mauvais.length === 0) return { id, libelle, bloquant: true, etat: "reussi", raison: ok, details: [] };
  const details = mauvais.map((m) => (m.motif === "hors charte" ? `« ${m.valeur} » n'est pas dans la charte.` : `« ${m.valeur} » est ${m.motif === "bleu" ? "un bleu" : "un jaune"} : la charte n'en veut pas.`));
  return { id, libelle, bloquant: true, etat: "echoue", raison: `${details.length} défaut${details.length > 1 ? "s" : ""} de charte.`, details };
}

export interface EntreeVideoFinie {
  mesures?: MesuresExport;
  miseEnPage?: MiseEnPage;
  ratio: Ratio;
  reseaux: IdReseau[];
  /** Couleurs réellement rendues ; absentes : « non fait ». */
  couleursRendues?: string[];
  /** Polices réellement rendues ; absentes : « non fait ». */
  policesRendues?: string[];
}

export interface VerdictVideoFinie {
  image: RapportControleImage;
  charte: ResultatCharte[];
  /** Vrai seulement si aucun contrôle bloquant n'a échoué ET aucun contrôle bloquant n'est resté « non fait ». */
  livrable: boolean;
}

export function controlerVideoFinie(e: EntreeVideoFinie): VerdictVideoFinie {
  const image = controlerImageFinale({ mesures: e.mesures, miseEnPage: e.miseEnPage, zone: zoneSureDe(e.ratio, e.reseaux) });
  const charte = [
    controleCharte("couleurs", "Couleurs de la charte", e.couleursRendues, couleursHorsCharte, "Toutes les couleurs rendues sont dans la charte."),
    controleCharte("polices", "Police de la charte", e.policesRendues, policesHorsCharte, "Seule la police de la charte est rendue."),
  ];
  const tous: { bloquant: boolean; etat: EtatControle }[] = [...image.controles, ...charte];
  const livrable = !tous.some((c) => c.bloquant && c.etat !== "reussi");
  return { image, charte, livrable };
}
