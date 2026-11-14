// LISTES des versions du 1er message (avec lien) que le SITE accepte dans le jeton (`version_m1`).
// FAIT FOI : `siteAccepteVersionM1`, en bas de ce fichier = union de VERSIONS_M1_ACCEPTEES_PAR_LE_SITE et de VERSIONS_AVEC_LIEN_ACCEPTEES_PAR_LE_SITE.
// Une formulation absente des deux listes part SANS lien (message sans lien + alerte cloche), jamais avec un jeton que le site ne connaît pas.
// Le site en production accepte les versions de VERSIONS_AVEC_LIEN_ACCEPTEES_PAR_LE_SITE (copie de contrôle : tests/zernio/aides/versions-lien-jeton-site.ts).
//
// VERSIONS_M1_ACCEPTEES_PAR_LE_SITE et VERSIONS_M1_EN_ATTENTE_DU_SITE sont GARDÉES TELLES QUELLES uniquement parce qu'un test figé
// (`formulations-multiples`, « 1 bis ») les compare à l'ancienne copie du site : ne pas s'y fier pour savoir ce qui part avec un lien.
// POUR AJOUTER UNE VERSION : l'ajouter à VERSIONS_AVEC_LIEN_ACCEPTEES_PAR_LE_SITE ET à la copie de contrôle du site (le test `versions-lien-site` rougit sinon).

/** Versions que le site connaît aujourd'hui. */
export const VERSIONS_M1_ACCEPTEES_PAR_LE_SITE: readonly string[] = ["mp-m1-v3"];

/** HISTORIQUE (test figé) : ces v4 étaient en attente du site ; elles sont désormais acceptées via VERSIONS_AVEC_LIEN_ACCEPTEES_PAR_LE_SITE. */
export const VERSIONS_M1_EN_ATTENTE_DU_SITE: readonly string[] = ["mp-m1-v4-1", "mp-m1-v4-2", "mp-m1-v4-3", "mp-m1-v4-4"];

/**
 * Formulations VALIDÉES qui portent un lien (`[LIEN]`), au-delà de `mp-m1-v3` : celles des groupes « m1-lien » (premier message),
 * « lien-rappel » (rappel Instagram et renvoi) et « deja-envoye » (renvoi). LISTE FERMÉE, déduite de `contrats/dictionnaire-textes-mp.v2.json`
 * (toute version du dictionnaire qui contient `[LIEN]` dans l'un de ces trois groupes) ; le site les accepte dans le jeton (`version_m1`).
 * `mp-lien-v2`, `mp-pub-linkedin-v1` et `mp-pub-tiktok-v1` portent aussi un lien mais ne sont dans aucun de ces groupes : jamais choisies, donc absentes.
 * Les listes ci-dessus restent telles quelles : un test figé compare la première à la copie des versions du jeton connues du site.
 */
export const VERSIONS_AVEC_LIEN_ACCEPTEES_PAR_LE_SITE: readonly string[] = [
  "mp-m1-v4-1", "mp-m1-v4-2", "mp-m1-v4-3", "mp-m1-v4-4",
  "mp-lien-v3-1", "mp-lien-v3-2", "mp-lien-v3-3",
  "mp-deja-envoye-v1-1", "mp-deja-envoye-v1-2", "mp-deja-envoye-v1-3",
];

export const siteAccepteVersionM1 = (version: string): boolean =>
  VERSIONS_M1_ACCEPTEES_PAR_LE_SITE.includes(version) || VERSIONS_AVEC_LIEN_ACCEPTEES_PAR_LE_SITE.includes(version);
