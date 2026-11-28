/** Aperçu d'une épingle (PR 7) : fonctions pures, importables côté client. Limites : ADR-0015 (Pinterest via Zernio). */

import { ALT_MAX_PINTEREST, DESCRIPTION_EPINGLE_MAX, TITRE_EPINGLE_MAX } from "../../fournisseurs/publication/epingle-limites";
import { lienDuSite } from "../../fournisseurs/publication/liens-du-site";

/** Mêmes plafonds que l'envoi (une seule source : epingle-limites.ts). */
export const TITRE_MAX = TITRE_EPINGLE_MAX;
export const DESCRIPTION_MAX = DESCRIPTION_EPINGLE_MAX;
export const ALT_MAX = ALT_MAX_PINTEREST;

export interface ChampsEpingle {
  titre: string;
  description: string;
  texteAlternatif: string;
  lien: string;
  /** Domaine exigé à l'envoi (réglage `site.domaine`) ; absent ou vide : tout lien est refusé, comme à l'envoi. */
  domaine?: string | null;
}

export type CodeProbleme = "titre-absent" | "titre-trop-long" | "description-trop-longue" | "alt-absent" | "alt-trop-long" | "lien-hors-site";
export interface ProblemeEpingle {
  code: CodeProbleme;
  phrase: string;
}

/** Hôte d'un lien (sans chemin ni paramètres), ou null si le lien est illisible. */
export function hoteDuLien(lien: string): string | null {
  try {
    return new URL(lien).hostname || null;
  } catch {
    return null;
  }
}

/** Coupe à `max` signes en finissant par « … » ; ne touche pas un texte qui tient. */
export function tronquer(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, max - 1)}…`;
}

/** Ce qui empêcherait l'envoi : une phrase par problème, dans un ordre stable. */
export function limitesEpingle(c: ChampsEpingle): ProblemeEpingle[] {
  const p: ProblemeEpingle[] = [];
  const titre = c.titre.trim();
  if (titre.length === 0) p.push({ code: "titre-absent", phrase: "Titre manquant." });
  else if (titre.length > TITRE_MAX) p.push({ code: "titre-trop-long", phrase: `Titre trop long : ${titre.length} signes sur ${TITRE_MAX}.` });
  if (c.description.length > DESCRIPTION_MAX) p.push({ code: "description-trop-longue", phrase: `Description trop longue : ${c.description.length} signes sur ${DESCRIPTION_MAX}.` });
  const alt = c.texteAlternatif.trim();
  if (alt.length === 0) p.push({ code: "alt-absent", phrase: "Texte alternatif manquant." });
  else if (alt.length > ALT_MAX) p.push({ code: "alt-trop-long", phrase: `Texte alternatif trop long : ${alt.length} signes sur ${ALT_MAX}.` });
  // Même fonction que l'envoi : https, domaine exact du site, sans identifiants ni port.
  if (!lienDuSite(c.lien, c.domaine)) p.push({ code: "lien-hors-site", phrase: "Le lien doit mener au site (https, domaine exact) : sinon l'épingle ne part pas." });
  return p;
}
