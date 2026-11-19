/**
 * Marqueur « rien de choisi » d'un créneau : le compte n'est pas fixé à la programmation, il est résolu au moment de l'envoi
 * contre la liste vivante du diffuseur (règles de `ciblesZernioPour`). Pur, importable des deux côtés.
 */
export const COMPTE_PAR_DEFAUT = "compte-studio";

export function estCompteParDefaut(valeur: unknown): boolean {
  return valeur === COMPTE_PAR_DEFAUT;
}
