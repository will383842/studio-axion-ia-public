// COPIE de la liste des `version_m1` que le SITE accepte dans le jeton du lien (au-delà, le site ne retient pas la version).
// Source : dépôt du site (axion-ia), fichier src/server/guides-reseau/valeurs-connues.ts (`VERSIONS_TEXTE_CONNUES`),
// utilisée par src/server/guides-reseau/page-confirmation.ts pour filtrer `version_m1`. Commit du site lu : 848e8ed2080a067cd77c8f6fcbc82d5fcefbfbc2.
// Ce n'est PAS la liste `version_texte` de la demande de guide (contrat-site-guides-reseau.ts). À re-synchroniser quand le site change.
export const VERSIONS_M1_JETON_SITE: readonly string[] = [
  "m1-brouillon-v1",
  "m1-v1",
  "mp-m1-v2",
  "mp-m1-v2-a",
  "mp-m1-v2-b",
  "mp-m1-v2-c",
  "mp-m1-v2-d",
  "mp-m1-v2-e",
  "mp-m1-v3",
];
