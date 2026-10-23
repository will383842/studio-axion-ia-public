/** Vrai si la fiche vidéo porte un onglet de cette valeur (les boutons qui y mènent ne s'affichent que dans ce cas). */
export function aOnglet(onglets: readonly { valeur: string }[], valeur: string): boolean {
  return onglets.some((o) => o.valeur === valeur);
}
