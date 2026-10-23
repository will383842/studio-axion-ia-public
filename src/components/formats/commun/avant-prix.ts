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
