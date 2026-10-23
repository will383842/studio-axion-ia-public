/**
 * Apparition des cartes du schéma (lot APP-MAT, axe 6) : lecture de la variété et calendrier de chaque variante (PUR,
 * sans React). Sans variété, ou en APP-A : `null`, et `Toile`/`Noeud` gardent leur rendu de référence (surgit avec
 * rebond). Les données viennent du moteur (`src/moteurs/montage-image-video/variete/axes/apparition.ts`, recopiées ici :
 * une composition n'importe jamais `src/moteurs/**`).
 */
import type { CodesParAxe } from "../../../../../src/briques/schema-motion/variete";
import type { VarieteScene } from "../ContexteVariete";

export type CodeApparition = Exclude<CodesParAxe["apparition"], "APP-A">;

export interface ApparitionIV {
  code: CodeApparition;
  /** APP-C : nœuds montrés éteints dès le début (tout le schéma sauf les « vus ») ; chacun s'allume à son mot. */
  fantomes: ReadonlySet<string>;
  /** APP-C : nœuds montrés « vus » dès le début (posés dans une séquence précédente). */
  vus: ReadonlySet<string>;
}

/** Couleur d'une carte éteinte (maquette validée APP-C v3 / APP-D : beige pâle opaque, entre ivoire et gris clair). */
export const BEIGE_ETEINT = "#E2D7C9";

/** Calendrier (secondes depuis le début de l'apparition, qui précède le mot de `TEMPS_IV.avanceNoeud`). */
export const TEMPS_APPARITION = Object.freeze({
  /**
   * APP-B : le contour se trace, le blanc se pose, puis le texte ; le feutre s'en va. Tout est posé 0,30 s après le début de
   * l'apparition (plancher de la relecture des images : dernier mot + 0,3 s ; 23/10/2026, v-6e4a06b9c718 à 22,4 s : « 4 sec »
   * encore sous le feutre, blanc à 68 %, texte à 26 %). Même ordre, mêmes formes, seulement plus vite.
   */
  feutre: Object.freeze({ contour: 0.28, blancDebut: 0.04, blanc: 0.16, texteDebut: 0.16, texte: 0.1, sortieDebut: 0.21, sortie: 0.08 }),
  /** APP-C : la carte éteinte s'allume. */
  allumage: 0.3,
  /** APP-D : la fiche tombe, touche la table, rebondit à peine. */
  chute: Object.freeze({ duree: 0.42, hauteur: 340, inclinaison: 7, rebond: 0.18 }),
});

function c01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function progresDe(ecoule: number, debut: number, duree: number) {
  return c01((ecoule - debut) / duree);
}

/** L'apparition de la scène (`null` : référence APP-A). */
export function apparitionDe(v: VarieteScene | null): ApparitionIV | null {
  if (!v) return null;
  const d = v.donnees.apparition as { code?: string; fantomes?: string[]; vus?: string[] } | undefined;
  const code = (d?.code ?? v.recette.apparition) as CodesParAxe["apparition"];
  if (code !== "APP-B" && code !== "APP-C" && code !== "APP-D") return null;
  return { code, fantomes: new Set(d?.fantomes ?? []), vus: new Set(d?.vus ?? []) };
}

/** Petit nombre entier tiré d'un identifiant (déterministe, aucun hasard). */
export function graineDe(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 2147483646 + 1;
}

/** APP-D : inclinaison de la fiche une fois posée (± 1,2°, alternée par nœud). */
export function inclinaisonRepos(id: string): number {
  return graineDe(id) % 2 ? 1.2 : -1.2;
}

/** APP-D : position de la fiche qui tombe (décalage vertical, inclinaison, ombre au sol). */
export function chuteFiche(id: string, ecoule: number) {
  const C = TEMPS_APPARITION.chute;
  const p = progresDe(ecoule, 0, C.duree);
  const r = progresDe(ecoule, C.duree, C.rebond);
  const repos = inclinaisonRepos(id);
  const sens = repos > 0 ? 1 : -1;
  return {
    y: -C.hauteur * (1 - p) * (1 - p) - 12 * Math.sin(Math.PI * r),
    rotation: repos + sens * C.inclinaison * (1 - p),
    opacite: c01(p * 5),
    /** Ombre au sol : floue et pâle quand la fiche est haute, nette quand elle touche. */
    ombre: { opacite: 0.04 + 0.1 * p, flou: 30 - 18 * p, echelle: 0.8 + 0.2 * p },
  };
}

/** APP-B : où en est le tracé au feutre. */
export function traceFeutre(ecoule: number) {
  const F = TEMPS_APPARITION.feutre;
  return {
    contour: progresDe(ecoule, 0, F.contour),
    blanc: progresDe(ecoule, F.blancDebut, F.blanc),
    texte: progresDe(ecoule, F.texteDebut, F.texte),
    feutre: 1 - progresDe(ecoule, F.sortieDebut, F.sortie),
  };
}
