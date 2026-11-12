// Le port d'envoi (zernio-inbox) consomme ce jeton avant tout appel réseau : sans jeton valide et neuf, rien ne part.
// Jeton « vérifié : non opposée » : module PUR, sans horloge, sans réseau, sans contenu.
// Seule `personneOpposeePartout` en émet ; un futur envoi le consomme UNE fois. Un objet forgé n'est jamais accepté.
declare const marque: unique symbol;
export interface JetonNonOpposee {
  readonly [marque]: true;
}

const emis = new WeakSet<object>();

export function emettreJetonNonOpposee(): JetonNonOpposee {
  const j = Object.freeze({}) as JetonNonOpposee;
  emis.add(j);
  return j;
}

/** Vrai UNE seule fois par jeton émis ; faux pour tout autre objet ou valeur. */
export function consommerJetonNonOpposee(j: unknown): boolean {
  if (typeof j !== "object" || j === null) return false;
  return emis.delete(j);
}
