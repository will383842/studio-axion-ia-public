/**
 * Liste « À publier » séparée par réseau : une ligne par vidéo ET par réseau (une vidéo prévue pour deux réseaux apparaît
 * dans les deux listes, chacune avec l'état de CE réseau). Pure mise en forme : aucune règle d'envoi ici, le serveur garde
 * toutes ses gardes. Le regroupement par vidéo reste celui de regrouper-a-publier.ts.
 */
import type { IdReseau } from "@/domaine/types";
import { listerReseaux } from "@/reseaux";
import type { LigneAPublier } from "@/services/a-publier";
import { FILTRE_PAR_DEFAUT, TRANCHE, type CategorieEtat, type EtatListe, type FiltreListe } from "./liste-a-publier";
import { raisonPasPret } from "./regrouper-a-publier";

export type ReseauListe = IdReseau | "tous";
export const RESEAU_PAR_DEFAUT: ReseauListe = "tous";

/** L'état d'UNE vidéo sur UN réseau, avec la raison courte quand elle n'est pas prête. */
export interface EtatReseau extends Omit<EtatListe, "categorie"> {
  categorie: CategorieEtat | "pas-pret" | "essai";
  raison?: string;
}

export interface LigneReseau {
  ligne: LigneAPublier;
  etat: EtatReseau;
  /** Format du fichier de CE réseau (« 4:5 », « 9:16 »), si la taille est connue. */
  format: string | null;
}

const PROBLEMES = new Set(["Échec", "À vérifier"]);

/** État de la vidéo sur ce réseau, déduit de ce que la page savait déjà (mêmes règles que la liste par vidéo). */
export function etatDeLigne(l: LigneAPublier): EtatReseau {
  const raison = l.blocageVideo ? l.blocage : raisonPasPret(l);
  if (!raison) {
    if (!l.etat || !l.etat.envoye) return { categorie: "a-envoyer", libelle: "À envoyer", ton: "orange" };
  } else if (!l.etat) {
    // Vidéo d'essai ou d'exemple : sa propre catégorie, jamais comptée comme problème ni mêlée aux « Pas prêt ».
    if (l.blocageVideo) return { categorie: "essai", libelle: /exemple/i.test(raison) ? "Exemple" : "Essai", ton: "neutre", raison };
    return { categorie: "pas-pret", libelle: "Pas prêt", ton: "neutre", raison };
  }
  const e = l.etat!;
  if (PROBLEMES.has(e.libelle)) return { categorie: "probleme", libelle: "Problème", ton: "brique", ...(raison ? { raison } : {}) };
  if (e.libelle === "Publiée") return { categorie: "publiee", libelle: "Publiée", ton: "sauge" };
  return { categorie: "envoyee", libelle: e.libelle, ton: e.ton };
}

const RATIOS: [string, number][] = [["9:16", 9 / 16], ["4:5", 4 / 5], ["1:1", 1], ["3:4", 3 / 4], ["16:9", 16 / 9]];

/** « 1080x1350 » -> « 4:5 » : le ratio usuel le plus proche (à 3 % près), sinon rien. */
export function formatDe(d: LigneAPublier["dimensions"] | undefined | null): string | null {
  if (!d || d.largeur <= 0 || d.hauteur <= 0) return null;
  const r = d.largeur / d.hauteur;
  const [nom] = RATIOS.reduce((m, x) => (Math.abs(x[1] - r) < Math.abs(m[1] - r) ? x : m));
  const cible = RATIOS.find((x) => x[0] === nom)![1];
  return Math.abs(cible - r) / cible <= 0.03 ? nom : null;
}

const RANG: Record<EtatReseau["categorie"], number> = { "a-envoyer": 0, probleme: 1, "pas-pret": 2, essai: 3, envoyee: 4, publiee: 5 };

export function lignesParReseau(lignes: LigneAPublier[]): LigneReseau[] {
  return lignes
    .map((ligne) => ({ ligne, etat: etatDeLigne(ligne), format: formatDe(ligne.dimensions) }))
    .sort((a, b) => RANG[a.etat.categorie] - RANG[b.etat.categorie] || (b.ligne.creeLe ?? "").localeCompare(a.ligne.creeLe ?? "") || a.ligne.videoId.localeCompare(b.ligne.videoId));
}

