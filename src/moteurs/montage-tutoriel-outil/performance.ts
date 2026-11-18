/**
 * T-EXT-48a · BOUCLE DE PERFORMANCE DU TUTORIEL D'OUTIL : lecture pure. Branchée nulle part.
 *
 * Range les vidéos tutoriel mesurées avec les MÊMES règles que le reste du Studio (`mesures-rangs.ts` : rangs parmi les
 * 20 dernières vidéos du réseau, « trop tôt pour dire » sous 3 vidéos). AUCUNE PRÉDICTION, aucun conseil, aucun montant.
 * Une donnée absente reste absente : jamais un zéro inventé. Rien ici n'écrit une phrase de la vidéo.
 */
import { regrouper, type Groupe, type RangVideo, type TraitsVideo } from "@/domaine/mesures-rangs";
import type { ReseauDeclinaison } from "@/domaine/types";

export const FORMAT_TUTORIEL = "tutoriel-outil";
/** Liste fermée locale des gabarits du tutoriel (aucun import de l'équipe : un test interdit tout appelant). */
export const GABARITS_TUTORIEL = ["G-Journee", "G-Decision", "G-Reponse", "G-Flux"] as const;
export type IdGabarit = (typeof GABARITS_TUTORIEL)[number];
export type CasTutoriel = 1 | 2 | 3 | 4 | 5;
/** Lignes du relevé remis au stratège : 5 au plus. */
export const LIGNES_RELEVE_MAX = 5;

export interface LecturePerformance {
  parGabarit: Groupe[];
  parOuverture: Groupe[];
  /** Vidéos tutoriel rangées. */
  nombre: number;
}

/** Traits d'une vidéo tutoriel, lus dans le cahier (gabarit) et la fiche de valeur (ouverture) : jamais devinés. */
export function traitsTutoriel(v: { reseau: ReseauDeclinaison; dureeSec?: number; gabarit?: IdGabarit; devient?: string; cas?: CasTutoriel }): TraitsVideo {
  return {
    reseau: v.reseau,
    formatId: FORMAT_TUTORIEL,
    ...(v.gabarit ? { structure: v.gabarit } : {}),
    ...(v.devient ? { ouverture: v.devient } : {}),
    ...(v.cas ? { pilier: `cas-${v.cas}` } : {}),
    ...(typeof v.dureeSec === "number" && Number.isFinite(v.dureeSec) ? { dureeSec: v.dureeSec } : {}),
  };
}

/** Lecture des seuls rangs du tutoriel, par gabarit et par ouverture ; les groupes « trop tôt » restent marqués tels. */
export function lecturePerformance(rangs: readonly RangVideo[]): LecturePerformance {
  const siens = rangs.filter((r) => r.video.formatId === FORMAT_TUTORIEL);
  return { parGabarit: regrouper(siens, "structure"), parOuverture: regrouper(siens, "ouverture"), nombre: siens.length };
}

const NOM_OUVERTURE: Readonly<Record<string, string>> = {
  "plus-sereine": "entreprise plus sereine",
  "plus-solide": "entreprise plus solide",
  "prete-a-grandir": "entreprise prête à grandir",
  "plus-maitre-de-ses-decisions": "entreprise plus maître de ses décisions",
};

const NOM_GABARIT: Readonly<Record<string, string>> = { "G-Decision": "G-Décision", "G-Journee": "G-Journée", "G-Reponse": "G-Réponse", "G-Flux": "G-Flux" };

function tiers(position: number): string {
  return position >= 2 / 3 ? "1er tiers" : position >= 1 / 3 ? "2e tiers" : "3e tiers";
}

function ligne(nom: string, g: Groupe): string {
  const videos = `${g.nombre} vidéo${g.nombre > 1 ? "s" : ""}`;
  if (g.tropTot || g.positionMediane === undefined) return `${nom} : trop tôt pour dire (${videos})`;
  return `${nom} : ${videos}, position médiane ${tiers(g.positionMediane)} de leur réseau`;
}

/**
 * Court relevé factuel pour le stratège : 5 lignes au plus (les gabarits d'abord, puis les ouvertures), sans conseil,
 * sans prédiction, sans montant. Aucune ligne si rien n'est lisible. Même entrée, même sortie.
 */
export function relevePourStratege(lecture: LecturePerformance): string[] {
  if (lecture.nombre === 0) return [];
  const lignes = [
    ...lecture.parGabarit.map((g) => ligne(NOM_GABARIT[g.valeur] ?? g.valeur, g)),
    ...lecture.parOuverture.map((g) => ligne(NOM_OUVERTURE[g.valeur] ?? g.valeur, g)),
  ];
  return lignes.slice(0, LIGNES_RELEVE_MAX);
}
