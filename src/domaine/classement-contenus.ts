/**
 * Index de classement dérivé (PUR) : un contenu qui sort sur N réseaux donne N entrées ; un contenu sans réseau
 * est rangé dans « non précisé » (jamais perdu). Rien n'est stocké : l'index se recalcule à chaque lecture.
 */
import type { IdReseau } from "./types";
import type { TypeContenu } from "./taxonomie-contenu";

export const NON_PRECISE = "non-precise" as const;
export type CleClassement = IdReseau | typeof NON_PRECISE;

export interface ContenuAClasser {
  id: string;
  type: TypeContenu;
  /** Réseaux visés ; absent ou vide = non précisé. */
  reseaux?: readonly IdReseau[];
}

export interface EntreeClassement {
  id: string;
  type: TypeContenu;
  reseau: CleClassement;
}

export interface IndexClassement {
  entrees: EntreeClassement[];
  /** Nombre d'entrées par clé de classement (seules les clés présentes). */
  parReseau: Partial<Record<CleClassement, number>>;
}

export function classerContenus(contenus: readonly ContenuAClasser[]): IndexClassement {
  const entrees: EntreeClassement[] = [];
  const parReseau: Partial<Record<CleClassement, number>> = {};
  for (const c of contenus) {
    const cles: CleClassement[] = c.reseaux && c.reseaux.length > 0 ? [...new Set(c.reseaux)] : [NON_PRECISE];
    for (const reseau of cles) {
      entrees.push({ id: c.id, type: c.type, reseau });
      parReseau[reseau] = (parReseau[reseau] ?? 0) + 1;
    }
  }
  return { entrees, parReseau };
}

export function entreesDuReseau(index: IndexClassement, cle: CleClassement): EntreeClassement[] {
  return index.entrees.filter((e) => e.reseau === cle);
}
