import type { AvisClient } from "./types";

/**
 * Provenance « lecteur du site » (N-12). La marque est un Symbol NON exporté :
 * on ne peut la poser qu'avec `marquerAvisDuSite`, réservée au futur lecteur
 * `src/fournisseurs/site/avis.ts` (C8-A07). Un avis écrit à la main n'a pas la marque.
 * La propriété est non énumérable : `{...avis}` et JSON.stringify ne la copient pas
 * (voulu : la preuve est l'empreinte figée, vérifiée au moment du gel, pas au rendu).
 */
const MARQUE_SITE: unique symbol = Symbol("avisClient.vientDuSite");

/** Renvoie une copie de l'avis portant la marque ; l'avis d'origine n'est pas modifié. */
export function marquerAvisDuSite(avis: AvisClient): AvisClient {
  const copie: AvisClient = { ...avis, accordAuteur: { ...avis.accordAuteur } };
  Object.defineProperty(copie, MARQUE_SITE, { value: true, enumerable: false });
  return copie;
}

/** Vrai seulement si l'avis a été marqué par le lecteur du site. */
export function vientDuSite(avis: AvisClient): boolean {
  return (avis as unknown as Record<symbol, unknown>)[MARQUE_SITE] === true;
}
