/**
 * SOCLE QUALITÉ · adaptateur ÉCRIRE (avocat, face caméra). PUR.
 * Deux entrées : les blocs d'une version (ouverture, corps, fin ; `blocRecette` donne la partie), ou les lignes du lot
 * relu (`lignesDuLot` : groupes « Début », « Milieu », « Fin »).
 */
import type { LigneScript } from "@/domaine/relecture-script";
import type { BlocScript, ReseauDeclinaison } from "@/domaine/types";
import type { LigneNormalisee, Partie, ScriptNormalise } from "../types";
import { depuisLignes } from "./commun";

/** Partie d'un bloc de la recette Écrire (« accroche », « preuve », « appel »…). */
export function partieDuBloc(blocRecette: string, place: "ouverture" | "corps" | "fin"): Partie {
  const b = blocRecette.toLowerCase();
  if (b.includes("accroche")) return "accroche";
  if (b.includes("promesse")) return "promesse";
  if (b.includes("preuve") || b.includes("resultat")) return "preuve";
  if (b.includes("exemple") || b.includes("cas")) return "exemple";
  if (b.includes("question")) return "question";
  if (b.includes("appel")) return "appel";
  if (b.includes("boucle") || b.includes("fin")) return "fin";
  return place === "ouverture" ? "accroche" : place === "fin" ? "appel" : "corps";
}

export interface VersionEcrire {
  ouverture: BlocScript[];
  corps: BlocScript[];
  fin: BlocScript[];
  /** Texte écrit à l'écran pendant l'ouverture. */
  encadre?: string;
  reseau?: ReseauDeclinaison;
  dureeViseeSec?: number;
}

export function depuisVersionEcrire(v: VersionEcrire): ScriptNormalise {
  const lignes: LigneNormalisee[] = [];
  let premier = true;
  for (const [place, blocs] of [["ouverture", v.ouverture], ["corps", v.corps], ["fin", v.fin]] as const) {
    for (const b of blocs) {
      for (const s of b.segments) {
        const dit = ((s as { texteDit?: string }).texteDit ?? s.texte).trim();
        if (!dit) continue;
        const ecrits = premier && v.encadre?.trim() ? [{ texte: v.encadre, modifiable: true }] : s.titreEcran?.trim() ? [{ texte: s.titreEcran, modifiable: true }] : undefined;
        lignes.push({ id: s.id, dit, partie: partieDuBloc(b.blocRecette, place), ...(ecrits ? { ecrits } : {}), ...(s.preuveIds?.length ? { sourcee: true } : {}) });
        premier = false;
      }
    }
  }
  return { lignes, ...(v.reseau ? { reseau: v.reseau } : {}), ...(v.dureeViseeSec ? { dureeViseeSec: v.dureeViseeSec } : {}) };
}

/** Les lignes d'UNE version relue (groupes « Début », « Milieu… », « Fin »). */
export function depuisLignesEcrire(lignes: readonly LigneScript[], reseau?: ReseauDeclinaison): ScriptNormalise {
  return depuisLignes(lignes, (l) => (l.groupe?.startsWith("Début") ? "accroche" : l.groupe?.startsWith("Fin") ? "appel" : l.groupe?.startsWith("Milieu") ? "corps" : null), reseau ? { reseau } : {});
}
