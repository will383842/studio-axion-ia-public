// LISTE UNIQUE des versions du 1er message (avec lien) que le SITE accepte déjà dans le jeton (`version_m1`).
// Une formulation absente de cette liste part SANS lien (message sans lien + alerte cloche), jamais avec un jeton que le site ne connaît pas.
//
// POUR METTRE À JOUR : quand la PR du site qui ajoute des versions est DÉPLOYÉE, déplacer la version de
// VERSIONS_M1_EN_ATTENTE_DU_SITE vers VERSIONS_M1_ACCEPTEES_PAR_LE_SITE, PUIS (trois gestes) :
//   1. déplacer la version dans ce fichier ;
//   2. l'ajouter à `tests/zernio/aides/versions-m1-jeton-site.ts` avec le nouveau commit du site ;
//   3. retirer l'exigence « v4 absentes de la copie du site » de `tests/zernio/formulations-multiples.test.ts` (elle rougit sinon, voulu).
// Le test `tests/zernio/formulations-multiples.test.ts` (« 1 bis ») rougit si une formulation du groupe « m1-lien » n'est dans aucune des deux listes.

/** Versions que le site connaît aujourd'hui. */
export const VERSIONS_M1_ACCEPTEES_PAR_LE_SITE: readonly string[] = ["mp-m1-v3"];

/** Formulations du groupe « m1-lien » pas encore connues du site : elles ne partent pas avec un lien. */
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
