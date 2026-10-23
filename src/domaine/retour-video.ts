/**
 * ÉCRIRE LE TEXTE D'UNE VIDÉO AVEC LE VRAI GÉNÉRATEUR (correcteur 3, B1 et B2 de l'audit B), PUR.
 *
 * « Nouvelle vidéo » › « Une idée » › « Écrire le texte » et l'icône « En faire une vidéo » des Idées ouvrent l'écran
 * Sujet (`/ecrire/atelier`) avec l'idée déjà remplie et l'adresse de RETOUR à la vidéo. Le sujet écrit, chaque version
 * propose « Utiliser dans ma vidéo », qui revient à l'assistant avec `variante=<id>` : son texte devient celui de la
 * vidéo, mot pour mot. Le retour n'accepte qu'une adresse de l'assistant (jamais une adresse extérieure).
 */

const RETOUR_PERMIS = /^\/nouvelle\/[a-z0-9-]+(?:\?brouillon=[A-Za-z0-9_-]+)?$/;

/** L'adresse de retour, si c'est bien une adresse de l'assistant ; sinon rien. */
export function retourValide(retour: string | null | undefined): string | undefined {
  return retour && RETOUR_PERMIS.test(retour) ? retour : undefined;
}

/** Adresse de retour d'un brouillon de l'assistant (avec son id s'il existe déjà). */
export function retourAssistant(formatId: string, videoId?: string): string {
  return `/nouvelle/${formatId}${videoId ? `?brouillon=${videoId}` : ""}`;
}

/** L'écran Sujet, idée préremplie (texte ou idée notée), et retour à la vidéo. */
export function lienEcrireTexte(o: { idee?: string; ideeId?: string; retour?: string }): string {
  const p = new URLSearchParams();
  if (o.ideeId) p.set("idee", o.ideeId);
  else if (o.idee?.trim()) p.set("texte", o.idee.trim());
  const retour = retourValide(o.retour);
  if (retour) p.set("retour", retour);
  const q = p.toString();
  return `/ecrire/atelier${q ? `?${q}` : ""}`;
}

/** La fiche du sujet, en gardant le retour à la vidéo. */
export function lienSujet(sujetId: string, retour?: string): string {
  const r = retourValide(retour);
  return `/ecrire/sujets/${sujetId}${r ? `?retour=${encodeURIComponent(r)}` : ""}`;
}

/** Retour à la vidéo avec le texte d'une version du générateur. */
export function lienRetourAvecVersion(retour: string, varianteId: string): string | undefined {
  const r = retourValide(retour);
  return r ? `${r}${r.includes("?") ? "&" : "?"}variante=${encodeURIComponent(varianteId)}` : undefined;
}
