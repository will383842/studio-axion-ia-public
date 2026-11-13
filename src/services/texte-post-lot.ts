/**
 * Textes de publication en lot, sous plafond et sous budget. Le rédacteur est INJECTÉ : aucun appel payant ici, aucun fournisseur par
 * défaut ; sans rédacteur, rien ne s'écrit. Au plus `PLAFOND_TEXTES_LOT` textes par lot ; le budget (en nombre de textes) borne encore
 * plus bas si besoin. Ce qui dépasse est REPORTÉ (jamais écrit, jamais perdu) ; un texte en échec n'arrête pas les autres. Aucun prix.
 */
import { ordreDeFile, type DemandeDeProduction } from "@/domaine/productions/demande";

export const PLAFOND_TEXTES_LOT = 10;

export interface DependancesTextesLot {
  ecrire: (demande: DemandeDeProduction) => Promise<string>;
  /** Nombre de textes que le budget permet encore ; absent : seul le plafond du lot borne. */
  budgetTextes?: number;
  /** Plafond du lot (au plus `PLAFOND_TEXTES_LOT`). */
  plafond?: number;
}

export interface ResultatTextesLot {
  ecrits: { demandeId: string; texte: string }[];
  echecs: { demandeId: string }[];
  reportes: DemandeDeProduction[];
}

export async function demanderTextes(demandes: readonly DemandeDeProduction[], deps: DependancesTextesLot): Promise<ResultatTextesLot> {
  if (typeof deps.ecrire !== "function") throw new Error("Aucun rédacteur de texte relié");
  const plafond = Math.max(0, Math.min(deps.plafond ?? PLAFOND_TEXTES_LOT, PLAFOND_TEXTES_LOT));
  const permis = Math.min(plafond, Math.max(0, Math.floor(deps.budgetTextes ?? plafond)));
  const file = ordreDeFile(demandes);
  const resultat: ResultatTextesLot = { ecrits: [], echecs: [], reportes: file.slice(permis) };
  for (const d of file.slice(0, permis)) {
    try {
      resultat.ecrits.push({ demandeId: d.id, texte: await deps.ecrire(d) });
    } catch {
      resultat.echecs.push({ demandeId: d.id });
    }
  }
  return resultat;
}
