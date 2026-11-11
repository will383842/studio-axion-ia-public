/** Ciblage, lot H : filtres des listes (anciens masqués par défaut, type d'automatisation). Fonctions PURES, lues dans l'adresse. */
import { TYPES_AUTOMATISATION, type MarqueAncien, type TypeAutomatisation } from "./types";

export type FiltreType = TypeAutomatisation | "a-classer";

export interface FiltreCiblage {
  /** Vrai : les anciens scripts sont affichés (masqués par défaut). */
  anciens: boolean;
  type?: FiltreType;
}

export interface ElementCiblable {
  ancien?: MarqueAncien;
  typeAutomatisation?: TypeAutomatisation;
  doublonsPossibles?: readonly string[];
}

type Parametres = Record<string, string | string[] | undefined>;
const premier = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export function lireFiltreCiblage(sp: Parametres): FiltreCiblage {
  const type = premier(sp.type);
  const f: FiltreCiblage = { anciens: premier(sp.anciens) === "1" };
  if (type === "a-classer" || TYPES_AUTOMATISATION.some((t) => t.id === type)) f.type = type as FiltreType;
  return f;
}

export function filtrerParCiblage<E extends ElementCiblable>(liste: readonly E[], f: FiltreCiblage): E[] {
  return liste.filter((e) => (f.anciens || !e.ancien) && (!f.type || (f.type === "a-classer" ? !e.typeAutomatisation : e.typeAutomatisation === f.type)));
}

export const compterAnciens = (liste: readonly ElementCiblable[]): number => liste.filter((e) => !!e.ancien).length;

export const estDoublonPossible = (e: ElementCiblable): boolean => !!e.doublonsPossibles?.length;

/** Adresse avec un changement ; `undefined` retire le paramètre, les autres sont gardés. */
export function lienCiblage(base: string, params: Parametres, changement: { anciens?: string; type?: string }): string {
  const q = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params)) {
    const v = premier(valeur);
    if (v && !(cle in changement)) q.set(cle, v);
  }
  for (const [cle, valeur] of Object.entries(changement)) if (valeur) q.set(cle, valeur);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
