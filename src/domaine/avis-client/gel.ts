import { avisAffichables } from "./garde";
import { vientDuSite } from "./provenance";
import { empreinteAvis } from "./texte";
import type { AvisClient } from "./types";

declare const marqueFige: unique symbol;

/** Copie figée d'un avis pour une commande. Type distinct : un objet d'exemple n'y est pas assignable. */
export interface AvisClientFige {
  readonly [marqueFige]: true;
  /** Copie complète de l'avis au moment du gel. */
  readonly avis: AvisClient;
  readonly id: string;
  readonly valideLe: string;
  readonly figeLe: string;
  readonly empreinte: string;
}

/**
 * Fige l'avis `choix` parmi `avisPublies`. Refuse (erreur lisible) : id absent, exemple,
 * non publié / sans accord (garde), avis non issu du lecteur du site (N-12).
 */
export function figerAvisPourLaCommande(
  avisPublies: AvisClient[],
  choix: string,
  maintenant: string,
): AvisClientFige {
  const a = avisPublies.find((x) => x.id === choix);
  if (!a) throw new Error(`Avis « ${choix} » absent de la liste des avis publiés : gel refusé.`);
  if (a.exemple === true) throw new Error(`Avis « ${choix} » : avis d'exemple, jamais figé dans une commande.`);
  if (!vientDuSite(a)) {
    throw new Error(`Avis « ${choix} » : il ne sort pas du lecteur du site (avis écrit à la main), gel refusé.`);
  }
  const { refus } = avisAffichables([a]);
  if (refus.length > 0) throw new Error(`Avis « ${choix} » refusé : ${refus[0].motif}.`);
  const copie: AvisClient = { ...a, accordAuteur: { ...a.accordAuteur } };
  return {
    avis: copie,
    id: a.id,
    valideLe: a.valideLe,
    figeLe: maintenant,
    empreinte: empreinteAvis(a),
  } as AvisClientFige;
}

/** Vidéos dont l'avis figé n'est plus publié (à signaler ; le Studio ne retire rien). Pure. */
export function avisRetires(
  videosFigees: { videoId: string; avisId: string }[],
  avisPublies: AvisClient[],
): { videoId: string; avisId: string }[] {
  const encorePublies = new Set(avisAffichables(avisPublies).gardes.map((a) => a.id));
  return videosFigees
    .filter((v) => !encorePublies.has(v.avisId))
    .map((v) => ({ videoId: v.videoId, avisId: v.avisId }));
}
