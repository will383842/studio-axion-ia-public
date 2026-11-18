/**
 * L8-12a : liste des contenus déjà publiés qui méritent une nouvelle version. LECTURE SEULE : aucune écriture, aucun envoi,
 * aucun appel réseau ni à un modèle, aucun réglage lu. Branché nulle part (l'écran vient avec L8-12b).
 *
 * Ce que la fonction lit, et rien d'autre :
 *   - les publications publiées depuis moins de FENETRE_LECTURE_JOURS jours, au plus LECTURE_MAX_PUBLICATIONS (les plus récentes) ;
 *   - les créneaux dont l'identifiant commence par « republication- », au plus LECTURE_MAX_CRENEAUX.
 * Le seuil de performance des règles n'est pas lu (question ouverte au fondateur) : on liste les mieux classés.
 */
import { depots } from "@/donnees/memoire";
import { ordinal, resultatsDepuisStats } from "@/domaine/mesures-rangs";
import { evaluerRepublication } from "@/domaine/republication/regles";
import { scorerCandidats, type CandidatRepublication } from "@/domaine/republication/score";
import type { IdReseau, Publication } from "@/domaine/types";
import { obtenirReseau } from "@/reseaux";
import { filtreExemples as filtreExemplesParDefaut } from "./_commun";

/* ------------------------------------------------------------------ */
/* VALEURS PROPOSÉES : pas encore validées par le fondateur.            */
/* Pour les changer, ne modifier que ce bloc.                           */
/* ------------------------------------------------------------------ */

/** PROPOSITION : nombre maximal de lignes de la liste. */
export const NOMBRE_MAX_AFFICHES = { statut: "hypothese", valeur: 10 } as const;
/** PROPOSITION : on ne regarde que les publications des 365 derniers jours. */
export const FENETRE_LECTURE_JOURS = { statut: "hypothese", valeur: 365 } as const;
/** PROPOSITION : plafond de publications lues (les plus récentes d'abord). */
export const LECTURE_MAX_PUBLICATIONS = { statut: "hypothese", valeur: 500 } as const;
/** PROPOSITION : plafond de créneaux de republication lus. */
export const LECTURE_MAX_CRENEAUX = { statut: "hypothese", valeur: 2000 } as const;
/** Nombre de signes du texte d'origine montrés (fixé par la fiche). */
export const SIGNES_DEBUT_TEXTE = 80;

const PREFIXE_CRENEAU = "republication-";
const JOUR_MS = 24 * 3600 * 1000;

export interface DepsContenusARelancer {
  publications: { lister(filtre?: (p: Publication) => boolean, projeter?: (p: Publication) => Publication): Promise<Publication[]> };
  creneaux: { lister(filtre?: (c: { id: string }) => boolean): Promise<{ id: string }[]> };
  filtreExemples(): Promise<(e: { estDemo?: boolean }) => boolean>;
}

export interface LigneARelancer {
  publicationId: string;
  reseau: IdReseau;
  date: string;
  debutTexte: string;
  raison: string;
  rangDejaAtteint: number;
  media: "video" | "visuel";
}

function depsParDefaut(): DepsContenusARelancer {
  const d = depots();
  return { publications: d.publications, creneaux: d.creneauxEditoriaux, filtreExemples: filtreExemplesParDefaut };
}

/** Début du texte : espaces normalisés, au plus SIGNES_DEBUT_TEXTE signes. */
function debut(texte: string): string {
  const t = (texte ?? "").replace(/\s+/g, " ").trim();
  return t.length <= SIGNES_DEBUT_TEXTE ? t : t.slice(0, SIGNES_DEBUT_TEXTE - 1).trimEnd() + "…";
}

/** Nombre de créneaux `republication-<id>-<rang>` déjà créés pour cette publication (archivés compris). */
function rangAtteint(id: string, idsCreneaux: readonly string[]): number {
  const prefixe = `${PREFIXE_CRENEAU}${id}-`;
  return idsCreneaux.filter((c) => c.startsWith(prefixe) && /^\d+$/.test(c.slice(prefixe.length))).length;
}

const mediaDe = (p: Publication): "video" | "visuel" | null => (p.videoId && !p.visuelId ? "video" : p.visuelId && !p.videoId ? "visuel" : null);

/**
 * Liste, du meilleur au moins bon, les contenus publiés à relancer. Ne garde que les publications publiées, non simulées,
 * hors exemples, avec un média, notées par le score et dont le délai de republication du réseau est passé.
 */
export async function listerContenusARelancer(deps: DepsContenusARelancer = depsParDefaut(), maintenant: Date = new Date()): Promise<LigneARelancer[]> {
  const t = maintenant.getTime();
  if (!Number.isFinite(t)) return [];
  const exemples = await deps.filtreExemples();
  const depuis = new Date(t - FENETRE_LECTURE_JOURS.valeur * JOUR_MS).toISOString();
  const lues = await deps.publications.lister(
    (p) => p.statut === "publiee" && p.via !== "simulation" && exemples(p) && mediaDe(p) !== null && p.date >= depuis,
    (p) => ({ ...p, retention: undefined }),
  );
  const publications = [...lues].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1)).slice(0, LECTURE_MAX_PUBLICATIONS.valeur);
  if (publications.length === 0) return [];

  const parId = new Map(publications.map((p) => [p.id, p]));
  const candidats: CandidatRepublication[] = publications.map((p) => ({
    id: p.id,
    reseau: p.reseau,
    datePublication: p.date,
    premiereMesure: p.releves?.[0]?.le ?? null,
    resultats: resultatsDepuisStats(p.stats),
  }));
  const notes = scorerCandidats(candidats, maintenant).filter((r) => r.etat === "note");

  // Taille du groupe noté et place de chacun, par réseau (les notés sont déjà classés du meilleur au moins bon).
  const effectif = new Map<string, number>();
  const place = new Map<string, number>();
  for (const r of notes) {
    const n = (effectif.get(r.reseau) ?? 0) + 1;
    effectif.set(r.reseau, n);
    place.set(r.id, n);
  }

  const kept = notes.filter((r) => {
    const p = parId.get(r.id);
    if (!p) return false;
    const verdict = evaluerRepublication({ reseau: p.reseau, datePublication: Date.parse(p.date), maintenant: t, identique: false, filigrane: false });
    return !verdict.motifs.includes("delai-trop-court");
  });
  const retenues = kept.slice(0, NOMBRE_MAX_AFFICHES.valeur);
  if (retenues.length === 0) return [];

  const creneaux = await deps.creneaux.lister((c) => typeof c.id === "string" && c.id.startsWith(PREFIXE_CRENEAU));
  const idsCreneaux = creneaux.slice(0, LECTURE_MAX_CRENEAUX.valeur).map((c) => c.id);

  return retenues.map((r) => {
    const p = parId.get(r.id)!;
    return {
      publicationId: p.id,
      reseau: p.reseau,
      date: p.date,
      debutTexte: debut(p.texte),
      raison: `Parmi les mieux classés de vos publications ${obtenirReseau(p.reseau).nom} : ${ordinal(place.get(r.id) ?? 1)} sur ${effectif.get(r.reseau) ?? 1}.`,
      rangDejaAtteint: rangAtteint(p.id, idsCreneaux),
      media: mediaDe(p) ?? "video",
    };
  });
}
