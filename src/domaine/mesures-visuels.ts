/**
 * MESURES DES VISUELS (fiche L5-18a ; conception « mesures » du 18/11/2026, § L5-18). PUR : aucune lecture, aucune écriture.
 *
 * - Les carrousels ont leur PROPRE classement, séparé de celui des vidéos : un carrousel n'entre jamais dans le rang d'une vidéo.
 *   Les rangs sont calculés par `mesures-rangs.ts`, réutilisé sans modification, sur la seule liste des carrousels.
 * - Trois états par publication : mesuré, pas encore, non disponible. Une donnée absente n'est jamais un zéro.
 */
import { INDICATEURS, MINIMUM_GROUPE, rangsParReseau, resultatsDepuisStats, tousLesRangs, type Indicateur, type RangVideo, type ResultatsVideo, type VideoMesuree } from "./mesures-rangs";
import type { Publication, ReseauDeclinaison, StatsPublication } from "./types";

export type EtatMesure = "mesure" | "pas-encore" | "non-disponible";

/** Sans aucun relevé, une publication partie depuis plus de ce nombre de jours est « non disponible ». */
export const DELAI_NON_DISPONIBLE_JOURS = 7;

const JOUR_MS = 24 * 60 * 60 * 1000;
const SOURCES_DE_CHIFFRES: readonly string[] = ["zernio", "buffer", "saisie"];

const aUneValeur = (s: Partial<StatsPublication> | undefined): boolean => !!s && Object.values(s).some((v) => typeof v === "number" && Number.isFinite(v));

/**
 * État d'une publication de visuel : « mesuré » si un relevé (diffuseur, ancien outil ou saisie) porte au moins une valeur ;
 * sinon « pas encore » si elle est partie depuis moins de 7 jours, « non disponible » au-delà. Jamais un zéro inventé.
 */
export function etatMesurePublication(p: Pick<Publication, "date" | "releves" | "stats">, maintenant: Date): EtatMesure {
  const relevé = (p.releves ?? []).some((r) => SOURCES_DE_CHIFFRES.includes(r.source) && aUneValeur(r.valeurs));
  if (relevé || aUneValeur(p.stats)) return "mesure";
  const depuis = (maintenant.getTime() - new Date(p.date).getTime()) / JOUR_MS;
  return depuis < DELAI_NON_DISPONIBLE_JOURS ? "pas-encore" : "non-disponible";
}

/** Ce qu'un carrousel mesuré donne au classement : les mêmes champs qu'une vidéo, sans rien inventer. */
export function carrouselCommeVideoMesuree(entree: {
  publicationId: string;
  visuelId: string;
  famille: string;
  titre: string;
  reseau: ReseauDeclinaison;
  date: string;
  stats: Partial<StatsPublication> | undefined;
}): VideoMesuree {
  return {
    reseau: entree.reseau,
    formatId: entree.famille,
    publicationId: entree.publicationId,
    varianteId: entree.visuelId,
    code: "",
    titre: entree.titre,
    date: entree.date,
    resultats: resultatsDepuisStats(entree.stats),
  };
}

/**
 * Statistiques que le réseau ne donne pas : TikTok ne rend pas la portée, donc pas de partages rapportés à la portée.
 * Affiché « non disponible », jamais 0, et jamais rangé.
 */
export const MESURES_NON_DISPONIBLES: Partial<Record<ReseauDeclinaison, Indicateur[]>> = {
  tiktok: ["partages"],
};

/** Champ de `ResultatsVideo` qui porte chaque indicateur. */
const CHAMP_INDICATEUR: Record<Indicateur, keyof ResultatsVideo> = {
  tenue3s: "tauxAbandon3s",
  duree: "dureeMoyenneVueSec",
  partages: "partagesParPortee",
  vues: "vues",
  visites: "visites",
  rendezVous: "rendezVous",
};

export interface ClassementReseauVisuels {
  reseau: ReseauDeclinaison;
  nombre: number;
  /** Moins de `MINIMUM_GROUPE` carrousels sur ce réseau : « trop tôt pour dire ». */
  tropTot: boolean;
  /** Indicateurs que ce réseau ne donne pas : à écrire « non disponible ». */
  nonDisponibles: Indicateur[];
  rangs: RangVideo[];
}

export interface ClassementCarrousels {
  nombre: number;
  tropTot: boolean;
  reseaux: ClassementReseauVisuels[];
}

const ORDRE_RESEAUX: readonly ReseauDeclinaison[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];

/** Retire d'un carrousel les indicateurs que son réseau ne donne pas (ils ne sont ni rangés, ni lus comme 0). */
function sansIndicateursNonDisponibles(v: VideoMesuree): VideoMesuree {
  const retires = MESURES_NON_DISPONIBLES[v.reseau];
  if (!retires?.length) return v;
  const resultats = { ...v.resultats };
  for (const i of retires) delete resultats[CHAMP_INDICATEUR[i]];
  return { ...v, resultats };
}

/**
 * Classement des carrousels : `rangsParReseau` et `tousLesRangs` de `mesures-rangs.ts` appliqués à la SEULE liste des
 * carrousels. En dessous de `MINIMUM_GROUPE`, « trop tôt ».
 */
export function classerCarrousels(liste: VideoMesuree[]): ClassementCarrousels {
  const propres = liste.map(sansIndicateursNonDisponibles);
  const parReseau = rangsParReseau(propres);
  const nombre = tousLesRangs(propres).length;
  const reseaux: ClassementReseauVisuels[] = ORDRE_RESEAUX.filter((r) => parReseau[r]?.length).map((reseau) => {
    const rangs = parReseau[reseau]!;
    return { reseau, nombre: rangs.length, tropTot: rangs.length < MINIMUM_GROUPE, nonDisponibles: [...(MESURES_NON_DISPONIBLES[reseau] ?? [])], rangs };
  });
  return { nombre, tropTot: nombre < MINIMUM_GROUPE, reseaux };
}

/** Libellé d'un indicateur (réutilise la liste de `mesures-rangs.ts`). */
export function libelleIndicateur(i: Indicateur): string {
  return INDICATEURS.find((x) => x.id === i)?.libelle ?? i;
}
