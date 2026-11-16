/**
 * Vocabulaire commun de la variété (E2-ANTI-REPETITION, fiche X2-02) : pour chaque axe commun, la liste fermée des valeurs
 * que les générateurs savent nommer de la même façon. Une valeur sans équivalent chez les autres s'écrit
 * `autre:<generateur>:<code>`. Module PUR, côté Studio seulement. Aucun appelant, aucune date, aucun hasard.
 */
import type { AxeCommun } from "./types";
import { TABLE_CAS_CONCRET } from "./correspondances/cas-concret";
import { TABLE_IMAGE_VIDEO } from "./correspondances/image-video";
import { TABLE_TABLEAU } from "./correspondances/tableau";
import { TABLE_FACECAM_ANIMEE } from "./correspondances/facecam-animee";
import { TABLE_CARTES } from "./correspondances/cartes";

export const GENERATEURS = ["cas-concret", "image-video", "tableau", "facecam-animee", "cartes"] as const;
export type GenerateurCommun = (typeof GENERATEURS)[number];

/** Valeurs communes, par axe. Un axe absent n'a pas encore de valeur commune (tout y est `autre:`). */
export const VOCABULAIRE: Readonly<Partial<Record<AxeCommun, readonly string[]>>> = Object.freeze({
  ouverture: ["chiffre-geant", "question", "avant-apres", "titre-geant", "visage-direct", "objet-zoom", "affiche", "phrase-deux-temps", "horloge", "detail-puis-recul"],
  palette: ["ivoire-dominant", "noir-dominant", "terracotta-fort", "alterne"],
  typo: ["manrope", "montserrat-v4", "mono-terminal"],
  dosage: ["aucun", "sobre", "equilibre", "dynamique"],
  habillage: ["ivoire-v4", "tableau-blanc", "ardoise", "paperboard", "papier", "trait-main", "profondeur-douce"],
  recit: ["ordre-chronologique", "resultat-d-abord", "probleme-solution", "une-journee", "suivre-un-objet", "etapes-annoncees"],
  transitions: ["coupe", "volet", "poussee", "raccord-objet", "eclair"],
  camera: ["aucune", "douce", "rythmee", "revelation", "suivi", "ensemble-d-abord", "voyage", "deux-cotes"],
  fin: ["phrase-choc", "schema-puis-phrase", "boucle", "chiffre-qui-reste"],
  sousTitres: ["calmes", "equilibres", "appuyes"],
});

/** Valeurs sans effet visible : elles ne comptent jamais comme une ressemblance. */
export const NEUTRES: readonly string[] = Object.freeze(["aucun", "aucune", "coupe", "equilibre", "equilibres", "ordre-chronologique"]);

type Table = Readonly<Partial<Record<AxeCommun, Readonly<Record<string, string>>>>>;
const TABLES: Readonly<Record<GenerateurCommun, Table>> = Object.freeze({
  "cas-concret": TABLE_CAS_CONCRET,
  "image-video": TABLE_IMAGE_VIDEO,
  tableau: TABLE_TABLEAU,
  "facecam-animee": TABLE_FACECAM_ANIMEE,
  cartes: TABLE_CARTES,
});

/** Valeur commune d'un code local ; sans équivalent : `autre:<generateur>:<code>`. */
export function versCommun(generateur: GenerateurCommun, axe: AxeCommun, codeLocal: string): string {
  const v = TABLES[generateur][axe]?.[codeLocal];
  return v ?? `autre:${generateur}:${codeLocal}`;
}

export { TABLES as TABLES_CORRESPONDANCE };
