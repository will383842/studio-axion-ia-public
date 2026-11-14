/**
 * Forme d'un identifiant de compte cible : une seule source, lue par le chargeur des comptes et par l'action d'ajout.
 * Fichier sans "use server" ni "use client" : il peut être importé des deux côtés.
 */
export const FORME_COMPTE_CIBLE = /^[A-Za-z0-9:_.-]{1,80}$/;

export function compteCibleValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && FORME_COMPTE_CIBLE.test(valeur);
}
