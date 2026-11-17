/**
 * ENTRÉES DU MONTAGE « DONNÉES » (G4-09a) : ce que la création range dans `commande.entrees.montageDonnees`.
 *  - `donnee` : un tableau de bord `tableau-de-bord.v1` (schéma strict de G4-01), relu et validé ici ;
 *  - `ratio` : format demandé (4:5 par défaut) ;
 *  - `muette` : seul `true` exact demande la variante muette (plan sous-titré seul, 0 €).
 * Pur : aucun accès disque ou réseau. Rien ne l'importe en production (G4-09b inscrira le moteur).
 */
import { lireTableauDeBord, type TableauDeBord } from "../../briques/donnees-video/types";

export const ENTREE_DONNEES = "montageDonnees";

export type RatioDonnees = "9:16" | "1:1" | "4:5" | "16:9";
export const RATIO_DEFAUT_DONNEES: RatioDonnees = "4:5";
const RATIOS: readonly RatioDonnees[] = ["9:16", "1:1", "4:5", "16:9"];

export interface EntreesDonnees {
  donnee: TableauDeBord;
  ratio: RatioDonnees;
  muette: boolean;
}

export type LectureEntreesDonnees = { ok: true; entrees: EntreesDonnees } | { ok: false; erreurs: string[] };

export function lireEntreesDonnees(entrees: Record<string, unknown> | undefined): LectureEntreesDonnees {
  const e = entrees?.[ENTREE_DONNEES];
  if (!e || typeof e !== "object" || Array.isArray(e)) return { ok: false, erreurs: ["Entrée absente : aucune donnée de tableau de bord à mettre en vidéo."] };
  const o = e as Record<string, unknown>;
  const erreurs: string[] = [];
  if (o.ratio !== undefined && !RATIOS.includes(o.ratio as RatioDonnees)) erreurs.push(`Format refusé : « ${String(o.ratio)} » (attendu : ${RATIOS.join(", ")}).`);
  const lecture = lireTableauDeBord(o.donnee);
  if (!lecture.ok) erreurs.push(...lecture.erreurs);
  if (erreurs.length > 0 || !lecture.ok) return { ok: false, erreurs };
  return { ok: true, entrees: { donnee: lecture.donnee, ratio: (o.ratio as RatioDonnees | undefined) ?? RATIO_DEFAUT_DONNEES, muette: o.muette === true } };
}
