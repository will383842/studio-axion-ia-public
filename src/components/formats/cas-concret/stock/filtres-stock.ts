/**
 * FILTRES DU STOCK DES CAS (lots K4 et K5) : lecture des paramètres de lien, adresses des filtres, groupes d'options.
 * PUR et léger (importé par l'écran de choix, côté navigateur) : aucun accès au serveur, aucun schéma lourd.
 */
import { OFFRES_PASTILLES } from "@/components/formats/cas-concret/entree/vue";
import { ETATS_STOCK, type CompteursStock, type EtatStock, type FiltresStock } from "@/services/cas-concret-stock-synthese";

/** Cas par page de la liste du stock. */
export const PAR_PAGE = 20;

/** Tailles connues (un test vérifie qu'elles restent celles du rangement). */
export const TAILLES_FILTRE = ["TPE", "PME", "ETI"] as const;

/** Libellés des secteurs du rangement ; le CODE reste la valeur (et l'adresse), le libellé est ce qu'on lit. */
export const LIBELLES_SECTEURS: Record<string, string> = {
  IN: "Industrie",
  LT: "Logistique et transport",
  NB: "Négoce et location B2B",
  BT: "Bâtiment",
  AS: "Artisanat et services",
  DG: "Dirigeant et services B2B",
};
/** Le libellé d'un secteur ; un code inconnu reste tel quel. */
export const libelleSecteur = (c: string): string => LIBELLES_SECTEURS[c] ?? c;

export const LIBELLES_ETATS: Record<EtatStock, string> = { restant: "Restants", traite: "Déjà faits", "a-valider": "À valider", valide: "Validés" };

export interface OptionFiltre {
  valeur: string;
  libelle: string;
  /** Nombre de cas (absent : non montré). */
  nombre?: number;
}
export interface GroupeFiltre {
  cle: keyof FiltresStock;
  libelle: string;
  options: OptionFiltre[];
}

export interface ParamsStock {
  filtres: FiltresStock;
  /** Page demandée (à partir de 1) ; le composant la ramène à la dernière page existante. */
  page: number;
  /** Vrai quand l'adresse vient du tableau (marqueur `vue=stock`) : le bloc reste ouvert même sans filtre ni page. */
  ouvert: boolean;
}

type ParamsBruts = Record<string, string | string[] | undefined> | undefined;
const premier = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Lit `?secteur=IN&taille=PME&offre=integration&etat=restant&page=2&vue=stock` ; toute valeur inconnue est ignorée, sans erreur. */
export function lireParamsStock(brut: ParamsBruts, secteursConnus: readonly string[]): ParamsStock {
  const filtres: FiltresStock = {};
  const secteur = premier(brut?.secteur);
  if (secteur && secteursConnus.includes(secteur)) filtres.secteur = secteur;
  const taille = premier(brut?.taille);
  if (taille && (TAILLES_FILTRE as readonly string[]).includes(taille)) filtres.taille = taille;
  const offre = premier(brut?.offre);
  if (offre && OFFRES_PASTILLES.some((o) => o.valeur === offre && o.valeur !== "tous")) filtres.offre = offre;
  const etat = premier(brut?.etat);
  if (etat && (ETATS_STOCK as readonly string[]).includes(etat)) filtres.etat = etat as EtatStock;
  const n = Number(premier(brut?.page));
  return { filtres, page: Number.isInteger(n) && n >= 1 ? n : 1, ouvert: premier(brut?.vue) === "stock" };
}

/** L'adresse d'un jeu de filtres (page 1 par défaut), qui retombe sur le bloc du stock. */
export function lienStock(filtres: FiltresStock, page = 1): string {
  const p = new URLSearchParams();
  if (filtres.secteur) p.set("secteur", filtres.secteur);
  if (filtres.taille) p.set("taille", filtres.taille);
  if (filtres.offre) p.set("offre", filtres.offre);
  if (filtres.etat) p.set("etat", filtres.etat);
  if (page > 1) p.set("page", String(page));
  p.set("vue", "stock");
  return `/cas-concret?${p.toString()}#stock`;
}

const libelleOffre = (o: string): string => OFFRES_PASTILLES.find((x) => x.valeur === o)?.libelle ?? o;
const trier = (cles: string[]): string[] => [...cles].sort((a, b) => a.localeCompare(b, "fr"));
const trierSecteurs = (cles: string[]): string[] => [...cles].sort((a, b) => libelleSecteur(a).localeCompare(libelleSecteur(b), "fr"));

/** Les groupes du tableau de bord : un par secteur, taille, offre et état, avec leurs compteurs (les valeurs à zéro sont omises). */
export function groupesDepuisCompteurs(c: CompteursStock): GroupeFiltre[] {
  const groupes: GroupeFiltre[] = [
    { cle: "secteur", libelle: "Secteur", options: trierSecteurs(Object.keys(c.parSecteur)).map((v) => ({ valeur: v, libelle: libelleSecteur(v), nombre: c.parSecteur[v] })) },
    { cle: "taille", libelle: "Taille", options: TAILLES_FILTRE.filter((t) => c.parTaille[t]).map((v) => ({ valeur: v, libelle: v, nombre: c.parTaille[v] })) },
    { cle: "offre", libelle: "Offre", options: trier(Object.keys(c.parOffre)).map((v) => ({ valeur: v, libelle: libelleOffre(v), nombre: c.parOffre[v] })) },
    { cle: "etat", libelle: "État", options: ETATS_STOCK.map((v) => ({ valeur: v, libelle: LIBELLES_ETATS[v], nombre: c.parEtat[v] })) },
  ];
  return groupes.filter((g) => g.options.length > 0);
}
