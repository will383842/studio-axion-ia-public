// Parcours « mot → e-mail → guide » : contrat avec la route du site (PUR, aucun appel réseau, aucun branchement).
import { createHash } from "node:crypto";

/** Forme de clé d'idempotence acceptée par le site. */
export const RE_CLE_IDEMPOTENCE = /^[A-Za-z0-9_-]{8,80}$/;
/** Mot commenté : lettres et chiffres (accentués compris), 2 à 30 caractères. */
export const RE_MOT_GUIDE = /^[\p{L}\p{N}]{2,30}$/u;
/**
 * Clé d'idempotence = identifiant du run Zernio. Si l'identifiant brut a d'autres caractères (ou une autre longueur),
 * on envoie son sha256 hexadécimal (64 caractères, minuscules), déterministe. La clé se fige au premier essai.
 */
export function cleIdempotence(idRunBrut: string): string {
  if (RE_CLE_IDEMPOTENCE.test(idRunBrut)) return idRunBrut;
  return createHash("sha256").update(idRunBrut, "utf8").digest("hex"); // sha256 hex = 64 caractères exactement
}
