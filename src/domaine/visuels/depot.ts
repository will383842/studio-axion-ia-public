/** Dépôt de texte et adresses : fonctions pures, sans directive client, partageables entre écran et serveur. */

/** Taille maximale d'un texte écrit en session déposé ici : 64 Ko. */
export const TAILLE_MAX_DEPOT_OCTETS = 64 * 1024;

export type VerdictDepot = { ok: true } | { ok: false; message: string };

/** Contrôle d'un dépôt (texte collé ou fichier lu) : non vide, 64 Ko au plus (en octets, pas en caractères). */
export function verifierDepotTexte(contenu: string): VerdictDepot {
  if (contenu.trim() === "") return { ok: false, message: "Le texte déposé est vide." };
  if (new TextEncoder().encode(contenu).length > TAILLE_MAX_DEPOT_OCTETS) return { ok: false, message: "Le texte dépasse 64 Ko : déposez-en un plus court." };
  return { ok: true };
}

/** N'accepte qu'un chemin du site (`/…`, pas `//` ni `/\`), sans caractère de contrôle, ou une adresse `https:` ; sinon undefined (ni lien ni image). */
export function urlSure(u: string | undefined): string | undefined {
  if (!u) return undefined;
  if (/[\u0000-\u001f\u007f]/.test(u)) return undefined;
  if (/^\/(?![\/\\])/.test(u)) return u;
  return u.startsWith("https:") ? u : undefined;
}
