/**
 * SÉCURITÉ DE LA CLÉ CLAUDE (lot G0, plan v5 B.3.8) — PUR, testé.
 * La clé `ANTHROPIC_API_KEY` n'apparaît JAMAIS dans un journal, une réponse, un écran, une erreur, une génération :
 *  - `masquerSecrets` remplace toute clé connue ET tout motif `sk-ant-…` (même une clé que le serveur ne connaît pas) ;
 *  - `nettoyerEvenementSentry` est le `beforeSend` à brancher le jour où Sentry entre dans le studio (il n'y est pas au
 *    02/10/2026) : il retire en-têtes, corps, cookies et chaînes de requête, puis masque tous les textes restants.
 */
import { masquerCles } from "@/domaine/credits";
import { clesClaudeConnues, type EnvClaude } from "@/domaine/source-claude";

/** Motif d'une clé Anthropic (API, admin) : `sk-ant-` suivi de caractères de clé. */
export const MOTIF_CLE_ANTHROPIC = /sk-ant-[A-Za-z0-9_-]+/g;

export function masquerSecrets(texte: string, cles: (string | undefined)[] = []): string {
  return masquerCles(texte, cles).replace(MOTIF_CLE_ANTHROPIC, "[clé masquée]");
}

/** Comme `masquerSecrets`, avec en plus les quatre clés Claude du serveur (comptes 1 à 3 et API payante). */
export function masquerSecretsClaude(texte: string, cles: (string | undefined)[] = [], env: EnvClaude = process.env): string {
  return masquerSecrets(texte, [...cles, ...clesClaudeConnues(env)]);
}

/** Le texte contient-il encore une clé ? (contrôle des tests et de `exporter-fixture`) */
export function contientCle(texte: string): boolean {
  return new RegExp(MOTIF_CLE_ANTHROPIC.source).test(texte);
}

type Json = unknown;

function masquerProfond(v: Json, cles: (string | undefined)[]): Json {
  if (typeof v === "string") return masquerSecrets(v, cles);
  if (Array.isArray(v)) return v.map((x) => masquerProfond(x, cles));
  if (v && typeof v === "object") {
    const sortie: Record<string, Json> = {};
    for (const [k, x] of Object.entries(v)) sortie[k] = masquerProfond(x, cles);
    return sortie;
  }
  return v;
}

/**
 * `beforeSend` de Sentry : l'événement part SANS en-têtes, corps, cookies ni chaîne de requête, et tout texte restant
 * (message, exception, contexte, miettes) est masqué. Renvoie une copie ; l'original n'est pas modifié.
 */
export function nettoyerEvenementSentry<E extends Record<string, unknown>>(evenement: E, cles: (string | undefined)[] = []): E {
  const copie = structuredClone(evenement) as Record<string, unknown>;
  const requete = copie.request as Record<string, unknown> | undefined;
  if (requete && typeof requete === "object") {
    delete requete.headers;
    delete requete.data;
    delete requete.cookies;
    delete requete.query_string;
  }
  return masquerProfond(copie, cles) as E;
}
