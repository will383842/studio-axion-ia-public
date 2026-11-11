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
  const type = premier(sp.typeAuto);
  const f: FiltreCiblage = { anciens: premier(sp.anciens) === "1" };
  if (type === "a-classer" || TYPES_AUTOMATISATION.some((t) => t.id === type)) f.type = type as FiltreType;
  return f;
}

export function filtrerParCiblage<E extends ElementCiblable>(liste: readonly E[], f: FiltreCiblage): E[] {
  return liste.filter((e) => (f.anciens || !e.ancien) && (!f.type || (f.type === "a-classer" ? !e.typeAutomatisation : e.typeAutomatisation === f.type)));
}

export const compterAnciens = (liste: readonly ElementCiblable[]): number => liste.filter((e) => !!e.ancien).length;

/** Doublon possible seulement si au moins un script jumeau existe encore (un jumeau supprimé n'est plus signalé). */
export const estDoublonPossible = (e: ElementCiblable, existants: ReadonlySet<string>): boolean => !!e.doublonsPossibles?.some((id) => existants.has(id));

/** Filtre par type la liste principale des sujets (le type vit dans le brief du sujet). Les anciens ne concernent que les scripts. */
export function filtrerSujetsParType<S extends { maitre: { brief: { typeAutomatisation?: TypeAutomatisation } } }>(sujets: readonly S[], f: FiltreCiblage): S[] {
  if (!f.type) return [...sujets];
  return sujets.filter((s) => (f.type === "a-classer" ? !s.maitre.brief.typeAutomatisation : s.maitre.brief.typeAutomatisation === f.type));
}

/** Adresse avec un changement ; `undefined` retire le paramètre, les autres sont gardés. */
export function lienCiblage(base: string, params: Parametres, changement: { anciens?: string; typeAuto?: string }): string {
  const q = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params)) {
    const v = premier(valeur);
    if (v && !(cle in changement)) q.set(cle, v);
  }
  for (const [cle, valeur] of Object.entries(changement)) if (valeur) q.set(cle, valeur);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
