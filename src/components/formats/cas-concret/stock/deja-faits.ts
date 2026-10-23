/**
 * Page « Déjà faits » : les cas traités (ce que `casTraites` calcule : vidéo allée au bout, pas un essai simulé), mis en forme
 * pour l'écran. PUR : aucun accès à la base ; la page lit les cas traités et passe la carte ici. Les plus récents d'abord.
 */
import type { CasTraite } from "@/domaine/cas-traites";
import { CATALOGUE, casVisibles, type ReglagesVisibilite } from "@/formats/cas-concret/catalogue";
import { RANGEMENT } from "@/formats/cas-concret/stock-metiers";
import { OFFRES_PASTILLES } from "@/components/formats/cas-concret/entree/vue";
import { libelleSecteur } from "./filtres-stock";

export interface CasDejaFait {
  casId: string;
  titre: string;
  /** « Santé · PME · Formation » : seulement ce qui est connu (le secteur et la taille viennent du stock par métier). */
  details: string;
  /** Date lisible (« 09/10/2026 », heure de Paris) ; vide si elle est illisible. */
  date: string;
  /** Absent : la vidéo a été supprimée. */
  videoId?: string;
  /** Faux : le cas n'est plus dans le catalogue (il ne peut pas être remis en stock). */
  auCatalogue: boolean;
}

/** « 09/10/2026 » (heure de Paris) ; vide si la date est illisible. */
export function dateComplete(iso: string | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" }).format(t);
}

/**
 * `reglages` : les mêmes que ceux du compteur de la page (catalogueEtendu, stockMetiers) ; un cas caché par ces réglages n'est ni
 * compté ni listé. Un identifiant absent du catalogue reste listé (sans bouton).
 */
export function listerDejaFaits(traites: ReadonlyMap<string, CasTraite>, reglages: ReglagesVisibilite = { catalogueEtendu: false }): CasDejaFait[] {
  const visibles = new Set(casVisibles(CATALOGUE.map((cas) => ({ cas })), reglages).map((x) => x.cas.id));
  return [...traites]
    .filter(([casId]) => visibles.has(casId) || !CATALOGUE.some((c) => c.id === casId))
    .sort(([, a], [, b]) => (Date.parse(b.le) || 0) - (Date.parse(a.le) || 0))
    .map(([casId, t]) => {
      const cas = CATALOGUE.find((c) => c.id === casId);
      const rang = (RANGEMENT as Record<string, { secteur: string; taille: string } | undefined>)[casId];
      const offre = OFFRES_PASTILLES.find((o) => o.valeur === cas?.offre)?.libelle;
      const details = [rang ? libelleSecteur(rang.secteur) : "", rang?.taille ?? "", offre ?? ""].filter(Boolean).join(" · ");
      return { casId, titre: cas?.titre || t.titre || casId, auCatalogue: !!cas, details, date: dateComplete(t.le), ...(t.videoId ? { videoId: t.videoId } : {}) };
    });
}
