/**
 * IMP-2 — VÉRIFICATION DES BROUILLONS : GET /v1/posts/{id} comparé au corps envoyé (texte, nombre et type de médias,
 * date, cible, premier commentaire, titre du document). Rapport des SEULS écarts + 5 posts tirés au hasard.
 * Lecture seule : aucune écriture, tout passe par le client à liste fermée.
 */
import type { ClientZernio, CorpsPostZernio, PostZernio } from "../../fournisseurs/publication/zernio-client";
import { ORIGINE_IMPORT } from "./creer-brouillons";

export interface AttenduBrouillon {
  bufferId: string;
  zernioId: string;
  corps: CorpsPostZernio;
}

export interface Ecart {
  bufferId: string;
  zernioId: string;
  champ: string;
  attendu: string;
  lu: string;
}

export interface RapportVerification {
  verifies: number;
  ecarts: Ecart[];
  /** Posts illisibles (GET en échec) : à revérifier, jamais comptés comme conformes. */
  illisibles: { bufferId: string; zernioId: string; raison: string }[];
  /** 5 posts tirés au hasard, pour un contrôle à l'œil. */
  echantillon: { bufferId: string; zernioId: string; plateforme?: string; date?: string; medias: number }[];
}

export const TAILLE_ECHANTILLON = 5;

const idCompte = (a: unknown): string => (a && typeof a === "object" ? String((a as Record<string, unknown>)._id ?? "") : String(a ?? ""));
const texte = (v: unknown): string => (typeof v === "string" ? v : "");

/** Compare un post lu au corps attendu ; rend les seuls écarts. */
export function comparerBrouillon(a: AttenduBrouillon, lu: PostZernio): Ecart[] {
  const ecarts: Ecart[] = [];
  const diff = (champ: string, attendu: unknown, valeur: unknown) => {
    const x = String(attendu ?? "");
    const y = String(valeur ?? "");
    if (x !== y) ecarts.push({ bufferId: a.bufferId, zernioId: a.zernioId, champ, attendu: x, lu: y });
  };
  const att = a.corps.platforms[0];
  const lue = lu.platforms?.[0];
  const specAtt = att.platformSpecificData ?? {};
  const specLu = lue?.platformSpecificData ?? {};

  diff("statut", "draft", lu.status);
  diff("origine", ORIGINE_IMPORT, lu.metadata?.origine);
  diff("bufferId", a.bufferId, lu.metadata?.bufferId);
  diff("texte", lue?.customContent ?? a.corps.content, lu.content ?? lue?.customContent);
  diff("nombre de médias", a.corps.mediaItems?.length ?? 0, lu.mediaItems?.length ?? 0);
  diff("types de médias", (a.corps.mediaItems ?? []).map((m) => m.type).join(","), (lu.mediaItems ?? []).map((m) => m.type).join(","));
  const tAtt = Date.parse(a.corps.scheduledFor ?? "");
  const tLu = Date.parse(lu.scheduledFor ?? "");
  if (tAtt !== tLu) diff("date", a.corps.scheduledFor, lu.scheduledFor);
  diff("réseau", att.platform, lue?.platform);
  diff("compte", idCompte(att.accountId), idCompte(lue?.accountId));
  diff("page Facebook", specAtt.pageId, specLu.pageId);
  diff("page LinkedIn", specAtt.organizationUrn, specLu.organizationUrn);
  diff("premier commentaire", texte(specAtt.firstComment) || texte(a.corps.firstComment), texte(specLu.firstComment) || texte(lu.firstComment));
  diff("titre du document", specAtt.documentTitle, specLu.documentTitle ?? lu.mediaItems?.find((m) => m.type === "document")?.title);
  return ecarts;
}

/** Tire `n` éléments au hasard sans remise (`hasard` injectable pour les tests). */
export function tirer<T>(liste: T[], n: number, hasard: () => number = Math.random): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie.slice(0, n);
}

export async function verifierBrouillons(client: ClientZernio, attendus: AttenduBrouillon[], hasard?: () => number): Promise<RapportVerification> {
  const r: RapportVerification = { verifies: 0, ecarts: [], illisibles: [], echantillon: [] };
  const lus: { a: AttenduBrouillon; post: PostZernio }[] = [];
  for (const a of attendus) {
    try {
      const post = await client.lirePost(a.zernioId);
      lus.push({ a, post });
      r.verifies++;
      r.ecarts.push(...comparerBrouillon(a, post));
    } catch (e) {
      r.illisibles.push({ bufferId: a.bufferId, zernioId: a.zernioId, raison: e instanceof Error ? e.message : "lecture impossible" });
    }
  }
  r.echantillon = tirer(lus, TAILLE_ECHANTILLON, hasard).map(({ a, post }) => ({
    bufferId: a.bufferId,
    zernioId: a.zernioId,
    plateforme: post.platforms?.[0]?.platform,
    date: post.scheduledFor,
    medias: post.mediaItems?.length ?? 0,
  }));
  return r;
}

export function formaterVerification(r: RapportVerification): string {
  const l = [`${r.verifies} brouillons relus, ${r.ecarts.length} écart(s), ${r.illisibles.length} illisible(s).`];
  for (const e of r.ecarts) l.push(`  ÉCART ${e.bufferId} (${e.champ}) : attendu « ${e.attendu} », lu « ${e.lu} »`);
  for (const i of r.illisibles) l.push(`  ILLISIBLE ${i.bufferId} : ${i.raison}`);
  l.push(`Échantillon de ${r.echantillon.length} post(s) tirés au hasard :`);
  for (const s of r.echantillon) l.push(`  ${s.bufferId} · ${s.plateforme ?? "?"} · ${s.date ?? "sans date"} · ${s.medias} média(s)`);
  return l.join("\n");
}
