/**
 * Outils de publication (z1t, D2-D4) : quel outil porte une publication, et lequel choisir pour un réseau/compte.
 * Fonctions pures, sans accès réseau ni base.
 */
import { createHash } from "node:crypto";
import type { IdReseau, Publication } from "./types";

export const OUTILS = ["buffer", "zernio"] as const;
export type OutilPublication = (typeof OUTILS)[number];

/** Réglage « publication.routage » : { "<reseau>": outil, "<reseau>:<compteCode>": outil }. */
export type RoutagePublication = Record<string, string>;

/** Outil qui porte la publication ; « null » si elle n'est chez aucun outil (manuel, simulation). */
export function outilDe(p: Pick<Publication, "via">): OutilPublication | null {
  return (OUTILS as readonly string[]).includes(p.via) ? (p.via as OutilPublication) : null;
}

/** La publication est-elle chez un outil externe (via ∈ {buffer, zernio}) ? */
export function estChezUnOutil(p: Pick<Publication, "via">): boolean {
  return outilDe(p) !== null;
}

/** Outil choisi : la clé la plus précise gagne (« réseau:compte » avant « réseau »). Défaut : Buffer. */
export function outilPour(routage: RoutagePublication | null | undefined, reseau: IdReseau | string, compte?: string | null): OutilPublication {
  const table = routage ?? {};
  const candidats = [compte ? `${reseau}:${compte}` : null, reseau].filter((c): c is string => !!c);
  for (const cle of candidats) {
    const valeur = Object.hasOwn(table, cle) ? table[cle] : undefined;
    if ((OUTILS as readonly string[]).includes(valeur as string)) return valeur as OutilPublication;
  }
  return "buffer";
}

/**
 * Clé d'idempotence NEUTRE (sans nom de fournisseur) : sha256 hexadécimal (64 signes).
 * Envoyée plus tard en `Idempotency-Key: studio-<hex>` (71 signes, bien sous 255).
 */
export function cleEnvoiPublication(sourceId: string, reseau: string, dateIso: string, compteCode?: string | null): string {
  return createHash("sha256").update(JSON.stringify([sourceId, reseau, dateIso, compteCode ?? ""])).digest("hex");
}

/** Fin du choix de Buffer pour un contenu : 20 novembre 2026, 23 h 59 à l'heure de Paris (UTC+1 en novembre). Seule source : l'écran et le serveur la lisent ici. */
export const FIN_BUFFER_ISO = "2026-11-20T23:59:59+01:00";
