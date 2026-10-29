/**
 * Contrôle du jeton de la porte v2 (/api/usine/*), SANS dépendance serveur lourde : utilisé par la garde des handlers
 * (src/usine/garde-porte.ts) ET par le proxy (défense en profondeur, runtime Node). Aucun secret n'est jamais écrit.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const LONGUEUR_MIN_SECRET_PORTE = 32;

export type Env = { STUDIO_PORTE_SECRET?: string; STUDIO_PORTE_SECRET_PRECEDENT?: string };

const empreinte = (s: string) => createHash("sha256").update(s).digest();

/** Secret lisible seulement s'il a 32 caractères au moins. */
export function secretValide(v: string | undefined): string | null {
  const s = v?.trim() ?? "";
  return s.length >= LONGUEUR_MIN_SECRET_PORTE ? s : null;
}

/** La porte est allumée seulement si le secret courant est lisible (sinon elle répond 404, comme si elle n'existait pas). */
export function porteAllumee(env: Env): boolean {
  return secretValide(env.STUDIO_PORTE_SECRET) !== null;
}

/** Comparaison à temps constant : empreintes de même longueur, et les deux secrets sont toujours évalués. */
export function jetonAccepte(jeton: string, env: Env): boolean {
  const e = empreinte(jeton);
  const courant = secretValide(env.STUDIO_PORTE_SECRET);
  const precedent = secretValide(env.STUDIO_PORTE_SECRET_PRECEDENT);
  const okCourant = courant !== null && timingSafeEqual(e, empreinte(courant));
  const okPrecedent = precedent !== null && timingSafeEqual(e, empreinte(precedent));
  return okCourant || okPrecedent;
}

/** Jeton de l'en-tête `Authorization: Bearer …` (null si absent ou mal formé). */
export function jetonDeLEntete(requete: Request): string | null {
  const m = /^Bearer[ \t]+(\S+)$/i.exec(requete.headers.get("authorization")?.trim() ?? "");
  return m ? m[1] : null;
}