/** Les réseaux qui ont au moins une vidéo, dans l'ordre du registre. */
export function reseauxPresents(lignes: LigneAPublier[]): IdReseau[] {
  const vus = new Set(lignes.map((l) => l.reseau));
  return listerReseaux().map((r) => r.id).filter((id) => vus.has(id));
}

export function reseauDepuis(brut: string | undefined, presents: IdReseau[]): ReseauListe {
  return presents.includes(brut as IdReseau) ? (brut as IdReseau) : RESEAU_PAR_DEFAUT;
}

export function deCeReseau(lignes: LigneReseau[], reseau: ReseauListe): LigneReseau[] {
  return reseau === "tous" ? lignes : lignes.filter((l) => l.ligne.reseau === reseau);
}

export function filtrerReseau(lignes: LigneReseau[], filtre: FiltreListe): LigneReseau[] {
  if (filtre === "toutes") return lignes;
  const voulue = filtre === "a-envoyer" ? "a-envoyer" : filtre === "envoyees" ? "envoyee" : filtre === "problemes" ? "probleme" : "publiee";
  return lignes.filter((l) => l.etat.categorie === voulue);
}

export interface CompteursReseau {
  aEnvoyer: number;
  envoyees: number;
  publiees: number;
  problemes: number;
  essais: number;
  toutes: number;
}

export function compterReseau(lignes: LigneReseau[]): CompteursReseau {
  const n = (c: EtatReseau["categorie"]) => lignes.filter((l) => l.etat.categorie === c).length;
  return { aEnvoyer: n("a-envoyer"), envoyees: n("envoyee"), publiees: n("publiee"), problemes: n("probleme"), essais: n("essai"), toutes: lignes.length };
}

/** Un compteur par réseau, pour les onglets (plus « Tous »). */
export function compteursParReseau(lignes: LigneReseau[], presents: IdReseau[]): Record<ReseauListe, CompteursReseau> {
  return { tous: compterReseau(lignes), ...(Object.fromEntries(presents.map((r) => [r, compterReseau(deCeReseau(lignes, r))])) as Record<IdReseau, CompteursReseau>) };
}

/** Sections de la vue « Tous » : un titre par réseau, jamais mélangé. Pagination par section. */
export function sectionsParReseau(lignes: LigneReseau[], presents: IdReseau[]): { reseau: IdReseau; lignes: LigneReseau[] }[] {
  return presents.map((reseau) => ({ reseau, lignes: deCeReseau(lignes, reseau) })).filter((s) => s.lignes.length);
}

function requete(filtre: FiltreListe, affichees: number, reseau: ReseauListe, plus?: Record<string, string>): string {
  const q = new URLSearchParams();
  if (reseau !== RESEAU_PAR_DEFAUT) q.set("reseau", reseau);
  if (filtre !== FILTRE_PAR_DEFAUT) q.set("filtre", filtre);
  if (affichees > TRANCHE) q.set("n", String(affichees));
  for (const [k, v] of Object.entries(plus ?? {})) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Adresse de la liste d'un réseau : réseau, filtre et nombre de vidéos gardés (les valeurs par défaut ne sont pas écrites). */
export function lienListeReseau(reseau: ReseauListe, filtre: FiltreListe, affichees = TRANCHE): string {
  return `/a-publier${requete(filtre, affichees, reseau)}`;
}

/**
 * Détail d'une vidéo, ouvert sur CE réseau. `depuisTous` : la liste d'origine était la vue Tous, le retour y revient
 * (sinon il revient à la liste du réseau).
 */
export function lienDetailReseau(videoId: string, reseau: IdReseau, filtre: FiltreListe, affichees = TRANCHE, depuisTous = false): string {
  const q = new URLSearchParams({ reseau });
  if (depuisTous) q.set("liste", "tous");
  if (filtre !== FILTRE_PAR_DEFAUT) q.set("filtre", filtre);
  if (affichees > TRANCHE) q.set("n", String(affichees));
  return `/a-publier/${encodeURIComponent(videoId)}?${q.toString()}`;
}

/** Retour du détail : la liste du réseau choisi (ou Tous), même filtre, même nombre de vidéos. */
export function retourDetail(sp: { reseau?: string; liste?: string; filtre?: string; n?: string }, presents: IdReseau[], filtre: FiltreListe, affichees: number): string {
  const reseau = sp.liste === "tous" ? "tous" : reseauDepuis(sp.reseau, presents);
  return lienListeReseau(reseau, filtre, affichees);
}
