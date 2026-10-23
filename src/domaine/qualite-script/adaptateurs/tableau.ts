/**
 * SOCLE QUALITÉ · adaptateur TABLEAU ANIMÉ. PUR.
 * Le script du générateur passe par `lignesDuScriptTableau` (les lignes de « Relire le script ») ; le groupe de
 * chaque ligne (« Accroche », « Douleur », « Solution », « Étape n », « Exemple », « À retenir », « Appel ») donne sa
 * partie. Un texte écrit à la main (sans groupes) prend les parties par défaut.
 */
import type { LigneScript } from "@/domaine/relecture-script";
import { lignesDuScriptTableau } from "@/domaine/relecture-tableau";
import { LIBELLES_PARTIES, type ScriptTableau } from "@/domaine/scripts-tableau";
import type { ReseauDeclinaison } from "@/domaine/types";
import type { Partie, ScriptNormalise } from "../types";
import { depuisLignes } from "./commun";

const PARTIE_DU_GROUPE: Readonly<Record<string, Partie>> = {
  [LIBELLES_PARTIES.accroche]: "accroche",
  [LIBELLES_PARTIES.douleur]: "douleur",
  [LIBELLES_PARTIES.solution]: "promesse",
  [LIBELLES_PARTIES.exemple]: "exemple",
  [LIBELLES_PARTIES["a-retenir"]]: "a-retenir",
  [LIBELLES_PARTIES.appel]: "appel",
};

export function partieDuGroupeTableau(groupe: string | undefined): Partie | null {
  if (!groupe) return null;
  if (groupe.startsWith(LIBELLES_PARTIES.etape)) return "corps";
  return PARTIE_DU_GROUPE[groupe] ?? null;
}

export function depuisLignesTableau(lignes: readonly LigneScript[], plus: { reseau?: ReseauDeclinaison; dureeViseeSec?: number } = {}): ScriptNormalise {
  return depuisLignes(lignes, (l) => partieDuGroupeTableau(l.groupe), plus);
}

export function depuisScriptTableau(script: ScriptTableau, plus: { reseau?: ReseauDeclinaison; dureeViseeSec?: number } = {}): ScriptNormalise {
  return depuisLignesTableau(lignesDuScriptTableau(script), plus);
}
