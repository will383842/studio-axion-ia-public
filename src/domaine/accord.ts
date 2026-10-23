/**
 * Accord de Will sur un prix (relecture paquet 4, exactitude D2). L'écran renvoie le MONTANT qu'il a montré et que Will a
 * confirmé (centimes d'euro) : le serveur refuse si le prix du jour est plus haut. `true` : accord sans montant, qui ne
 * couvre un prix que SOUS le seuil de confirmation (seconde relecture, R2) ; au-delà, seul un montant le couvre. `true`
 * reste la réponse des questions sans prix. Aucune dépendance : lisible par l'écran et par le serveur.
 */
export type AccordPrix = boolean | number | undefined;

/**
 * L'accord couvre-t-il ce prix (centimes d'euro) ? Un montant confirmé plus bas que le prix du jour ne le couvre pas ;
 * `true` (sans montant) ne couvre pas un prix au-dessus du seuil de confirmation `seuilCentimes`.
 */
export function accordCouvre(accord: AccordPrix, centimes: number, seuilCentimes: number): boolean {
  if (typeof accord === "number") return Number.isFinite(accord) && accord >= centimes;
  return accord === true && centimes <= seuilCentimes;
}

/** Un accord a-t-il été donné (quel que soit le montant) ? */
export function accordDonne(accord: AccordPrix): boolean {
  return accord === true || (typeof accord === "number" && Number.isFinite(accord) && accord >= 0);
}

/** Accord reçu de l'écran (donnée non sûre) : `true`, un montant fini et positif, sinon `false`. */
export function accordPropre(accord: unknown): AccordPrix {
  if (accord === true) return true;
  return typeof accord === "number" && Number.isFinite(accord) && accord >= 0 ? Math.floor(accord) : false;
}
