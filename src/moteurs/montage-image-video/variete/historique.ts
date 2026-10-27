/**
 * Historique des recettes (lot TIR, doc 72 § 5, PUR) : l'historique est une liste REÇUE en paramètre, de la vidéo IV la
 * PLUS RÉCENTE à la plus ancienne (le lot F la lit dans les travaux prêts). Une recette est acceptée si :
 *  1. son ouverture n'est celle d'aucune des 3 dernières vidéos ;
 *  2. sa combinaison ouverture + récit + caméra n'est celle d'aucune des 10 dernières ;
 *  3. sa ressemblance (poids du doc 72 § 6.1) est sous 60 % avec chacune des 10 dernières.
 * Si rien ne passe, `meilleurRepliIV` prend la moins ressemblante : jamais de blocage.
 */
import { REFERENCES, type AxeVariete, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { ressemblanceRecette, SEUIL_RESSEMBLANCE } from "./ressemblance";

export const OUVERTURES_RECENTES = 3;
export const VIDEOS_RECENTES = 10;

/** Règles 1 et 2 (ouverture et combinaison forte) : celles que le repli garde si une candidate les respecte. */
function respecteReglesDuresIV(recette: RecetteVarieteIV, historique: readonly RecetteVarieteIV[]): boolean {
  const dix = historique.slice(0, VIDEOS_RECENTES);
  if (dix.slice(0, OUVERTURES_RECENTES).some((p) => p.ouverture === recette.ouverture)) return false;
  return !dix.some((p) => p.ouverture === recette.ouverture && p.recit === recette.recit && p.camera === recette.camera);
}

export function accepteHistoriqueIV(recette: RecetteVarieteIV, historique: readonly RecetteVarieteIV[]): boolean {
  const dix = historique.slice(0, VIDEOS_RECENTES);
  if (!respecteReglesDuresIV(recette, historique)) return false;
  return dix.every((p) => ressemblanceRecette(recette, p) < SEUIL_RESSEMBLANCE);
}

/** Plus forte ressemblance d'une recette avec les 10 dernières (0 sans historique). */
export function ressemblanceMaxIV(recette: RecetteVarieteIV, historique: readonly RecetteVarieteIV[]): number {
  return historique.slice(0, VIDEOS_RECENTES).reduce((m, p) => Math.max(m, ressemblanceRecette(recette, p)), 0);
}

/** Repli quand aucun candidat n'est accepté : le moins ressemblant (le premier en cas d'égalité), parmi celles qui respectent les règles 1 et 2 s'il y en a. */
export function meilleurRepliIV(tous: readonly RecetteVarieteIV[], historique: readonly RecetteVarieteIV[]): RecetteVarieteIV {
  const durs = tous.filter((c) => respecteReglesDuresIV(c, historique));
  const candidats = durs.length ? durs : tous;
  let meilleur = candidats[0];
  let score = ressemblanceMaxIV(meilleur, historique);
  for (const c of candidats.slice(1)) {
    const s = ressemblanceMaxIV(c, historique);
    if (s < score) {
      meilleur = c;
      score = s;
    }
  }
  return meilleur;
}

/**
 * Recette réellement posée à l'écran d'une vidéo dont certains axes ont été repliés (typographie, fin, chiffres…) : le
 * texte replié donne TYP-C, l'ouverture repliée OUV-D, les autres axes repliés leur référence.
 */
export function recetteEffectiveIV(recette: RecetteVarieteIV, replis: readonly { readonly axe: AxeVariete; readonly code?: string }[] | undefined): RecetteVarieteIV {
  const r: Record<string, string> = { ...recette };
  for (const { axe, code } of replis ?? []) {
    // Un repli de TYP-B ne touche qu'un bloc trop long : les autres restent en TYP-B, la vidéo n'est pas en TYP-C.
    if (axe === "texte" && code === "TYP-B") continue;
    r[axe] = axe === "texte" ? "TYP-C" : axe === "ouverture" ? "OUV-D" : (REFERENCES[axe] as string);
  }
  return r as RecetteVarieteIV;
}
