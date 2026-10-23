/**
 * « PROPOSEZ-MOI UN CAS RESTANT » (lot K5) et filtres du stock dans l'écran de choix. PUR et déterministe : aucun appel,
 * aucune dépense, aucun hasard. Le résultat sert seulement à OUVRIR la feuille « Votre vidéo » ; l'anti-doublon côté
 * serveur reste le garde-fou (un cas devenu « traité » entre-temps est arrêté avant le prix).
 */
import type { EtatStock, FiltresStock } from "@/services/cas-concret-stock-synthese";
import type { GroupeFiltre } from "@/components/formats/cas-concret/stock/filtres-stock";
import { LIBELLES_ETATS, libelleSecteur, TAILLES_FILTRE } from "@/components/formats/cas-concret/stock/filtres-stock";
import type { VueCas } from "./vue";

export type CasPiochable = Pick<VueCas, "id" | "offre" | "valide" | "stock">;

/** Les états d'un cas de l'écran (mêmes règles que `etatsDuCas` du stock). */
const etatsDe = (c: CasPiochable): EtatStock[] => [c.stock?.traite ? "traite" : "restant", c.valide ? "valide" : "a-valider"];

/** Chaque filtre donné se COMBINE (« et »). Un cas sans rangement ne passe aucun filtre de secteur ou de taille. */
export function correspondAuxFiltres(c: CasPiochable, f: FiltresStock): boolean {
  return (
    (!f.secteur || c.stock?.secteur === f.secteur) &&
    (!f.taille || c.stock?.taille === f.taille) &&
    (!f.offre || c.offre === f.offre) &&
    (!f.etat || etatsDe(c).includes(f.etat))
  );
}

export function filtrerCas<T extends CasPiochable>(cas: readonly T[], f: FiltresStock): T[] {
  return Object.values(f).some(Boolean) ? cas.filter((c) => correspondAuxFiltres(c, f)) : [...cas];
}

/** Ordre des numéros de fiche (« IN-02 » avant « IN-10 ») ; les cas sans fiche viennent après, dans leur ordre d'origine. */
function parFiche<T extends CasPiochable>(cas: readonly T[]): T[] {
  return cas
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const fa = a.c.stock?.fiche;
      const fb = b.c.stock?.fiche;
      if (fa && fb) return fa.localeCompare(fb, "fr", { numeric: true }) || a.i - b.i;
      if (fa) return -1;
      if (fb) return 1;
      return a.i - b.i;
    })
    .map((x) => x.c);
}

export interface CasPioche<T> {
  cas: T;
  /** Vrai : le script n'est pas validé, la feuille s'ouvre en ESSAI (comme « Essayer » sur un cas à valider). */
  essai: boolean;
}

/**
 * Le premier cas VALIDÉ non traité du filtre (ordre des fiches) ; à défaut, le premier cas à valider non traité, en essai ;
 * `null` s'il ne reste rien. Le filtre d'état est ignoré : on cherche toujours un cas restant.
 */
export function piocherCas<T extends CasPiochable>(valides: readonly T[], aValider: readonly T[], filtres: FiltresStock): CasPioche<T> | null {
  const { etat: _etat, ...sansEtat } = filtres;
  void _etat;
  const restants = (liste: readonly T[]) => parFiche(filtrerCas(liste, sansEtat).filter((c) => !c.stock?.traite));
  const v = restants(valides)[0];
  if (v) return { cas: v, essai: false };
  const a = restants(aValider)[0];
  return a ? { cas: a, essai: true } : null;
}

export const PHRASE_AUCUN_RESTANT = "Aucun cas restant pour ces filtres. Changez de filtre ou revenez à tous les cas.";

/** Les groupes de filtres de l'écran de choix, d'après les cas présents (sans compteur) ; l'offre a ses pastilles à part ; l'état se limite à « restants » et « déjà traités ». */
export function groupesDepuisCas(cas: readonly CasPiochable[]): GroupeFiltre[] {
  const secteurs = [...new Set(cas.flatMap((c) => (c.stock?.secteur ? [c.stock.secteur] : [])))].sort((a, b) => libelleSecteur(a).localeCompare(libelleSecteur(b), "fr"));
  const tailles = TAILLES_FILTRE.filter((t) => cas.some((c) => c.stock?.taille === t));
  const groupes: GroupeFiltre[] = [
    { cle: "secteur", libelle: "Secteur", options: secteurs.map((v) => ({ valeur: v, libelle: libelleSecteur(v) })) },
    { cle: "taille", libelle: "Taille", options: tailles.map((v) => ({ valeur: v, libelle: v })) },
    { cle: "etat", libelle: "État", options: (["restant", "traite"] as const).map((v) => ({ valeur: v, libelle: LIBELLES_ETATS[v] })) },
  ];
  return groupes.filter((g) => g.options.length > 0);
}
