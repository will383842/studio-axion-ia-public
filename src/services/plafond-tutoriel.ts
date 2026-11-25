/**
 * TUTO-PLAFOND-1E (décision du pilote du 21/11 07:20, sur le « oui » de Williams du 21/11 00:05) : Claude du tutoriel
 * d'outil, au plus 1 € par tutoriel. Le réglage est en dollars : 1 € = 1 / 0,90 $ (taux du Studio) → 1,11 $ (0,999 €).
 * Au-delà, la garde d'argent refuse AVANT l'envoi pour une commande de l'Usine (rien n'est payé) ; pour une commande du
 * Studio, le budget « indicatif » signale sans arrêter, comme pour tous les plafonds par vidéo.
 * Montant hors de `tutoriel-claude.ts` (garde `claude-relie.test.ts` : aucun décimal autre que le pas de 0,05 $).
 */
export const PLAFOND_TUTORIEL_USD = 1.11;
