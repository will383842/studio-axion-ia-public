/**
 * L3-08 · premier commentaire d'un post. PUR : aucun import de la zone interdite, aucun appel.
 *
 * Deux questions : COMMENT il part (selon le réseau) et QUEL texte. Règles :
 * - LinkedIn, Facebook : transmis, « à confirmer » jusqu'à la preuve RC-08, avec le repli Copier.
 * - Instagram : à la main (bouton Copier, aucun firstComment) ; automatique seulement après la preuve RC-08.
 * - TikTok (et YouTube) : à la main, toujours.
 * Le texte ne répète pas le post, n'appelle pas à « commenter » et n'est jamais le même sur deux réseaux.
 */
import type { IdReseau } from "@/domaine/types";
import type { ContenuSourceType } from "./contenu-source";

export const PREMIER_COMMENTAIRE_RESEAUX: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];

export type ModePremierCommentaire = "auto" | "a-confirmer" | "a-la-main";
export type ObjectifCommentaire = "lien";

export interface FacePremierCommentaire {
  mode: ModePremierCommentaire;
  /** Le texte part avec la publication (firstComment). */
  transmettre: boolean;
  /** Le bouton Copier est proposé. */
  copier: boolean;
}

export function modePremierCommentaire(reseau: IdReseau | string, options: { preuveRC08?: boolean } = {}): FacePremierCommentaire {
  if (reseau === "linkedin" || reseau === "facebook") return { mode: "a-confirmer", transmettre: true, copier: true };
  if (reseau === "instagram" && options.preuveRC08 === true) return { mode: "auto", transmettre: true, copier: true };
  return { mode: "a-la-main", transmettre: false, copier: true };
}

/** Une formulation par réseau, avec lien puis sans lien (jamais deux fois la même, jamais « commentez »). */
const AVEC_LIEN: Record<IdReseau, (lien: string) => string> = {
  linkedin: (l) => `Le lien pour aller plus loin : ${l}`,
  instagram: (l) => `Le lien est ici, à copier dans votre navigateur : ${l}`,
  facebook: (l) => `Vous trouverez la suite à cette adresse : ${l}`,
  tiktok: (l) => `Adresse à retenir : ${l}`,
  youtube: (l) => `Pour retrouver les ressources de cette vidéo : ${l}`,
  "youtube-shorts": (l) => `La version complète vous attend ici : ${l}`,
};
const SANS_LIEN: Record<IdReseau, string> = {
  linkedin: "Une question sur ce sujet ? Écrivez-nous en message privé, nous vous répondons.",
  instagram: "Enregistrez ce post pour le retrouver plus tard.",
  facebook: "Partagez-le avec la personne de votre équipe que ce sujet concerne.",
  tiktok: "Retrouvez la suite dans le prochain épisode.",
  youtube: "Abonnez-vous pour recevoir la prochaine vidéo.",
  "youtube-shorts": "La prochaine vidéo arrive bientôt.",
};

export function composerPremierCommentaire(d: { contenu?: ContenuSourceType; reseau: IdReseau; objectif?: ObjectifCommentaire; lien?: string }): string {
  const lien = d.lien?.trim();
  if (d.objectif === "lien") {
    if (!lien) throw new Error("Objectif « lien » sans lien : rien n'est inventé.");
    return AVEC_LIEN[d.reseau](lien);
  }
  return SANS_LIEN[d.reseau];
}
