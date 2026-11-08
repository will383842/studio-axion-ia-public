/**
 * Réseau(x) d'une vidéo (lot S, « Mes vidéos / Vidéos validées »). Fonctions PURES, sans migration : le réseau n'est pas
 * stocké sur la vidéo (la copie vieillirait), il se déduit de ce que la vidéo porte déjà.
 * Première source qui donne un résultat :
 *  1. `reseau` (générateur) ;
 *  2. image → vidéo : la livraison de la version courante, réseaux « aucune » retirés ; sinon les réseaux demandés ;
 *  3. l'union des `reseaux` des sorties de la version courante ;
 *  4. sinon les réseaux par défaut, avec `precis = false`.
 * Le résultat suit l'ordre du registre, sans doublon ; les valeurs inconnues sont écartées. Pas de déduction par le
 * ratio (un même 9:16 sert à 4 réseaux).
 */
import type { IdReseau } from "./types";
import { listerReseaux } from "@/reseaux";

export interface EntreesReseauxVideo {
  /** Générateur : `Video.reseau`. */
  reseau?: unknown;
  /** Image → vidéo : `entrees.imageVideo.reseaux`. */
  entreesIV?: unknown;
  /** Image → vidéo : `projetMontage.imageVideo.livraison` de la version courante (lu avec prudence). */
  livraisonIV?: unknown;
  /** Les `reseaux` de chaque sortie de la version courante (undefined : fichier d'avant). */
  sortiesReseaux: readonly unknown[];
  /** Réglage `reseaux.parDefaut`. */
  parDefaut: readonly IdReseau[];
}

export function estIdReseau(valeur: unknown): valeur is IdReseau {
  return typeof valeur === "string" && listerReseaux().some((r) => r.id === valeur);
}

/** Les réseaux connus de `valeurs`, dans l'ordre du registre, sans doublon. */
function normaliser(valeurs: Iterable<unknown>): IdReseau[] {
  const voulus = new Set<string>();
  for (const v of valeurs) if (estIdReseau(v)) voulus.add(v);
  return listerReseaux().map((r) => r.id).filter((id) => voulus.has(id));
}

function tableau(valeur: unknown): unknown[] {
  return Array.isArray(valeur) ? valeur : [];
}

export function reseauxDeLaVideo(e: EntreesReseauxVideo): { reseaux: IdReseau[]; precis: boolean } {
  const sources: unknown[][] = [
    [e.reseau],
    tableau(e.livraisonIV).flatMap((l) => (l && typeof l === "object" && (l as { version?: unknown }).version !== "aucune" ? [(l as { reseau?: unknown }).reseau] : [])),
    tableau(e.entreesIV),
    tableau(e.sortiesReseaux).flatMap((s) => tableau(s)),
  ];
  for (const source of sources) {
    const reseaux = normaliser(source);
    if (reseaux.length) return { reseaux, precis: true };
  }
  return { reseaux: normaliser(e.parDefaut), precis: false };
}

export function aCeReseau(reseaux: readonly IdReseau[], reseau: IdReseau): boolean {
  return reseaux.includes(reseau);
}
