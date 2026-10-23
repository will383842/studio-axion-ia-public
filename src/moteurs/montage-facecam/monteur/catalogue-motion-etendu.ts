/**
 * CATALOGUE DU MONTEUR — MODÈLES D'ANIMATION 7 À 13 (lot F2, branché par défaut à la mission L après la validation de
 * la planche 7-13 par Will le 09/10). PUR.
 *
 * Il sert trois fois, comme `catalogue.ts` : la règle lue par Claude (quand choisir chaque modèle, convention des
 * textes), les exemples touchables de « Que puis-je demander ? », et le vocabulaire de l'opération `ajouterCarte`
 * (désormais celui de `MODELES_CARTE` / `schemaAjouterCarte` : les noms « étendus » restent pour la compatibilité).
 */
import { CATALOGUE_MOTION_ETENDU, IDS_MODELES_MOTION_ETENDUS } from "@/briques/motion/catalogue-etendu";
import { CONVENTION_TEXTES_ETENDUS } from "@/briques/motion/textes-etendus";
import type { IdModeleMotionEtendu } from "@/briques/motion/types-etendus";
import { MODELES_CARTE, schemaAjouterCarte, type ModeleCarte } from "./operations";

/** Compatibilité lot F2 : les 13 modèles sont désormais ceux de `ModeleCarte`. */
export type ModeleCarteEtendu = ModeleCarte;
/** Les 13 modèles de la brique motion (6 validés + 7 du lot F2) ; tout le reste = carte sur mesure. */
export const MODELES_CARTE_ETENDUS: readonly ModeleCarteEtendu[] = MODELES_CARTE;

/** Compatibilité lot F2 : `ajouterCarte` accepte les 13 modèles par défaut. */
export const schemaAjouterCarteEtendue = schemaAjouterCarte;

/** Une ligne par modèle 7 à 13 : ce que Will voit et ce que Claude lit. */
export interface EntreeModeleEtendu {
  modele: IdModeleMotionEtendu;
  libelle: string;
  /** Quand le choisir + convention des textes (consigne de Claude). */
  regle: string;
  /** Phrase touchable dans « Que puis-je demander ? ». */
  exemple: string;
}

export const MODELES_MONTEUR_ETENDUS: EntreeModeleEtendu[] = IDS_MODELES_MOTION_ETENDUS.map((id) => {
  const f = CATALOGUE_MOTION_ETENDU[id];
  return {
    modele: id,
    libelle: f.nom,
    regle: `${f.quand}${f.automatique ? "" : " JAMAIS tout seul."} Textes : ${CONVENTION_TEXTES_ETENDUS[id]}.`,
    exemple: f.aide,
  };
});

/** Complément de la règle de `ajouterCarte` (bloc de consigne) : les modèles 7 à 13. */
export function regleModelesEtendus(): string {
  return [
    "Modèles 7 à 13 (mêmes styles sobre et spectaculaire, même charte) :",
    ...MODELES_MONTEUR_ETENDUS.map((e) => `  · ${e.modele} (${e.libelle}) : ${e.regle}`),
    "  La capture annotée utilise une image de Mes images ou du B-roll (positions des annotations en fractions de l'image, d'après ce que tu vois). Le titre plein écran n'est posé que si Will le demande. La carte documentaire ne porte jamais de nom de personne ni de bandeau « nom · marque ».",
  ].join("\n");
}

/** Exemples « Que puis-je demander ? » des modèles 7 à 13 (dans l'ordre du plan). */
export function exemplesModelesEtendus(max = MODELES_MONTEUR_ETENDUS.length): string[] {
  return MODELES_MONTEUR_ETENDUS.map((e) => e.exemple).slice(0, max);
}
