/**
 * Codes de classement des réseaux (générateur, plan v5 B.1, B.2.4). PUR : importable côté client.
 *
 * Le registre des réseaux (`reseaux/index.ts`) appartient à la session du moteur : il reçoit `codeClassement` sur la
 * branche `generateur/prepare-moteur` (lu ICI, une seule source). Le générateur ne lit les codes que par ce module.
 */
import type { IdReseau, ReseauDeclinaison } from "@/domaine/types";

export const CODES_RESEAU: Readonly<Record<IdReseau, string>> = {
  tiktok: "TT",
  instagram: "IG",
  facebook: "FB",
  linkedin: "LI",
  "youtube-shorts": "YS",
  youtube: "YT",
};

/**
 * Les 5 réseaux d'une déclinaison, dans l'ordre des colonnes de la mini-grille et de l'ordre de publication proposé
 * (TikTok J, Reels J+1, Shorts J+2, LinkedIn J+3, Facebook J+4 ; B.6.12, maquettes GM).
 */
export const RESEAUX_DECLINAISON: readonly ReseauDeclinaison[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];

export function codeReseau(id: IdReseau): string {
  return CODES_RESEAU[id];
}

export function reseauDuCode(code: string): IdReseau | undefined {
  return (Object.keys(CODES_RESEAU) as IdReseau[]).find((r) => CODES_RESEAU[r] === code);
}

export function estReseauDeclinaison(id: IdReseau): id is ReseauDeclinaison {
  return (RESEAUX_DECLINAISON as readonly IdReseau[]).includes(id);
}
