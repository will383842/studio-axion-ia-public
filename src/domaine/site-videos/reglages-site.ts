// Vidéos sur le site — réglages du SITE lus par le studio (PUR). Le nom exact des réglages chez le site est le
// prérequis P3 du plan (à confirmer par le lot W1 du site) : il n'est écrit qu'ici et dans le contrat (S4).
export interface ReglagesDuSite {
  /** Lu chez le site (`GET /api/interne/videos/reglages`, S4). `null` : inconnu ou injoignable = traité comme `false`. */
  certifexempleCertificationObtenue: boolean | null;
  avisPublies: boolean | null;
}

/** La certification est-elle obtenue ? Inconnu (`null`) = non. */
export function certificationObtenue(r: ReglagesDuSite): boolean {
  return r.certifexempleCertificationObtenue === true;
}

/** Les avis sont-ils publiés sur le site ? Inconnu (`null`) = non. */
export function avisPublies(r: ReglagesDuSite): boolean {
  return r.avisPublies === true;
}

/** Réglages inconnus (site injoignable, réponse illisible) : tout est interdit. */
export const REGLAGES_SITE_INCONNUS: ReglagesDuSite = { certifexempleCertificationObtenue: null, avisPublies: null };
