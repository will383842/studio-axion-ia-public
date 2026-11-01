/**
 * IMP-1 — EXCLUSIONS (règles explicites, PURES). Ne supprime et ne modifie rien chez Buffer : elles ne font que
 * décider quels posts sont gardés pour l'import.
 *  1. la vidéo de test du 31/10 : brouillon contenant une vidéo, daté du 31/10 (jour de Paris) ;
 *  2. les posts déjà envoyés ;
 *  3. les posts passés (date prévue avant maintenant).
 */
import type { PostBuffer, PostExclu, RaisonExclusion } from "./types";

const JOUR_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Jour de Paris (AAAA-MM-JJ) d'un instant ISO, ou undefined s'il est illisible. */
export function jourParis(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : JOUR_PARIS.format(new Date(t));
}

/** Vidéo de test : brouillon + au moins une vidéo + daté du 31/10 (de n'importe quelle année). */
export function estVideoTest(p: PostBuffer): boolean {
  if (p.statut !== "draft") return false;
  if (!p.medias.some((m) => m.type === "video")) return false;
  return /^\d{4}-10-31$/.test(jourParis(p.dateUtc ?? p.creeLe) ?? "");
}

export function raisonExclusion(p: PostBuffer, maintenant: Date): RaisonExclusion | undefined {
  if (estVideoTest(p)) return "video-test-31-10";
  if (p.statut === "sent" || p.envoyeLe) return "envoye";
  const t = p.dateUtc ? Date.parse(p.dateUtc) : NaN;
  if (!Number.isNaN(t) && t < maintenant.getTime()) return "passe";
  return undefined;
}

export function filtrerPostsAVenir(posts: PostBuffer[], maintenant: Date): { retenus: PostBuffer[]; exclus: PostExclu[] } {
  const retenus: PostBuffer[] = [];
  const exclus: PostExclu[] = [];
  for (const p of posts) {
    const raison = raisonExclusion(p, maintenant);
    if (raison) exclus.push({ id: p.id, raison });
    else retenus.push(p);
  }
  return { retenus, exclus };
}
