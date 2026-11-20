/**
 * T-EXT-37b : RELEVÉ de l'essai réel du pilote 05 Stocks. Pur : aucun accès base, fichier ni réseau ; les chiffres de
 * la vidéo sont passés en paramètre. Il compare le devis (un PLAFOND en quantités, T-EXT-42), ce qui a été consommé, la
 * dépense Claude réelle (contre le plafond par vidéo), les formats, la durée et la grille de qualité.
 * Ce module n'écrit rien et ne dépense rien : il ne fait que dire « conforme » ou « à revoir », en français simple.
 */

import { DUREE_CIBLE_SEC } from "../../../src/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";

/** Durée visée du tutoriel hors carte de fin, en secondes (décision 3 de Williams : 40 à 55 s). Une seule source : `DUREE_CIBLE_SEC`. */
export const DUREE_MIN_SEC: number = DUREE_CIBLE_SEC[0];
export const DUREE_MAX_SEC: number = DUREE_CIBLE_SEC[1];
/** Les trois formats de la décision 3 (4:5 principal, 9:16, 1:1). */
export const RATIOS_ATTENDUS = ["4:5", "9:16", "1:1"] as const;

export interface Quantites {
  appelsClaude: number;
  caracteresVoix: number;
  rendus: number;
}

export interface DepenseReelle {
  etape: string;
  fournisseur: string;
  centimes: number;
}

export interface EssaiReleve {
  /** Le devis montré avant la dépense : un plafond en quantités. */
  devis: Quantites;
  /** Ce qui a réellement été consommé. */
  consomme: Quantites;
  depensesReelles: readonly DepenseReelle[];
  /** Plafond Claude par vidéo (décision 6), en centimes. */
  plafondClaudeCentimes: number;
  dureeSec: number;
  ratios: readonly string[];
  grille: { note: number; proposable: boolean; criteres: readonly unknown[] };
}

export interface ReleveEssai {
  verdict: "conforme" | "a-revoir";
  ecarts: string[];
}

const LIBELLES: Record<keyof Quantites, [string, string]> = {
  appelsClaude: ["appel à l'assistant d'écriture", "appels à l'assistant d'écriture"],
  caracteresVoix: ["caractère de voix", "caractères de voix"],
  rendus: ["rendu vidéo", "rendus vidéo"],
};

const nombreValide = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function releverEssai(e: EssaiReleve): ReleveEssai {
  const ecarts: string[] = [];

  for (const cle of Object.keys(LIBELLES) as (keyof Quantites)[]) {
    const prevu = e.devis[cle];
    const reel = e.consomme[cle];
    if (!nombreValide(prevu) || !nombreValide(reel)) {
      ecarts.push(`Le chiffre « ${LIBELLES[cle][1]} » est manquant : impossible de comparer au devis.`);
    } else if (reel > prevu) {
      ecarts.push(`Plus que le devis : ${reel} ${LIBELLES[cle][reel > 1 ? 1 : 0]} consommés pour ${prevu} annoncés.`);
    }
  }

  // Le Studio inscrit les dépenses de Claude sous « anthropic » (et parfois « claude ») : même règle que `idFournisseur` (src/domaine/credits.ts).
  const estClaude = (f: unknown): boolean => typeof f === "string" && ["anthropic", "claude"].includes(f.trim().toLowerCase());
  const lignesClaude = e.depensesReelles.filter((d) => estClaude(d.fournisseur));
  if (lignesClaude.some((d) => !nombreValide(d.centimes) || d.centimes < 0)) ecarts.push("Un chiffre de dépense de l'assistant d'écriture est illisible : impossible de comparer au plafond.");
  const claude = lignesClaude.reduce((s, d) => s + (nombreValide(d.centimes) ? d.centimes : 0), 0);
  if (!nombreValide(e.plafondClaudeCentimes) || e.plafondClaudeCentimes < 0) ecarts.push("Le plafond de dépense de l'assistant d'écriture est illisible : impossible de comparer.");
  else if (claude > e.plafondClaudeCentimes) ecarts.push("La dépense de l'assistant d'écriture dépasse le plafond fixé pour cette vidéo.");

  for (const r of RATIOS_ATTENDUS) if (!e.ratios.includes(r)) ecarts.push(`Il manque le format ${r}.`);

  if (!nombreValide(e.dureeSec)) ecarts.push("La durée de la vidéo est inconnue.");
  else if (e.dureeSec < DUREE_MIN_SEC || e.dureeSec > DUREE_MAX_SEC) ecarts.push(`La vidéo dure ${Math.round(e.dureeSec * 10) / 10} s : elle devrait durer de ${DUREE_MIN_SEC} à ${DUREE_MAX_SEC} s.`);

  if (!e.grille.proposable) ecarts.push(`La grille de qualité ne propose pas la vidéo (note ${e.grille.note} sur 100) : des points sont à revoir.`);

  return { verdict: ecarts.length ? "a-revoir" : "conforme", ecarts };
}
