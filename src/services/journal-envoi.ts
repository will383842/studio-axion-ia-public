import "server-only";
/**
 * Journal des envois (page « À publier ») : UNE ligne par événement, sur la sortie standard, préfixe stable « studio_envoi ».
 * Pourquoi : un refus d'envoi ne laissait aucune trace, et le journal d'un conteneur est perdu à chaque recréation.
 *
 * Liste blanche stricte : seuls ces champs sortent, et chacun doit avoir la forme attendue (sinon il est ignoré).
 *   ts (ISO, posé ici), action, outil (zernio|buffer), reseau, code, contenuId, nbComptes, brouillon.
 * Jamais : texte, légende, commentaire, clé ou jeton, e-mail, pseudo ou nom de compte, détail technique, corps de réponse,
 * identifiant de compte Zernio/Buffer. Module SERVEUR : à ne jamais importer depuis un composant « use client ».
 */

export const PREFIXE_JOURNAL_ENVOI = "studio_envoi";

export interface EvenementEnvoi {
  action: string;
  outil?: "zernio" | "buffer";
  reseau?: string;
  /** PAS_PRETE, AVANT_DE_PUBLIER, CIBLE_INCONNUE… ou « OK ». */
  code: string;
  contenuId?: string;
  nbComptes?: number;
  brouillon?: boolean;
}

const FORME_MOT = /^[A-Za-z0-9_-]{1,40}$/;
const FORME_CODE = /^[A-Z0-9_]{1,40}$/;
const FORME_ID = /^[A-Za-z0-9_.-]{1,80}$/;

/** Ne garde que les champs autorisés, de la bonne forme. Retourne l'objet à écrire (ordre fixe). */
export function filtrerEvenementEnvoi(brut: unknown): Record<string, string | number | boolean> {
  const e = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const sortie: Record<string, string | number | boolean> = { ts: new Date().toISOString() };
  const texte = (cle: string, forme: RegExp) => {
    const v = e[cle];
    if (typeof v === "string" && forme.test(v)) sortie[cle] = v;
  };
  texte("action", FORME_MOT);
  if (e.outil === "zernio" || e.outil === "buffer") sortie.outil = e.outil;
  texte("reseau", FORME_MOT);
  texte("code", FORME_CODE);
  texte("contenuId", FORME_ID);
  if (typeof e.nbComptes === "number" && Number.isInteger(e.nbComptes) && e.nbComptes >= 0 && e.nbComptes <= 1000) sortie.nbComptes = e.nbComptes;
  if (typeof e.brouillon === "boolean") sortie.brouillon = e.brouillon;
  return sortie;
}

/** Écrit la ligne. Ne lève jamais : le journal ne doit jamais changer le comportement d'un envoi. */
export function journaliserEnvoi(evenement: EvenementEnvoi): void {
  try {
    console.log(`${PREFIXE_JOURNAL_ENVOI} ${JSON.stringify(filtrerEvenementEnvoi(evenement))}`);
  } catch {
    /* rien */
  }
}

/** Code court d'une erreur levée (celui d'ErreurStudio s'il existe), sans jamais lire son message. */
export function codeDeErreur(e: unknown): string {
  const code = e && typeof e === "object" && "code" in e ? (e as { code?: unknown }).code : undefined;
  return typeof code === "string" && FORME_CODE.test(code) ? code : "ERREUR";
}
