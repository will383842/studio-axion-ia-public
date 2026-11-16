/**
 * Cas concret : code local → valeur commune. Codes importés de `montage-cas-concret/variete.ts` (lecture seule) ; le type
 * `Record<…>` + `satisfies` fait rougir tsc si un code est ajouté sans ligne ici. Une ligne par code.
 */
import { OUVERTURES, STRUCTURES, JEUX_ANIMATION, TRANSITIONS, STYLES_CAMERA } from "@/moteurs/montage-cas-concret/variete";
import type { AxeCommun } from "../types";

const ouverture = {
  "affiche-v4": "affiche",
  "chiffre-choc": "chiffre-geant",
  "question-plein-cadre": "question",
  "avant-apres-eclair": "avant-apres",
  "objet-zoom-arriere": "objet-zoom",
  "titre-geant-gauche": "titre-geant",
  "phrase-deux-temps": "phrase-deux-temps",
  "compteur-emballe": "chiffre-geant", // un compteur qui monte = un chiffre géant à l'écran
} as const satisfies Record<(typeof OUVERTURES)[number], string>;

const recit = {
  "v4-avant-etapes-resultat": "ordre-chronologique", // la v4 raconte dans l'ordre
  "resultat-d-abord": "resultat-d-abord",
  "probleme-solution": "probleme-solution",
  "une-journee": "une-journee",
} as const satisfies Record<(typeof STRUCTURES)[number], string>;

/** Jeu d'animation : pas d'axe commun propre ; rangé dans le dosage (la v4 = sobre), le reste n'a pas d'équivalent. */
const dosage = {
  v4: "sobre",
  glissement: "autre:cas-concret:glissement",
  volet: "autre:cas-concret:volet",
  zoom: "autre:cas-concret:zoom",
  rideau: "autre:cas-concret:rideau",
} as const satisfies Record<(typeof JEUX_ANIMATION)[number], string>;

const transitions = {
  "volet-terracotta": "volet",
  poussee: "poussee",
  "raccord-objet": "raccord-objet",
  eclair: "eclair",
} as const satisfies Record<(typeof TRANSITIONS)[number], string>;

const camera = {
  "aucune-v4": "aucune",
  douce: "douce",
  rythmee: "rythmee",
  revelation: "revelation",
} as const satisfies Record<(typeof STYLES_CAMERA)[number], string>;

export const TABLE_CAS_CONCRET: Readonly<Partial<Record<AxeCommun, Readonly<Record<string, string>>>>> = Object.freeze({
  ouverture, recit, dosage, transitions, camera,
});
