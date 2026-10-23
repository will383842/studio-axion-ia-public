/**
 * LOT R1b — CASES DE LA FEUILLE « ENVOYER VERS BUFFER » (pur, utilisable à l'écran).
 *
 * Quand un réseau a plusieurs comptes reliés dans Buffer (deux LinkedIn : le profil et la page), chaque compte est une
 * case à part (« LinkedIn · Axion-IA.com ») ; Will coche l'un, l'autre ou les deux. Un réseau à un seul compte reste
 * une seule case. Par défaut : le dernier choix mémorisé pour ce réseau, sinon AUCUN compte coché (jamais un envoi
 * vers un compte que Will n'a pas vu).
 */
import type { IdReseau } from "./types";

export interface CompteEnvoi {
  id: string;
  nom: string;
  /** « profile », « page »… tel que Buffer le dit. */
  genre?: string;
}

/** Par réseau, ce que la feuille sait des comptes (lu en base, jamais chez Buffer à l'affichage). */
export interface ComptesReseauEnvoi {
  /** Le seul compte où part le réseau. */
  nom?: string;
  /** Ce qui empêche le réseau de partir. */
  probleme?: string;
  /** Comptes à cocher à chaque envoi (plusieurs comptes, ou le seul resté connecté parmi plusieurs). */
  choix?: CompteEnvoi[];
  /** Un compte du réseau est déconnecté (nommé) : les autres restent à cocher. */
  avertissement?: string;
  /** Le dernier choix mémorisé (identifiants), coché par défaut. */
  memorises?: string[];
}

export type ComptesEnvoi = Partial<Record<IdReseau, ComptesReseauEnvoi>>;

export interface CaseEnvoi {
  /** `linkedin` (un seul compte) ou `linkedin:<compte>` (une case par compte). */
  cle: string;
  reseau: IdReseau;
  canalId?: string;
  libelle: string;
  /** Genre du compte (« Profil », « Page »), pour distinguer deux comptes. */
  detail?: string;
}

const GENRES: Record<string, string> = { profile: "Profil", page: "Page", business: "Compte pro", account: "Compte", channel: "Chaîne", group: "Groupe" };

/** Genre d'un compte en français (« page » → « Page ») ; repli « Compte ». */
export function libelleGenre(genre: string | undefined): string | undefined {
  return genre ? (GENRES[genre] ?? "Compte") : undefined;
}

/** Les cases de la feuille : une par réseau, ou une par compte quand le réseau a des comptes à cocher. */
export function casesEnvoi(reseaux: { reseau: IdReseau; nom: string }[], comptes: ComptesEnvoi | undefined): CaseEnvoi[] {
  return reseaux.flatMap((r): CaseEnvoi[] => {
    const choix = comptes?.[r.reseau]?.choix;
    if (!choix?.length) return [{ cle: r.reseau, reseau: r.reseau, libelle: r.nom }];
    return choix.map((c) => {
      const homonyme = choix.some((x) => x.id !== c.id && x.nom === c.nom);
      const genre = libelleGenre(c.genre);
      return { cle: `${r.reseau}:${c.id}`, reseau: r.reseau, canalId: c.id, libelle: `${r.nom} · ${c.nom}${homonyme && genre ? ` (${genre})` : ""}`, detail: genre };
    });
  });
}

/** Cases cochées à l'ouverture : les réseaux proposés ; pour un réseau à plusieurs comptes, seulement ceux mémorisés. */
export function casesParDefaut(cases: CaseEnvoi[], reseaux: IdReseau[], comptes: ComptesEnvoi | undefined): string[] {
  return cases.filter((c) => reseaux.includes(c.reseau) && (!c.canalId || !!comptes?.[c.reseau]?.memorises?.includes(c.canalId))).map((c) => c.cle);
}

/** Cases cochées → réseaux à envoyer (ordre des cases cochées) et, pour les réseaux à plusieurs comptes, les comptes. */
export function ciblesDepuisCases(cles: string[], cases: CaseEnvoi[]): { reseaux: IdReseau[]; comptes: Partial<Record<IdReseau, string[]>> } {
  const reseaux: IdReseau[] = [];
  const comptes: Partial<Record<IdReseau, string[]>> = {};
  for (const cle of cles) {
    const c = cases.find((x) => x.cle === cle);
    if (!c) continue;
    if (!reseaux.includes(c.reseau)) reseaux.push(c.reseau);
    if (c.canalId && !comptes[c.reseau]?.includes(c.canalId)) comptes[c.reseau] = [...(comptes[c.reseau] ?? []), c.canalId];
  }
  return { reseaux, comptes };
}

/** Nom d'une publication à l'écran : le réseau, et le compte visé s'il est connu (« LinkedIn · Axion-IA.com »). */
export function libelleReseauCompte(nomReseau: string, canalNom: string | undefined): string {
  return canalNom ? `${nomReseau} · ${canalNom}` : nomReseau;
}

/** « 1 compte », « 2 comptes » : un envoi par compte coché (deux LinkedIn = deux comptes, pas deux réseaux). */
export function libelleComptes(n: number): string {
  return `${n} compte${n > 1 ? "s" : ""}`;
}

/** « 1 réseau », « 2 réseaux ». */
export function libelleReseaux(n: number): string {
  return `${n} réseau${n > 1 ? "x" : ""}`;
}
