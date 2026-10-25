/**
 * Ordre du bouton « Fabriquer » (fonction pure, testée sans navigateur) : le contrôle facultatif passe AVANT la fenêtre de prix.
 * Rend le montant à afficher dans la fenêtre, ou `null` quand elle ne doit pas s'ouvrir (le contrôle a refusé).
 */
export async function montantApresControle(montantCentimes: number, avantPrix?: () => Promise<boolean | { centimes: number }>): Promise<number | null> {
  if (!avantPrix) return montantCentimes;
  const controle = await avantPrix();
  if (controle === false) return null;
  return typeof controle === "object" ? controle.centimes : montantCentimes;
}

/**
 * Règle du 25/10/2026 : plus de clic de confirmation. Envoie le montant connu ; si le serveur répond « accord requis » avec
 * un autre montant (`{ centimes }`), UNE seule relance part avec ce montant, jamais de boucle : la suite est rendue telle quelle.
 */
export async function fabriquerAvecUneRelance(montantCentimes: number, onFabriquer: (accord: number) => Promise<{ centimes: number } | void>): Promise<void> {
  const suite = await onFabriquer(montantCentimes);
  if (suite && typeof suite.centimes === "number") await onFabriquer(suite.centimes);
}
