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

/** Un compte encore routé chez Buffer : l'écran le signale par la pastille « Ancien outil ». */
export function estAncienOutil(outil: OutilPublication | string | null | undefined): boolean {
  return outil === "buffer";
}

/**
 * Un outil est-il sélectionnable dans « Changer » ? Buffer ne l'est PAS pour un compte routé chez Zernio, tant que le serveur ne refuse pas
 * `outil: "buffer"` (L7-06 suite 4.3, bloqué) : sinon l'envoi partirait par Buffer en contournant les gardes du chemin Zernio.
 * Pour un compte encore chez Buffer, les deux restent sélectionnables.
 */
export function outilSelectionnable(outil: OutilPublication, actuel: OutilPublication): boolean {
  return !(outil === "buffer" && actuel !== "buffer");
}

/** Les outils proposés dans « Changer » : toujours les deux (Zernio d'abord), l'outil actuel marqué ; Buffer visible mais désactivé pour un compte Zernio. */
export function outilsProposes(actuel: OutilPublication): { outil: OutilPublication; actuel: boolean; ancien: boolean; desactive: boolean }[] {
  return (["zernio", "buffer"] as const).map((outil) => ({ outil, actuel: outil === actuel, ancien: estAncienOutil(outil), desactive: !outilSelectionnable(outil, actuel) }));
}

/** La publication est-elle chez un outil externe (via ∈ {buffer, zernio}) ? */
export function estChezUnOutil(p: Pick<Publication, "via">): boolean {
  return outilDe(p) !== null;
}

/** Outil choisi : la clé la plus précise gagne (« réseau:compte » avant « réseau »). Défaut : Zernio (un choix « buffer » déjà enregistré reste lu tel quel). */
export function outilPour(routage: RoutagePublication | null | undefined, reseau: IdReseau | string, compte?: string | null): OutilPublication {
  const table = routage ?? {};
  const candidats = [compte ? `${reseau}:${compte}` : null, reseau].filter((c): c is string => !!c);
  for (const cle of candidats) {
    const valeur = Object.hasOwn(table, cle) ? table[cle] : undefined;
    if ((OUTILS as readonly string[]).includes(valeur as string)) return valeur as OutilPublication;
  }
  return "zernio";
}

/**
 * Clé d'idempotence NEUTRE (sans nom de fournisseur) : sha256 hexadécimal (64 signes).
 * Envoyée plus tard en `Idempotency-Key: studio-<hex>` (71 signes, bien sous 255).
 */
export function cleEnvoiPublication(sourceId: string, reseau: string, dateIso: string, compteCode?: string | null): string {
  return createHash("sha256").update(JSON.stringify([sourceId, reseau, dateIso, compteCode ?? ""])).digest("hex");
}

/** Nom du réglage qui ouvre l'envoi du calendrier (recopié de L7-08 : services/zernio.ts PARAM_EDITORIALE_ACTIVE ; un test le vérifie). Faux par défaut. */
export const REGLAGE_ENVOI_CALENDRIER = "publication.editoriale_active";
