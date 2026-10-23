/**
 * CONTRÔLES PAR CODE du générateur (plan v5 B.7, lot G3). PUR : importable côté client.
 *
 * `controlerVersion` applique, sur le texte ASSEMBLÉ d'une version (ouverture + corps + fin) et sur ses couches
 * (encadré, incrustations, publication, téléprompteur, trame), tous les contrôles de B.7.2 qui portent sur une version.
 * Les contrôles de série (C43-C53, C66), du plan (C62, C71), du lot d'accroches (C47, C69) et la couverture d'une
 * structure (C67) ont leurs propres fonctions, appelées par le choix conjoint et par les étapes de la chaîne.
 * Aucun format, aucun réseau, aucun bloc n'est nommé ici : tout arrive en données.
 */
import { horsRecetteCommune } from "@/donnees/generateur/recette-script";
import type { ResultatControles } from "@/domaine/types";
import { analyser, Collecte, type Analyse } from "./analyse";
import { c1, c1bis, c1ter, c2, c10bisC75, c15, c16bis, c17, c18c19, c31, c32, c50c51c65, c54aC60, c68, c76 } from "./preuves";
import { c13, c14, c34, c35, c36, c41, c48, c64, c70, c72 } from "./publication";
import { c10, c11, c12, c20, c21, c22, c23c26, c28c29, c3, c30, c33, c38, c39, c45bis, c46, c6, c63, c7, c73c74, c8 } from "./structure";
import { c77, c78, c79, c81, c82, c83, c94 } from "./probleme";
import { c95 } from "./positionnement";
import { c96, c97, c98, c99 } from "./recette";
import { c89a91, c92, c93 } from "./retention";
import { c16, c24c25, c27, c37, c3bis, c4, c40, c42, c5, c5bis, c9 } from "./style";
import type { EntreeControle, ViolationControle } from "./types";

export * from "./types";
export { analyser } from "./analyse";
export { horodaterSegments, dureeTexte, dureeBlocs, MARGE_AVANT_MESURE } from "./horloge";
export { NIVEAUX, GARDE_FOUS } from "./niveaux";
export { controlesDeStyle, compterTournures, mesuresRythme, questionsReponsesASoi, formesAdresse, SEUIL_ECART_TYPE_RYTHME } from "./style";
export { controlerLotAccroches, controlerFinalistes, accrochePermise, MOTIF_ANOMALIE } from "./publication";
export { citeeMotPourMot, termesConcordants, termesVaguesDe, texteSuspect, utilisable } from "./preuves";
export { controlerPlan } from "./plan";
export { couvrirStructure, candidatsSource, libelleManque, CORPS_MIN_ESTIME_SEC, type Couverture, type StockMatiere } from "./couverture";
export { anonymiser } from "./anonymisation";
export { termesDivergents, LEXIQUE_ROLES } from "./termes";
export { finSurLeFait } from "./structure";
export * from "./diversite";
export { problemeAbstrait, c80SerieDouleur, tempsDuRecit, raconteUnClient } from "./probleme";
export * from "./serie";
export { noterVersion, voyant, LEVIERS } from "./note";
export { bandeMots } from "./retention";

/** Version des contrôles (enregistrée sur `ResultatControles.versionControles`). */
export const VERSION_CONTROLES = 1;

type Controle = (e: EntreeControle, a: Analyse, col: Collecte) => void;

/** Tous les contrôles d'une version, dans l'ordre de B.7.2. */
export const CONTROLES_VERSION: readonly Controle[] = [
  c1, c1bis, c1ter, c2, c3, c3bis, c4, c5, c5bis, c6, c7, c8, c9, c10, c10bisC75, c11, c12, c13, c14, c15, c16, c16bis, c17, c18c19, c20, c21, c22, c23c26, c24c25, c27,
  c28c29, c30, c31, c32, c33, c34, c35, c36, c37, c38, c39, c40, c41, c42, c45bis, c46, c48, c50c51c65, c54aC60, c63, c64, c68, c70, c72, c73c74, c76, c77, c78, c79, c81, c82, c83, c89a91, c92, c93, c94, c95, c96, c97, c98, c99,
];

/**
 * Les contrôles du lot A (positionnement C95, recette C96 à C99) : ils ne s'appliquent pas aux formats hors recette commune
 * (`FORMATS_HORS_RECETTE_COMMUNE`, l'avocat) : sans objet, aucune violation, quel que soit l'auteur. Les contrôles eux-mêmes
 * ne changent pas : seule leur application.
 */
const CONTROLES_RECETTE_COMMUNE: ReadonlySet<Controle> = new Set([c95, c96, c97, c98, c99]);

export type ResultatVersion = Omit<ResultatControles, "violations"> & { violations: ViolationControle[] };

export function controlerVersion(e: EntreeControle, options: { seuilRythme?: number } = {}): ResultatVersion {
  const a = analyser(e);
  const col = new Collecte(e);
  const horsRecette = horsRecetteCommune(e.maitre?.brief.formatId);
  for (const c of CONTROLES_VERSION) {
    if (horsRecette && CONTROLES_RECETTE_COMMUNE.has(c)) continue;
    if (c === c9) c9(e, a, col, options.seuilRythme);
    else c(e, a, col);
  }
  const violations = dedoublonner(col.violations);
  return { passe: !violations.some((v) => v.bloquant), violations, versionControles: VERSION_CONTROLES, le: e.maintenant };
}

/** Contrôles relancés sur l'horodatage RÉEL d'une vidéo fabriquée (G6, B.7.1). */
export const CONTROLES_HORODATAGE_REEL = ["C6", "C7", "C10", "C11", "C26"] as const;

/**
 * G6 : C6, C7, C10, C11 et C26 relancés sur l'horodatage réel (`horodatageReel`, un par segment assemblé). Les autres
 * contrôles ne dépendent pas du temps : ils ne sont pas refaits. Aucune marge de 10 % (le temps est mesuré).
 */
export function recontrolerSurHorodatageReel(e: EntreeControle, horodatageReel: NonNullable<EntreeControle["horodatageReel"]>): ResultatVersion {
  const entree: EntreeControle = { ...e, horodatageReel, debitMesure: true };
  const a = analyser(entree);
  const col = new Collecte(entree);
  for (const c of [c6, c7, c10, c11, c23c26]) c(entree, a, col);
  const violations = dedoublonner(col.violations).filter((v) => (CONTROLES_HORODATAGE_REEL as readonly string[]).includes(v.controle));
  return { passe: !violations.some((v) => v.bloquant), violations, versionControles: VERSION_CONTROLES, le: e.maintenant };
}

function dedoublonner(vs: ViolationControle[]): ViolationControle[] {
  const vus = new Set<string>();
  return vs.filter((v) => {
    const k = `${v.controle}|${v.message}|${v.segmentIndex ?? ""}`;
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });
}

/** Codes levés par un résultat (utile aux tests et au rapport de banc, n° 97). */
export function codesLeves(r: { violations: ViolationControle[] }, niveaux: ViolationControle["niveau"][] = ["bloquant", "alerte", "correction", "info"]): string[] {
  return [...new Set(r.violations.filter((v) => niveaux.includes(v.niveau)).map((v) => v.controle))].sort();
}
