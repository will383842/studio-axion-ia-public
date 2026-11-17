/**
 * Nom du modèle de texte utilisé par les rôles « juge » (aucun montant ici : les tarifs restent dans
 * `src/fournisseurs/claude/tarifs.ts`, qui réexporte cette valeur). Module neutre, hors `src/fournisseurs`, pour que
 * le plan éditorial n'importe aucun fournisseur. Source de vérité unique.
 */
export const MODELE_JUGE = "claude-sonnet-5-5";
