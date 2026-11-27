/** Aperçu d'une épingle (PR 7) : fonctions pures, importables côté client. Limites : ADR-0015 (Pinterest via Zernio). */

export const TITRE_MAX = 100;
export const DESCRIPTION_MAX = 800;
export const ALT_MAX = 500;

export interface ChampsEpingle {
  titre: string;
  description: string;
  texteAlternatif: string;
  lien: string;
}

export type CodeProbleme = "titre-absent" | "titre-trop-long" | "description-trop-longue" | "alt-absent" | "alt-trop-long" | "lien-non-https";
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
  if (!c.lien.startsWith("https://")) p.push({ code: "lien-non-https", phrase: "Le lien doit commencer par https://." });
  return p;
}
