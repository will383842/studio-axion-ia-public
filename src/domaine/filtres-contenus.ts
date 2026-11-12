/**
 * Filtres et pagination de « Mes contenus » (PUR). Rien n'est stocké : tout se recalcule à chaque lecture.
 * Le filtre par réseau passe par l'index de classement (un contenu sans réseau est « non précisé », jamais perdu).
 */
import { classerContenus, type CleClassement } from "./classement-contenus";
import type { StatutCommun, TypeContenu } from "./taxonomie-contenu";
import type { IdReseau } from "./types";

export interface ContenuBibliotheque {
  id: string;
  type: TypeContenu;
  titre: string;
  statut: StatutCommun;
  reseaux: readonly IdReseau[];
  modifieLe: string;
  vignetteUrl?: string;
}

export interface FiltresContenus {
  type?: TypeContenu;
  reseau?: CleClassement;
  statut?: StatutCommun;
}

export const PAR_PAGE_DEFAUT = 24;

export function filtrerContenus(contenus: readonly ContenuBibliotheque[], filtres: FiltresContenus): ContenuBibliotheque[] {
  const idsDuReseau = filtres.reseau
    ? new Set(classerContenus(contenus).entrees.filter((e) => e.reseau === filtres.reseau).map((e) => e.id))
    : null;
  return contenus.filter(
    (c) => (!filtres.type || c.type === filtres.type) && (!filtres.statut || c.statut === filtres.statut) && (!idsDuReseau || idsDuReseau.has(c.id)),
  );
}

/** Tri total : plus récent d'abord, puis identifiant (deux lectures successives donnent le même ordre). */
export function trierContenus(contenus: readonly ContenuBibliotheque[]): ContenuBibliotheque[] {
  return [...contenus].sort((a, b) => b.modifieLe.localeCompare(a.modifieLe) || a.id.localeCompare(b.id));
}

export interface PageContenus {
  elements: ContenuBibliotheque[];
  total: number;
  page: number;
  pages: number;
}

export function paginerContenus(contenus: readonly ContenuBibliotheque[], page = 1, parPage = PAR_PAGE_DEFAUT): PageContenus {
  const taille = Number.isFinite(parPage) && parPage >= 1 ? Math.floor(parPage) : PAR_PAGE_DEFAUT;
  const triees = trierContenus(contenus);
  const pages = Math.max(1, Math.ceil(triees.length / taille));
  const courante = Math.min(Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1), pages);
  return { elements: triees.slice((courante - 1) * taille, courante * taille), total: triees.length, page: courante, pages };
}
