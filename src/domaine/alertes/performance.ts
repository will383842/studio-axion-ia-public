/**
 * RC-15 : alertes de performance A17 (« décolle ») et A16 (« chute »), SANS IA. Fonctions pures : aucune horloge, aucun
 * réseau, aucune base ; les mesures et la médiane du compte sont fournies par l'appelant.
 * Réutilise de RC-14 le type `Niveau` et l'unique fonction de seuil `evaluerSeuil` (seuil.ts).
 * - Moins de 10 relevés : statut « trop tôt », jamais d'alerte.
 * - A17 : vues à H+2 strictement au-dessus de 2 × la médiane du compte.
 * - A16 : les 3 dernières publications chacune strictement sous 50 % de la médiane du compte.
 * Une vue négative est illisible. Une mesure ou une médiane illisible donne « non évalué », jamais un faux vert.
 */
import { evaluerSeuil, type Niveau } from "./seuil";

export type { Niveau } from "./seuil";

/** Seuils de performance (réglables ici, nulle part ailleurs). */
export const SEUILS_PERFORMANCE = {
  relevesMin: 10,
  decolleFacteur: 2,
  chuteFacteur: 0.5,
  chutePublications: 3,
} as const;

export type StatutFiabilite = "fiable" | "trop-tot" | "non-evalue";

export interface PublicationMesuree {
  /** Vues relevées (à H+2 pour A17), ou null si inconnues. */
  vues: number | null;
  /** Nombre de relevés déjà faits pour cette publication. */
  nbReleves: number;
}

export interface ResultatPerformance {
  id: "A17" | "A16";
  niveau: Niveau;
  statut: StatutFiabilite;
  detail: string;
}

const estNombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** Un nombre de vues lisible : fini et jamais négatif. */
const vuesLisibles = (v: unknown): v is number => estNombre(v) && v >= 0;
const mediane_ok = (m: number | null | undefined): m is number => estNombre(m) && m > 0;
const assezDeReleves = (p: PublicationMesuree) => estNombre(p.nbReleves) && p.nbReleves >= SEUILS_PERFORMANCE.relevesMin;

/** Médiane des valeurs lisibles (finies, non négatives) ; null s'il n'y en a aucune. */
export function medianeCompte(valeurs: ReadonlyArray<number | null | undefined>): number | null {
  const v = valeurs.filter(vuesLisibles).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const trop_tot = (id: ResultatPerformance["id"], detail: string): ResultatPerformance => ({ id, niveau: "ok", statut: "trop-tot", detail });
const non_evalue = (id: ResultatPerformance["id"], detail: string): ResultatPerformance => ({ id, niveau: "non-evalue", statut: "non-evalue", detail });

/** Seuils stricts (« plus de », « moins de ») bâtis sur `evaluerSeuil` : strictement au-dessus = pas « au plus ». */
const strictementAuDessus = (valeur: number, seuil: number) => evaluerSeuil(valeur, { seuil, sens: "au-plus" }) === "ok";
const strictementEnDessous = (valeur: number, seuil: number) => evaluerSeuil(valeur, { seuil, sens: "au-moins" }) === "ok";

/** A17 : la publication décolle (plus de 2 fois la médiane du compte à H+2, au moins 10 relevés). */
export function evaluerDecolle(publication: PublicationMesuree, medianeDuCompte: number | null | undefined): ResultatPerformance {
  if (!assezDeReleves(publication)) return trop_tot("A17", `trop tôt : moins de ${SEUILS_PERFORMANCE.relevesMin} relevés`);
  if (!mediane_ok(medianeDuCompte)) return non_evalue("A17", "médiane du compte inconnue");
  if (!vuesLisibles(publication.vues)) return non_evalue("A17", "vues inconnues");
  const limite = SEUILS_PERFORMANCE.decolleFacteur * medianeDuCompte;
  return strictementAuDessus(publication.vues, limite)
    ? { id: "A17", niveau: "alerte", statut: "fiable", detail: `${publication.vues} vues, plus de ${SEUILS_PERFORMANCE.decolleFacteur} fois la médiane (${medianeDuCompte})` }
    : { id: "A17", niveau: "ok", statut: "fiable", detail: `${publication.vues} vues, pas au-delà de ${SEUILS_PERFORMANCE.decolleFacteur} fois la médiane (${medianeDuCompte})` };
}

/** A16 : chute. `recentes` va de la plus ancienne à la plus récente ; seules les 3 dernières comptent. */
export function evaluerChute(recentes: readonly PublicationMesuree[], medianeDuCompte: number | null | undefined): ResultatPerformance {
  const n = SEUILS_PERFORMANCE.chutePublications;
  const trois = recentes.slice(-n);
  if (trois.length < n) return trop_tot("A16", `trop tôt : moins de ${n} publications`);
  if (!trois.every(assezDeReleves)) return trop_tot("A16", `trop tôt : une publication a moins de ${SEUILS_PERFORMANCE.relevesMin} relevés`);
  if (!mediane_ok(medianeDuCompte)) return non_evalue("A16", "médiane du compte inconnue");
  if (!trois.every((p) => vuesLisibles(p.vues))) return non_evalue("A16", "vues inconnues pour au moins une publication");
  const limite = SEUILS_PERFORMANCE.chuteFacteur * medianeDuCompte;
  const toutesEnChute = trois.every((p) => strictementEnDessous(p.vues as number, limite));
  return toutesEnChute
    ? { id: "A16", niveau: "alerte", statut: "fiable", detail: `les ${n} dernières publications sont sous ${SEUILS_PERFORMANCE.chuteFacteur * 100} % de la médiane (${medianeDuCompte})` }
    : { id: "A16", niveau: "ok", statut: "fiable", detail: `pas de chute sur les ${n} dernières publications` };
}
