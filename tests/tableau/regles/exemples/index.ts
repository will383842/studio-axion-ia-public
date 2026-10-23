/**
 * FICHES D'EXEMPLE du tableau animé (TB-01) : une fiche complète et valide par structure, avec le contexte qui les
 * valide (script, sources, preuves et matières fictives). Servent aux tâches suivantes (calage, mise en page, rendu).
 */
import type { FicheTableau, StructureTableau } from "../../../../src/moteurs/montage-tableau/fiche";
import type { ContexteTableau } from "../../../../src/moteurs/montage-tableau/regles";
import { ficheAvantApres } from "./avant-apres";
import { ficheDemonstration } from "./demonstration";
import { ficheErreurCorrigee } from "./erreur-corrigee";
import { ficheErreurCorrigeeClair } from "./erreur-corrigee-clair";
import { ficheErreurCorrigeeParties } from "./erreur-corrigee-parties";
import { ficheQuestionAbonne } from "./question-abonne";

export { ficheAvantApres, ficheDemonstration, ficheErreurCorrigee, ficheErreurCorrigeeClair, ficheErreurCorrigeeParties, ficheQuestionAbonne };

/**
 * Doubles du découpage : la fiche rendue au style demandé par `<fiche_fixe>`. Depuis le 14/10/2026, le style des
 * nouvelles fiches est « reference/2 » (gabarit de page clair), puis « reference/3 » (gabarit par parties) : « L'erreur
 * corrigée » y est rendue avec son gabarit (même texte dit). Les autres styles gardent la fiche telle quelle.
 */
export function auStyleDemande(f: FicheTableau): FicheTableau {
  if (texteScriptDe(f) !== texteScriptDe(ficheErreurCorrigee)) return f;
  if (f.habillage === "reference/2") f.scenes = structuredClone(ficheErreurCorrigeeClair.scenes);
  if (f.habillage === "reference/3") f.scenes = structuredClone(ficheErreurCorrigeeParties.scenes);
  return f;
}

export const EXEMPLES: Readonly<Record<StructureTableau, FicheTableau>> = {
  "erreur-corrigee": ficheErreurCorrigee,
  "avant-apres": ficheAvantApres,
  demonstration: ficheDemonstration,
  "question-abonne": ficheQuestionAbonne,
};

/** Date du jour des exemples. */
export const AUJOURDHUI_EXEMPLES = "2026-10-11";

/** Texte validé du script dont la fiche est tirée (les `texteDit` mis bout à bout). */
export const texteScriptDe = (fiche: FicheTableau) => fiche.scenes.map((s) => s.texteDit).join(" ");

/** Contexte qui valide les exemples ; `extra` remplace une partie (pour les cas refusés). */
export function contexteExemple(fiche: FicheTableau, extra: Partial<ContexteTableau> = {}): ContexteTableau {
  return {
    texteScript: texteScriptDe(fiche),
    aujourdhui: AUJOURDHUI_EXEMPLES,
    sourcesChiffres: ["source-delai-relance"],
    preuves: [{ id: "preuve-compte-rendu", statut: "validee", perimeLe: "2027-01-09" }],
    matieres: [
      { id: "matiere-demo-questions", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" },
      { id: "matiere-demo-idees", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" },
      { id: "matiere-demo-relance", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" },
    ],
    ...extra,
  };
}

/** Copie profonde modifiable d'une fiche (pour fabriquer un cas refusé sans toucher l'exemple). */
export const copie = (fiche: FicheTableau): FicheTableau => structuredClone(fiche);
