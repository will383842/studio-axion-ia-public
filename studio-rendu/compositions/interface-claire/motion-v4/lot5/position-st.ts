/**
 * Position des sous-titres du lot 5, calculée À CHAQUE IMAGE depuis la descente RÉELLE de la prise (jamais depuis la cible) :
 * yST(f) = 0,66 + D(f). Le groupe ne peut donc pas se poser sur les yeux de Will [0,27 + D ; 0,36 + D] H, pendant la descente comme à la remontée.
 * Module pur (aucune balise) : partagé par le harnais de rendu et par `controle-lot5.ts` (assertion image par image).
 */
import { descenteA } from "./commun-lot5";
import { placerDansZoneSure } from "../communs/zone-sure-v4";
import { decalagePrise } from "./PanneauFin";
import { DUREE_DALLE_CLAQUEE } from "./DalleClaquee";
import type { Bloc, Plan } from "./plan-lot5";

export const finBloc = (b: Bloc): number => {
  switch (b.t) {
    case "etq": return b.fin;
    case "dalle": return b.debut + DUREE_DALLE_CLAQUEE;
    case "fin": return 1e9;
    default: return b.debut + b.duree;
  }
};

/** Descente réelle de la prise (fraction de H) à l'image `f` : ressort de descente + poussée du panneau de fin. */
export const dReel = (f: number, plan: Plan): number => {
  const fin = plan.blocs.find((b) => b.t === "fin");
  return descenteA(f, plan.D) + (fin ? decalagePrise(f, fin.debut) : 0);
};

/** Centre vertical (fraction de H) du groupe de sous-titres, ou `null` (masqués : dalle, rafale, panneau de fin). */
export function positionSousTitres(plan: Plan, f: number): number | null {
  const actif = plan.blocs.find((b) => f >= b.debut && f < finBloc(b));
  if (actif && (actif.t === "dalle" || actif.t === "rafale" || actif.t === "fin")) return null;
  if (actif && actif.t === "duel") return placerDansZoneSure(0.76, 0); // sur les vidéos plein cadre : le visage n'est pas visible
  const d = dReel(f, plan);
  return placerDansZoneSure(0.66 + d, d);
}

/** Demi-hauteur du groupe (plaque de 1,24 × 84 px + contour) et zone des yeux, en fraction de H. */
export const DEMI_HAUTEUR_ST = 0.034;
export const ZONE_YEUX: [number, number] = [0.27, 0.36];

/** Mots affichés par les étiquettes posées à l'image `f` (pour ne jamais doubler un sous-titre avec une étiquette). */
export function libellesVisibles(plan: Plan, f: number): string[] {
  const r: string[] = [];
  for (const b of plan.blocs) {
    if (f < b.debut || f >= finBloc(b)) continue;
    const i = f - b.debut;
    switch (b.t) {
      case "etq": r.push(b.texte); break;
      case "barre": if (b.variante === "etiquette") { b.textes.forEach((t, k) => { if (i >= b.iApp[k]) r.push(t); }); if (b.resultat && i >= b.resultat.i) r.push(b.resultat.texte); } break;
      case "mot": r.push(b.mot); break;
      case "appel": r.push(`COMMENTEZ ${b.motCle}`); b.lignes.forEach((l, k) => { if (i >= b.iLignes[k]) r.push(l); }); break;
      case "duel": r.push(b.motA); if (i >= b.iMotB) r.push(b.motB); break;
    }
  }
  return r;
}
const jetons = (t: string) => t.toUpperCase().split(/[^A-ZÀ-Ü0-9]+/).filter((x) => x.length >= 3 || /^\d+$/.test(x));
/** Vrai si un mot du groupe est déjà affiché par une étiquette posée : le groupe est alors masqué. */
export const groupeDouble = (plan: Plan, f: number, motsGroupe: string[]): boolean => {
  const posés = new Set(libellesVisibles(plan, f).flatMap(jetons));
  return motsGroupe.flatMap(jetons).some((j) => posés.has(j));
};
