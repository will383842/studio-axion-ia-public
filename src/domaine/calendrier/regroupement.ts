import { RESEAUX_CALENDRIER } from "@/components/calendrier/BarreFiltres";
import { TYPES_CONTENU, nomReseau, trierEntrees, type EntreeCarte, type TypeContenu } from "@/components/calendrier/CarteEntreeCalendrier";
import type { IdReseau } from "@/domaine/types";

/** Filtres combinables du calendrier. Un groupe vide ne filtre pas ; entre groupes c'est « et », dans un groupe « ou ». */
export interface CriteresFiltre {
  /** Réseaux gardés. Absent : tous. Liste vide : aucun (tout est masqué). */
  reseaux?: readonly IdReseau[];
  types: readonly TypeContenu[];
  /** États gardés (mots de la table d'états). */
  etats: readonly string[];
  /** Mot cherché dans le titre, sans tenir compte des majuscules ni des accents. */
  motCle?: string;
}

const simplifier = (texte: string) => texte.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr-FR").trim();

/** Ne garde que les cartes qui passent tous les filtres. Ne modifie pas la liste reçue ; l'ordre est conservé. */
export function filtrerEntrees<T extends Pick<EntreeCarte, "reseau" | "type" | "etat" | "titre">>(entrees: readonly T[], criteres: CriteresFiltre): T[] {
  const mot = simplifier(criteres.motCle ?? "");
  return entrees.filter(
    (e) =>
      (criteres.reseaux === undefined || criteres.reseaux.includes(e.reseau)) &&
      (criteres.types.length === 0 || criteres.types.includes(e.type)) &&
      (criteres.etats.length === 0 || criteres.etats.includes(e.etat)) &&
      (mot === "" || simplifier(e.titre ?? "").includes(mot)),
  );
}

/** Nombre de filtres actifs hors réseaux (ceux de « Effacer les filtres (N) ») : types, états, et le mot cherché. */
export function nombreFiltres(criteres: CriteresFiltre): number {
  return criteres.types.length + criteres.etats.length + (simplifier(criteres.motCle ?? "") === "" ? 0 : 1);
}

/** Ajoute la valeur si elle manque, la retire sinon. Ne modifie pas la liste reçue. */
export function basculer<T>(liste: readonly T[], valeur: T): T[] {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
}

export type RegroupementPar = "reseau" | "type" | "jour";

export interface GroupeEntrees {
  cle: string;
  libelle: string;
  entrees: EntreeCarte[];
}

const ORDRE_TYPES = Object.keys(TYPES_CONTENU);

/**
 * Regroupe par réseau (ordre de la maquette, puis les autres), par type (Vidéo, Carrousel, Infographie, Image) ou par jour.
 * Chaque groupe est trié par jour puis heure ; une carte est dans un seul groupe ; aucun groupe vide.
 */
export function regrouper(entrees: readonly EntreeCarte[], par: RegroupementPar): GroupeEntrees[] {
  const groupes = new Map<string, EntreeCarte[]>();
  for (const e of trierEntrees(entrees)) {
    const cle = par === "reseau" ? e.reseau : par === "type" ? e.type : e.jour;
    groupes.set(cle, [...(groupes.get(cle) ?? []), e]);
  }
  const rang = (cle: string) => {
    const liste: readonly string[] = par === "reseau" ? RESEAUX_CALENDRIER : par === "type" ? ORDRE_TYPES : [];
    return liste.includes(cle) ? liste.indexOf(cle) : liste.length;
  };
  return [...groupes.entries()]
    .sort(([a], [b]) => rang(a) - rang(b) || (par === "jour" ? a.localeCompare(b) : 0))
    .map(([cle, liste]) => ({ cle, libelle: par === "reseau" ? nomReseau(cle as IdReseau) : par === "type" ? (TYPES_CONTENU[cle as TypeContenu]?.libelle ?? "Autre") : cle, entrees: liste }));
}

/** Garde les `max` premières cartes et compte le reste. `max` doit être un entier de 1 au moins, sinon rien n'est replié. */
export function replier<T>(entrees: readonly T[], max: number | undefined): { visibles: T[]; reste: number } {
  if (max === undefined || !Number.isInteger(max) || max < 1 || entrees.length <= max) return { visibles: [...entrees], reste: 0 };
  return { visibles: entrees.slice(0, max), reste: entrees.length - max };
}

/** Nombre de publications par jour (une même clé n'est comptée qu'une fois). */
export function chargeParJour(entrees: readonly Pick<EntreeCarte, "cle" | "jour">[]): Record<string, number> {
  const vues = new Set<string>();
  const charge: Record<string, number> = {};
  for (const e of entrees) {
    if (vues.has(e.cle)) continue;
    vues.add(e.cle);
    charge[e.jour] = (charge[e.jour] ?? 0) + 1;
  }
  return charge;
}

