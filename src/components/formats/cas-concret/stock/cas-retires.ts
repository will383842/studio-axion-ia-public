/**
 * Page « Cas retirés » : les cas que Will a retirés (ce que `casRetires` calcule), mis en forme pour l'écran. PUR : aucun accès
 * à la base ; la page lit le réglage et passe la carte ici. Les plus récemment retirés d'abord.
 */
import { estRetire, type RetraitCas } from "@/domaine/cas-retires";
import { CATALOGUE, casVisibles, type ReglagesVisibilite } from "@/formats/cas-concret/catalogue";
import { RANGEMENT } from "@/formats/cas-concret/stock-metiers";
import { OFFRES_PASTILLES } from "@/components/formats/cas-concret/entree/vue";
import { libelleSecteur } from "./filtres-stock";
import { dateComplete } from "./deja-faits";

export interface CasRetire {
  casId: string;
  titre: string;
  /** « Santé · PME · Formation » : seulement ce qui est connu. */
  details: string;
  /** Date lisible (« 24/10/2026 », heure de Paris) ; vide si elle est illisible. */
  date: string;
  /** Faux : le cas n'est plus dans le catalogue (il ne peut plus être remis). */
  auCatalogue: boolean;
}

/**
 * `reglages` : les mêmes que ceux de la page (catalogueEtendu, stockMetiers) ; un cas caché par ces réglages n'est pas listé.
 * Un identifiant absent du catalogue reste listé (sans bouton) : son retrait est gardé, il n'existe plus.
 */
export function listerCasRetires(retraits: Record<string, Partial<RetraitCas> | undefined>, reglages: ReglagesVisibilite = { catalogueEtendu: false }): CasRetire[] {
  const visibles = new Set(casVisibles(CATALOGUE.map((cas) => ({ cas })), reglages).map((x) => x.cas.id));
  return Object.entries(retraits)
    .filter(([, r]) => estRetire(r))
    .filter(([casId]) => visibles.has(casId) || !CATALOGUE.some((c) => c.id === casId))
    .sort(([, a], [, b]) => (Date.parse(b!.retireLe!) || 0) - (Date.parse(a!.retireLe!) || 0))
    .map(([casId, r]) => {
      const cas = CATALOGUE.find((c) => c.id === casId);
      const rang = (RANGEMENT as Record<string, { secteur: string; taille: string } | undefined>)[casId];
      const offre = OFFRES_PASTILLES.find((o) => o.valeur === cas?.offre)?.libelle;
      const details = [rang ? libelleSecteur(rang.secteur) : "", rang?.taille ?? "", offre ?? ""].filter(Boolean).join(" · ");
      return { casId, titre: cas?.titre || r?.titre || casId, auCatalogue: !!cas, details, date: dateComplete(r?.retireLe) };
    });
}
