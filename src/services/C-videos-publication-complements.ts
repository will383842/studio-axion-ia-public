/**
 * COMPLÉMENTS DU GROUPE C (Mes vidéos, fiche vidéo, publication, réglages).
 * Fonctions manquantes au contrat, ajoutées SANS modifier les services existants.
 * Le QA pourra les fusionner dans videos.ts / couts.ts / reglages.ts.
 */
import "server-only";
import type { DepenseEnregistree, Id, LigneCout, Montant } from "@/domaine/types";
import { choixConnu, TYPES_FOURNISSEURS, type TypeFournisseur } from "@/fournisseurs";
import { phraseChoixService } from "@/fournisseurs/journal-lisible";
import { additionner, centimes } from "@/lib/montants";
import { depots, ecrireParametre, ErreurStudio, filtreExemples, journaliser } from "./_commun";
import { exigerSession } from "./auth";
import { decalerMois, depenseComptee, ligneSimulee, moisParis, montantPaye } from "./couts";

/* ------------------------------------------------------------------ */
/* Onglet d'un format : chiffres                                       */
/* ------------------------------------------------------------------ */

export interface StatsFormat {
  nbPretes: number;
  nbPubliees: number;
  /** Vues moyennes par vidéo publiée (null si aucune publication). */
  vuesMoyennes: number | null;
  /** Note de qualité moyenne /100 (null si aucune vidéo prête). */
  qualiteMoyenne: number | null;
}

export async function statsFormat(formatId: string): Promise<StatsFormat> {
  const d = depots();
  const exemples = await filtreExemples<{ estDemo?: boolean }>();
  const pretes = await d.videos.lister((v) => exemples(v) && v.formatId === formatId && v.statut === "prete");
  const ids = new Set(pretes.map((v) => v.id));
  const pubs = await d.publications.lister((p) => ids.has(p.videoId) && p.statut === "publiee");
  const vuesParVideo = new Map<string, number>();
  for (const p of pubs) vuesParVideo.set(p.videoId, (vuesParVideo.get(p.videoId) ?? 0) + (p.stats?.vues ?? 0));
  const notes = pretes.map((v) => v.noteQualite?.globale).filter((n): n is number => typeof n === "number");
  return {
    nbPretes: pretes.length,
    nbPubliees: vuesParVideo.size,
    vuesMoyennes: vuesParVideo.size ? Math.round([...vuesParVideo.values()].reduce((a, b) => a + b, 0) / vuesParVideo.size) : null,
    qualiteMoyenne: notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Retouches : coût estimé                                             */
/* ------------------------------------------------------------------ */

/**
 * Coût estimé d'une retouche : seuls les plans choisis sont refaits (AV2.2-5).
 * Estimation au prorata de la durée des plans, sur la base de l'estimation du moteur.
 */
export async function estimerRetouche(videoId: Id, planIds: Id[]): Promise<{ total: Montant; dureeSec: number }> {
  // Même calcul que la facture finale (moteur.estimerRetouche) : l'estimation affichée est tenue.
  const { estimerRetoucheVideo } = await import("./fabrication");
  return estimerRetoucheVideo(videoId, planIds);
}

/* ------------------------------------------------------------------ */
/* Réglages > Connexions : choix du fournisseur                        */
/* ------------------------------------------------------------------ */

/**
 * Enregistre le fournisseur choisi pour un type (« simulation » ou l'identifiant EXACT d'un service réel prévu ou
 * inscrit, lot R0). Un identifiant inconnu pour ce type (ancien « remotion », « whisperx »…) est refusé : il serait
 * retombé en silence sur la simulation. Choisir ne dépense rien : aucun appel au service n'est fait ici.
 */
export async function definirFournisseur(type: TypeFournisseur, valeur: string): Promise<void> {
  await exigerSession();
  if (!TYPES_FOURNISSEURS.includes(type)) throw new ErreurStudio("TYPE_INCONNU", "Ce service n'existe pas.");
  const propre = valeur.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(propre) || !choixConnu(type, propre)) throw new ErreurStudio("VALEUR_INVALIDE", "Ce choix n'est pas valable.");
  await ecrireParametre(`fournisseur.${type}`, propre === "simulation" ? null : propre);
  await journaliser("connexion", phraseChoixService(type, propre));
}

/* ------------------------------------------------------------------ */
/* Budget : coûts par fournisseur et par mois                          */
/* ------------------------------------------------------------------ */

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Poste de dépense lisible, rattaché au service qui le facture. */
function posteFournisseur(l: LigneCout): string {
  const e = l.etape.toLowerCase();
  if (e.includes("voix")) return "Voix";
  if (e.includes("double") || e.includes("visage")) return "Double";
  if (e.includes("illustr") || e.includes("image")) return "Illustrations";
  if (e.includes("mix") || e.includes("son") || e.includes("musique")) return "Son";
  if (e.includes("export") || e.includes("montage")) return "Montage";
  if (e.includes("script")) return "Scripts";
  if (e.includes("miniature")) return "Miniatures";
  return "Autres";
}

export interface CoutsMois {
  mois: string;
  libelle: string;
  total: Montant;
  parFournisseur: { fournisseur: string; total: Montant }[];
}

/**
 * Les 3 derniers mois, du plus ancien au plus récent, avec le détail par poste. Audit 4.1 et 4.5 : seulement ce qui est
 * PAYÉ (ni lignes simulées, ni dépenses d'exemple), au mois de PARIS : le mois en cours concorde avec la jauge.
 * Une dépense sans détail compte en entier, dans « Autres ». PUR (testé).
 */
export function calculerCoutsParMois(depenses: DepenseEnregistree[], moisCourant: string, nbMois = 3): CoutsMois[] {
  const comptees = depenses.filter(depenseComptee);
  const res: CoutsMois[] = [];
  for (let i = nbMois - 1; i >= 0; i--) {
    const cle = decalerMois(moisCourant, -i);
    const duMois = comptees.filter((x) => moisParis(x.date) === cle);
    const postes = new Map<string, number>();
    for (const d of duMois) {
      if (!d.lignes?.length) {
        if (d.total.centimes) postes.set("Autres", (postes.get("Autres") ?? 0) + d.total.centimes);
        continue;
      }
      for (const l of d.lignes) {
        if (ligneSimulee(l)) continue;
        const p = posteFournisseur(l);
        postes.set(p, (postes.get(p) ?? 0) + l.total.centimes);
      }
    }
    res.push({
      mois: cle,
      libelle: MOIS[Number(cle.slice(5, 7)) - 1],
      total: additionner(...duMois.map(montantPaye)),
      parFournisseur: Array.from(postes, ([fournisseur, c]) => ({ fournisseur, total: centimes(c) })).sort((a, b) => b.total.centimes - a.total.centimes),
    });
  }
  return res;
}

export async function coutsParFournisseurEtMois(nbMois = 3): Promise<CoutsMois[]> {
  return calculerCoutsParMois(await depots().depenses.lister(), moisParis(), nbMois);
}
