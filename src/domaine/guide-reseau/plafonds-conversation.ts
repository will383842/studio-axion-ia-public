/**
 * PLAFONDS D'ENVOI du parcours de conversation (lot 4b) : PUR, sans accès à la base.
 * Un compte ne reçoit pas plus de `plafond` écritures vers Zernio par heure civile (UTC). Le plafond se règle par le paramètre
 * `parcours.conversations.plafonds` (un nombre, ou `{ heureCompte: nombre }`) ; absent ou invalide = défaut ; borné par le maximum.
 */
/** Nom du paramètre lu par le parcours (même valeur que `PARAM_PLAFONDS_CONVERSATION` de parcours-conversation.ts, figée par test) ; la carte « Plafonds » de /mots l'écrit. */
export const PARAM_PLAFONDS_CONVERSATION_NOM = "parcours.conversations.plafonds";
export const PLAFOND_CONVERSATION_HEURE_COMPTE_DEFAUT = 30;
export const PLAFOND_HEURE_COMPTE_MAX = 600;
export const LOT_MAX_PAR_PASSAGE_CONVERSATION = 20;
export const HEURE_MS = 3600_000;

export function plafondHeureCompte(param: unknown): number {
  const brut = typeof param === "object" && param !== null ? (param as { heureCompte?: unknown }).heureCompte : param;
  if (typeof brut !== "number" || !Number.isFinite(brut) || brut < 1) return PLAFOND_CONVERSATION_HEURE_COMPTE_DEFAUT;
  return Math.min(Math.floor(brut), PLAFOND_HEURE_COMPTE_MAX);
}

export const debutHeure = (now: number): number => Math.floor(now / HEURE_MS) * HEURE_MS;
export const msJusquaHeureSuivante = (now: number): number => debutHeure(now) + HEURE_MS - now;

export interface CompteurHeure {
  heure: number;
  envois: number;
}
const compteurValide = (c: unknown): c is CompteurHeure => typeof c === "object" && c !== null && Number.isInteger((c as CompteurHeure).heure) && Number.isInteger((c as CompteurHeure).envois) && (c as CompteurHeure).envois >= 0;

export type DecisionReservation = { genre: "ok"; compteur: CompteurHeure } | { genre: "plafond" } | { genre: "illisible" };

/** `compteur` = ce que la base rend pour ce compte (`undefined` = jamais compté). Tout ce qui n'a pas la forme attendue est illisible (échec fermé). */
export function decider(compteur: unknown, now: number, plafond: number): DecisionReservation {
  const heure = debutHeure(now);
  if (compteur === undefined) return plafond >= 1 ? { genre: "ok", compteur: { heure, envois: 1 } } : { genre: "plafond" };
  if (!compteurValide(compteur)) return { genre: "illisible" };
  const courant = compteur.heure === heure ? compteur.envois : 0; // heure passée : on repart de zéro
  return courant >= plafond ? { genre: "plafond" } : { genre: "ok", compteur: { heure, envois: courant + 1 } };
}
