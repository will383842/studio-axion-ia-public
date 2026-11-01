/**
 * IMP-3 (c) — RAPPROCHEMENT À ZÉRO ÉCART : posts à venir de Buffer (92 attendus) ↔ posts programmés de Zernio
 * issus de l'import. Lecture seule. Le delta est lisible : manquants, en trop, divergents, doubles, double publication.
 */
import type { ClientZernio, PostZernio } from "../../fournisseurs/publication/zernio-client";
import { listerTousLesPosts, ORIGINE_IMPORT } from "./creer-brouillons";
import { ecartsJumeau } from "./retrait-jumeau";
import type { PostBuffer } from "./types";

export const ATTENDUS_PAR_DEFAUT = 92;

export interface DeltaRapprochement {
  attendus: number;
  /** Posts Buffer à venir retenus (programmés ou déjà repassés en brouillon, hors exclus). */
  bufferAVenir: number;
  zernioProgrammes: number;
  /** Buffer sans jumeau programmé chez Zernio. */
  manquants: string[];
  /** Programmés chez Zernio sans post Buffer à venir. */
  enTrop: string[];
  /** Jumeaux dont texte, date ou médias diffèrent : { bufferId, champs }. */
  divergents: { bufferId: string; champs: string[] }[];
  /** Même bufferId programmé plusieurs fois chez Zernio. */
  doubles: string[];
  /** Jumeau Buffer encore « scheduled » alors que Zernio est programmé : DOUBLE PUBLICATION à éviter. */
  doublePublication: string[];
  zeroEcart: boolean;
}

/** Pur : compare les deux ensembles. `postsBuffer` = posts à venir déjà filtrés (exclusions IMP-1 appliquées). */
export function rapprocher(postsBuffer: PostBuffer[], programmes: PostZernio[], attendus = ATTENDUS_PAR_DEFAUT): DeltaRapprochement {
  const importes = programmes.filter((z) => z.metadata?.origine === ORIGINE_IMPORT && typeof z.metadata.bufferId === "string");
  const parBuffer = new Map<string, PostZernio[]>();
  for (const z of importes) parBuffer.set(z.metadata!.bufferId as string, [...(parBuffer.get(z.metadata!.bufferId as string) ?? []), z]);
  const ids = new Set(postsBuffer.map((p) => p.id));
  const d: DeltaRapprochement = { attendus, bufferAVenir: postsBuffer.length, zernioProgrammes: importes.length, manquants: [], enTrop: [], divergents: [], doubles: [], doublePublication: [], zeroEcart: false };
  for (const p of postsBuffer) {
    const l = parBuffer.get(p.id) ?? [];
    if (l.length === 0) d.manquants.push(p.id);
    else {
      if (l.length > 1) d.doubles.push(p.id);
      const champs = ecartsJumeau(p, l[0]);
      if (champs.length) d.divergents.push({ bufferId: p.id, champs });
      if (p.statut === "scheduled") d.doublePublication.push(p.id);
    }
  }
  for (const id of parBuffer.keys()) if (!ids.has(id)) d.enTrop.push(id);
  d.zeroEcart = d.bufferAVenir === attendus && d.zernioProgrammes === attendus && !d.manquants.length && !d.enTrop.length && !d.divergents.length && !d.doubles.length && !d.doublePublication.length;
  return d;
}

export async function rapprocherDepuisZernio(client: ClientZernio, postsBuffer: PostBuffer[], attendus = ATTENDUS_PAR_DEFAUT): Promise<DeltaRapprochement> {
  return rapprocher(postsBuffer, await listerTousLesPosts(client, "scheduled"), attendus);
}

export function formaterDelta(d: DeltaRapprochement): string {
  const l = [`${d.zeroEcart ? "ZÉRO ÉCART" : "ÉCARTS"} · Buffer à venir : ${d.bufferAVenir} · Zernio programmés : ${d.zernioProgrammes} · attendus : ${d.attendus}`];
  if (d.bufferAVenir !== d.attendus) l.push(`  Buffer : ${d.bufferAVenir} au lieu de ${d.attendus} attendus`);
  if (d.zernioProgrammes !== d.attendus) l.push(`  Zernio : ${d.zernioProgrammes} au lieu de ${d.attendus} attendus`);
  for (const id of d.manquants) l.push(`  MANQUANT chez Zernio : ${id}`);
  for (const id of d.enTrop) l.push(`  EN TROP chez Zernio (aucun post Buffer) : ${id}`);
  for (const x of d.divergents) l.push(`  DIVERGENT ${x.bufferId} : ${x.champs.join(", ")}`);
  for (const id of d.doubles) l.push(`  DOUBLE chez Zernio : ${id}`);
  for (const id of d.doublePublication) l.push(`  DOUBLE PUBLICATION possible (Buffer encore programmé) : ${id}`);
  return l.join("\n");
}
