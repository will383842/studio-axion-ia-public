// COPIE des versions à lien que le SITE accepte dans le jeton (`version_m1`), d'après la relecture du dépôt du site (axion-ia),
// `src/server/guides-reseau/valeurs-connues.ts` (`VERSIONS_TEXTE_CONNUES`), commit en production ffd5ad75. Le site accepte aussi mp-m1-v5-1..4 (sans lien, non listées ici).
// À re-synchroniser quand le site change. Utilisée pour vérifier, de façon NON circulaire, la liste du Studio `VERSIONS_AVEC_LIEN_ACCEPTEES_PAR_LE_SITE`.
export const VERSIONS_LIEN_JETON_SITE: readonly string[] = [
  "mp-m1-v4-1", "mp-m1-v4-2", "mp-m1-v4-3", "mp-m1-v4-4",
  "mp-lien-v3-1", "mp-lien-v3-2", "mp-lien-v3-3",
  "mp-deja-envoye-v1-1", "mp-deja-envoye-v1-2", "mp-deja-envoye-v1-3",
];
