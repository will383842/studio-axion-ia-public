/**
 * Catalogue des capacités : lignes du chantier G2-02 (identifiants de capacité génériques).
 * Les identifiants par format restent : ils sont des **alias lus**, jamais retirés ni renommés.
 * Rien ne lit ces génériques avant la façade G2-03.
 */
import type { IdCapacite } from "../types";
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

const ligne = (id: IdCapacite): LigneCatalogue =>
  Object.freeze({ id, etat: "prevu", chantier: "E2 (G2-02, G2-03)", note: "générique : lit ses alias par format" });

export const LIGNES_GENERIQUES: readonly LigneCatalogue[] = Object.freeze(
  [ID.texteSousTitres, ID.planScenesGenerique, ID.sonPose, ID.etalonnageLut].map(ligne),
);

/** Générique → alias par format (lus, jamais retirés). */
export const ALIAS_GENERIQUES: Readonly<Record<string, readonly IdCapacite[]>> = Object.freeze({
  [ID.texteSousTitres]: Object.freeze([ID.texteSousTitresV4]),
  [ID.planScenesGenerique]: Object.freeze([ID.planScenesCasConcret, ID.planScenesFacecam, ID.planScenesFacecamAnimee]),
  [ID.sonPose]: Object.freeze([ID.sonBanqueStudio, ID.sonV4]),
  [ID.etalonnageLut]: Object.freeze([
    ID.etalonnageLutClairObscur, ID.etalonnageLutNaturelSelfie, ID.etalonnageLutDoux, ID.etalonnageLutNuit, ID.etalonnageLutNouvelle,
  ]),
});

/** Alias → générique (undefined si l'identifiant n'est l'alias d'aucun générique). Pur. */
export function generiqueDe(id: IdCapacite): IdCapacite | undefined {
  return (Object.keys(ALIAS_GENERIQUES) as IdCapacite[]).find((g) => ALIAS_GENERIQUES[g].includes(id));
}

/** Générique → ses alias (liste vide si ce n'est pas un générique). Pur. */
export function aliasDe(generique: IdCapacite): readonly IdCapacite[] {
  return ALIAS_GENERIQUES[generique] ?? [];
}
