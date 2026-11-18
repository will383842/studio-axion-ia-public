/**
 * L8-09 : score des contenus candidats à la republication. Calcul PUR : aucun réseau, aucune lecture de base, aucun
 * réglage lu, aucune écriture. Branché nulle part. Rien n'est republié par ce fichier : il classe, il ne décide pas.
 *
 * Le score va de 0 à 1 (1 = le meilleur de son groupe). Il se compose de quatre parties, toutes lues en POSITION dans le
 * groupe (même principe que `mesures-rangs.ts`, dont les indicateurs et la lecture « plus haut = mieux » sont réutilisés) :
 *   - le rang moyen (restés après 3 s, durée regardée, vues) ;
 *   - les visites par lien suivi ;
 *   - les rendez-vous par lien suivi ;
 *   - les partages rapportés à la portée.
 *
 * Règles de lecture :
 *   - Une donnée absente n'est JAMAIS un zéro : la partie manquante est laissée de côté et les poids des parties lues sont
 *     remis à l'échelle. Un zéro réellement lu, lui, est une vraie valeur.
 *   - Un contenu mesuré depuis moins de 7 jours est exclu ; il ne compte pas non plus dans la taille du groupe.
 *   - Le groupe est le réseau ; il faut au moins 3 contenus retenus, et au moins 3 valeurs lues pour qu'une partie compte.
 *   - Les chiffres que le réseau ne donne pas (partages sur TikTok) ne sont ni rangés ni lus comme 0.
 */
import { MESURES_NON_DISPONIBLES, estReseauClasse } from "@/domaine/mesures-visuels";
import { INDICATEURS, MINIMUM_GROUPE, valeurIndicateur, type Indicateur, type ResultatsVideo } from "@/domaine/mesures-rangs";
import type { ReseauDeclinaison } from "@/domaine/types";
import type { ValeurSourcee } from "./regles";

/* ------------------------------------------------------------------ */
/* VALEURS PROPOSÉES : pas encore validées par le fondateur.            */
/* Pour les changer, ne modifier que ce bloc.                           */
/* ------------------------------------------------------------------ */

/** Durée minimale depuis la première mesure avant qu'un contenu puisse être noté (fixée par la fiche). */
export const DELAI_MESURE_MIN_JOURS: ValeurSourcee<number> = { statut: "source", valeur: 7, source: "fiche L8-09" };

/** Nombre minimal de contenus retenus dans un réseau pour lire un score (fixé par la fiche, = MINIMUM_GROUPE). */
export const GROUPE_MIN: ValeurSourcee<number> = { statut: "source", valeur: MINIMUM_GROUPE, source: "fiche L8-09" };

/**
 * PROPOSITION : poids de chaque partie dans le score. Ils doivent faire 1 en tout. Les rendez-vous pèsent le plus parmi les
 * résultats du site (ils montrent une vraie démarche) ; le rang moyen pèse le plus fort car il reprend trois mesures.
 */
export const POIDS_SCORE = {
  rang: { statut: "hypothese", valeur: 0.4 },
  visites: { statut: "hypothese", valeur: 0.2 },
  rendezVous: { statut: "hypothese", valeur: 0.25 },
  partages: { statut: "hypothese", valeur: 0.15 },
} as const satisfies Record<string, ValeurSourcee<number>>;

/** PROPOSITION : indicateurs dont la moyenne des positions donne le « rang moyen ». */
export const INDICATEURS_RANG_MOYEN: readonly Indicateur[] = ["tenue3s", "duree", "vues"];

/** Arrondi au millième des nombres renvoyés (affichage seulement ; le calcul n'arrondit pas). */
const FACTEUR_ARRONDI = 1000;

/* ------------------------------------------------------------------ */

export interface CandidatRepublication {
  id: string;
  /** Réseau où le contenu a été publié ; un réseau non classé ou inconnu est exclu. */
  reseau: string;
  /** Date de publication d'origine (ISO). */
  datePublication: string;
  /** Date du premier relevé de chiffres (ISO) ; null = jamais mesuré. */
  premiereMesure: string | null;
  /** Derniers chiffres connus ; un champ absent = non lu. */
  resultats: ResultatsVideo;
}

export type MotifExclusion = "reseau-non-classe" | "date-invalide" | "pas-mesure" | "mesure-trop-recente" | "aucune-donnee" | "groupe-trop-petit";

export interface ComposantesScore {
  /** Chaque partie : position de 0 à 1 dans le groupe, ou null si elle n'a pas pu être lue. */
  rang: number | null;
  visites: number | null;
  rendezVous: number | null;
  partages: number | null;
}

export interface ResultatScore {
  id: string;
  reseau: string;
  etat: "note" | "exclu";
  /** 0 à 1 ; null si le contenu est exclu (jamais 0 par défaut). */
  score: number | null;
  motif?: MotifExclusion;
  composantes: ComposantesScore;
}

const JOUR_MS = 24 * 60 * 60 * 1000;
const VIDE: ComposantesScore = { rang: null, visites: null, rendezVous: null, partages: null };

