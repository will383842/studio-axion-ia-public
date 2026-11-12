// TODO(S2) : lier le jeton à l'empreinte de la personne et à l'instant ; l'appelant vérifie juste avant l'envoi.
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
