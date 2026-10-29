/**
 * Contrôle du jeton de la porte v2 (/api/usine/*), SANS dépendance serveur lourde : utilisé par la garde des handlers
 * (src/usine/garde-porte.ts) ET par le proxy (défense en profondeur, runtime Node). Aucun secret n'est jamais écrit.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const LONGUEUR_MIN_SECRET_PORTE = 32;

export type Env = { STUDIO_PORTE_SECRET?: string; STUDIO_PORTE_SECRET_PRECEDENT?: string; USINE_PORTE_SECRET?: string; STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A?: string };

const empreinte = (s: string) => createHash("sha256").update(s).digest();

/** Secret lisible seulement s'il a 32 caractères au moins. */
export function secretValide(v: string | undefined): string | null {
  const s = v?.trim() ?? "";
  return s.length >= LONGUEUR_MIN_SECRET_PORTE ? s : null;
}

/** Égalité à temps constant de deux secrets (empreintes SHA-256 de même longueur). */
function memeSecret(a: string, b: string): boolean {
  return timingSafeEqual(empreinte(a), empreinte(b));
}

/**
 * Le contrat veut un secret PAR SENS, jamais le même : `STUDIO_PORTE_SECRET` (usine → studio) ou son précédent égal à
 * `USINE_PORTE_SECRET` (studio → usine) → configuration refusée. Les trois sont toujours comparés (temps constant).
 */
export function secretsEnConflit(env: Env): boolean {
  const sortant = secretValide(env.USINE_PORTE_SECRET);
  if (sortant === null) return false;
  const courant = secretValide(env.STUDIO_PORTE_SECRET);
  const precedent = secretValide(env.STUDIO_PORTE_SECRET_PRECEDENT);
  const c = courant !== null && memeSecret(courant, sortant);
  const p = precedent !== null && memeSecret(precedent, sortant);
  return c || p;
}

/**
 * La porte est allumée seulement si le secret courant est lisible ET différent du secret de l'autre sens (sinon elle
 * répond 404, comme si elle n'existait pas).
 */
export function porteAllumee(env: Env): boolean {
  return secretValide(env.STUDIO_PORTE_SECRET) !== null && !secretsEnConflit(env);
}

/**
 * L'ancien secret (rotation) ne vaut que jusqu'à `STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A` (date ISO, 24 h au plus après la
 * rotation) : échéance absente, illisible ou dépassée → l'ancien secret est ignoré.
 */
export function precedentEnVigueur(env: Env, maintenantMs: number = Date.now()): boolean {
  const brut = env.STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A?.trim() ?? "";
  if (brut === "") return false;
  const echeance = Date.parse(brut);
  return Number.isFinite(echeance) && maintenantMs <= echeance;
}

/** Comparaison à temps constant : empreintes de même longueur, et les deux secrets sont toujours évalués. */
export function jetonAccepte(jeton: string, env: Env, maintenantMs: number = Date.now()): boolean {
  const e = empreinte(jeton);
  const courant = secretValide(env.STUDIO_PORTE_SECRET);
  const precedent = precedentEnVigueur(env, maintenantMs) ? secretValide(env.STUDIO_PORTE_SECRET_PRECEDENT) : null;
  const okCourant = courant !== null && timingSafeEqual(e, empreinte(courant));
  const okPrecedent = precedent !== null && timingSafeEqual(e, empreinte(precedent));
  return okCourant || okPrecedent;
}

/** Jeton de l'en-tête `Authorization: Bearer …` (null si absent ou mal formé). */
export function jetonDeLEntete(requete: Request): string | null {
  const m = /^Bearer[ \t]+(\S+)$/i.exec(requete.headers.get("authorization")?.trim() ?? "");
  return m ? m[1] : null;
}