/** Valeur lue d'un indicateur, ou undefined : absente, illisible, ou non donnée par ce réseau. */
function valeurLue(c: CandidatRepublication, i: Indicateur): number | undefined {
  if ((MESURES_NON_DISPONIBLES[c.reseau as ReseauDeclinaison] ?? []).includes(i)) return undefined;
  return valeurIndicateur(c.resultats, i);
}

/** Position relative d'une valeur dans une liste (« plus haut = mieux ») : 1 = première, 0 = dernière, ex aequo au milieu. */
function position(valeur: number, toutes: readonly number[]): number {
  if (toutes.length <= 1) return 1;
  const dessous = toutes.filter((x) => x < valeur).length;
  const egales = toutes.filter((x) => x === valeur).length - 1;
  return (dessous + egales / 2) / (toutes.length - 1);
}

const exclu = (c: CandidatRepublication, motif: MotifExclusion): ResultatScore => ({ id: c.id, reseau: c.reseau, etat: "exclu", score: null, motif, composantes: { ...VIDE } });

/** Pourquoi un candidat ne peut pas entrer dans un groupe (avant même de regarder le groupe), ou null s'il le peut. */
function motifIndividuel(c: CandidatRepublication, maintenant: number): MotifExclusion | null {
  if (!estReseauClasse(c.reseau)) return "reseau-non-classe";
  if (!Number.isFinite(maintenant)) return "date-invalide";
  if (c.premiereMesure === null) return "pas-mesure";
  const mesure = Date.parse(c.premiereMesure);
  if (Number.isNaN(mesure)) return "date-invalide";
  if ((maintenant - mesure) / JOUR_MS < DELAI_MESURE_MIN_JOURS.valeur) return "mesure-trop-recente";
  if (!INDICATEURS.some((i) => valeurLue(c, i.id) !== undefined)) return "aucune-donnee";
  return null;
}

const moyenne = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Note les candidats à la republication. Les notés viennent d'abord (meilleur en tête, égalité par identifiant), les
 * exclus ensuite (par identifiant) avec leur motif. N'écrit nulle part et ne modifie pas la liste reçue.
 */
export function scorerCandidats(candidats: readonly CandidatRepublication[], maintenant: Date): ResultatScore[] {
  const t = maintenant.getTime();
  // Un résultat par ENTRÉE (indexé par sa position, jamais par l'identifiant : deux entrées de même id ne s'écrasent pas).
  const sorties: ResultatScore[] = new Array(candidats.length);
  const retenus = new Map<string, number[]>();

  candidats.forEach((c, k) => {
    const motif = motifIndividuel(c, t);
    if (motif) sorties[k] = exclu(c, motif);
    else retenus.set(c.reseau, [...(retenus.get(c.reseau) ?? []), k]);
  });

  for (const indices of retenus.values()) {
    const groupe = indices.map((k) => candidats[k]);
    if (groupe.length < GROUPE_MIN.valeur) {
      for (const k of indices) sorties[k] = exclu(candidats[k], "groupe-trop-petit");
      continue;
    }
    // Pour chaque indicateur : les valeurs lues du groupe ; sous 3 valeurs lues, l'indicateur n'est pas utilisé.
    const lues = new Map<Indicateur, number[]>();
    for (const i of INDICATEURS) {
      const v = groupe.map((c) => valeurLue(c, i.id)).filter((x): x is number => x !== undefined);
      if (v.length >= GROUPE_MIN.valeur) lues.set(i.id, v);
    }
    const pos = (c: CandidatRepublication, i: Indicateur): number | null => {
      const x = valeurLue(c, i);
      const toutes = lues.get(i);
      return x === undefined || !toutes ? null : position(x, toutes);
    };
    for (const k of indices) {
      const c = candidats[k];
      const positionsRang = INDICATEURS_RANG_MOYEN.map((i) => pos(c, i)).filter((x): x is number => x !== null);
      // Valeurs EXACTES : l'arrondi ne sert qu'à ce qui est renvoyé.
      const exactes: ComposantesScore = {
        rang: positionsRang.length ? moyenne(positionsRang) : null,
        visites: pos(c, "visites"),
        rendezVous: pos(c, "rendezVous"),
        partages: pos(c, "partages"),
      };
      const composantes: ComposantesScore = { rang: arrondiNul(exactes.rang), visites: arrondiNul(exactes.visites), rendezVous: arrondiNul(exactes.rendezVous), partages: arrondiNul(exactes.partages) };
      let somme = 0;
      let poids = 0;
      for (const cle of Object.keys(POIDS_SCORE) as (keyof ComposantesScore)[]) {
        const p = exactes[cle];
        if (p === null) continue; // absente : ni pour ni contre
        somme += POIDS_SCORE[cle].valeur * p;
        poids += POIDS_SCORE[cle].valeur;
      }
      sorties[k] = poids === 0 ? { ...exclu(c, "aucune-donnee"), composantes } : { id: c.id, reseau: c.reseau, etat: "note", score: arrondi(somme / poids), composantes };
    }
  }

  return sorties.sort((a, b) => {
    if (a.etat !== b.etat) return a.etat === "note" ? -1 : 1;
    if (a.etat === "note" && a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

const arrondi = (n: number): number => Math.round(n * FACTEUR_ARRONDI) / FACTEUR_ARRONDI;
const arrondiNul = (n: number | null): number | null => (n === null ? null : arrondi(n));
