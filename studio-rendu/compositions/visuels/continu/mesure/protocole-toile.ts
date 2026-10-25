/** Protocole de mesure de la toile : la ligne `AXION-MESURE <nonce> {…}` de `../../mesure/protocole` avec TOUTES les clés de la toile. PUR. */
import { extraireMesure, type MesuresPage } from "../../mesure/protocole";

/** Identifiant de la composition de mesure de la toile (module pur : importable par l'opération sans charger les polices). */
export const ID_COMPOSITION_TOILE = "ToileContinueMesuree";

export const CLES_MESURE_TOILE = [
  "debordements",
  "taillePoliceMin",
  "textes",
  "textesSurCouture",
  "textesHorsMarge",
  "textesCoinReserve",
  "intrusionsMetaP1",
  "chevauchements",
  "debordCouture1",
  "traitsFinsSurCouture",
  "pages",
  "largeur",
  "hauteur",
] as const;

export type MesuresToile = Record<(typeof CLES_MESURE_TOILE)[number], number>;

/** Mesures de la première ligne au bon nonce qui porte chaque clé de la toile, ou `null` (mesure absente = échec). */
export function extraireMesureToile(lignes: readonly string[], nonce: string): MesuresToile | null {
  const complete = (m: MesuresPage) => CLES_MESURE_TOILE.every((c) => typeof m[c] === "number");
  for (let i = 0; i < lignes.length; i++) {
    const m = extraireMesure([lignes[i]], nonce);
    if (m && complete(m)) return m as MesuresToile;
  }
  return null;
}
