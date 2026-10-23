/**
 * MESURE COMPLÈTE : RANGS, « LES 5 PLUS PROCHES » ET LIENS SUIVIS (plan v5 B.8 §3 et §8, B.5.5, lot G7b). PUR.
 *
 * - Lecture EN RANGS, jamais en valeurs brutes : chaque vidéo est rangée parmi les 20 dernières vidéos mesurées de SON
 *   réseau, indicateur par indicateur, puis sur la moyenne de ses positions (B.8 §3).
 * - Regroupements par réseau, format, structure et type d'ouverture : position médiane des vidéos du groupe (une position
 *   relative à son réseau, donc comparable d'un réseau à l'autre). Un groupe de moins de 3 vidéos est « trop tôt ».
 * - Avis « les 5 plus proches » (B.8 §8) : les 5 vidéos passées les plus semblables et LEURS rangs. AUCUNE PRÉDICTION :
 *   aucun chiffre n'est estimé pour la vidéo à venir, seules les vidéos déjà mesurées sont montrées.
 * - Liens suivis : visites et rendez-vous lus par `utm_campaign` = code de la version (B.5.5).
 */
import type { Emotion, ObjectifSujet, PointDeVue, ReseauDeclinaison, StatsPublication, TypeAccroche, TypeMatiere } from "./types";

/** Fenêtre de comparaison (B.8 §3). */
export const FENETRE_RANGS = 20;
/** En dessous, un groupe n'est pas lu (« trop tôt pour dire »). */
export const MINIMUM_GROUPE = 3;
export const NOMBRE_PLUS_PROCHES = 5;

/* ------------------------------------------------------------------ */
/* Vidéo mesurée                                                       */
/* ------------------------------------------------------------------ */

/** Ce qui sert à rapprocher deux vidéos (lu dans la fiche figée de la version, sinon dans le sujet). */
export interface TraitsVideo {
  reseau: ReseauDeclinaison;
  formatId: string;
  structure?: string;
  /** Type d'ouverture (famille d'accroche). */
  ouverture?: TypeAccroche | string;
  objectifSujet?: ObjectifSujet;
  typeAncrage?: TypeMatiere;
  pointDeVue?: PointDeVue;
  emotion?: Emotion;
  pilier?: string;
  contrePied?: boolean;
  dureeSec?: number;
}

/** Résultats retenus d'une vidéo : derniers chiffres connus (relevé le plus récent), jamais une estimation. */
export interface ResultatsVideo {
  /** Partis avant 3 s (%) : plus bas = mieux. */
  tauxAbandon3s?: number;
  dureeMoyenneVueSec?: number;
  partagesParPortee?: number;
  vues?: number;
  visites?: number;
  rendezVous?: number;
}

export interface VideoMesuree extends TraitsVideo {
  publicationId: string;
  varianteId: string;
  code: string;
  titre: string;
  /** Date de publication (ISO). */
  date: string;
  resultats: ResultatsVideo;
  /** Exemple de démonstration (jamais mêlé aux vraies vidéos de Will). */
  exemple?: boolean;
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                         */
/* ------------------------------------------------------------------ */

export type Indicateur = "tenue3s" | "duree" | "partages" | "vues" | "visites" | "rendezVous";

/** Ordre d'affichage et libellés courts (écran 390 px). */
export const INDICATEURS: readonly { id: Indicateur; libelle: string; definition: string }[] = [
  { id: "tenue3s", libelle: "Restés après 3 s", definition: "100 − part des spectateurs partis avant 3 secondes." },
  { id: "duree", libelle: "Durée regardée", definition: "Durée moyenne regardée par vue (secondes)." },
  { id: "partages", libelle: "Partages", definition: "Partages ÷ personnes atteintes (%)." },
  { id: "vues", libelle: "Vues", definition: "Vues relevées par Buffer ou saisies." },
  { id: "visites", libelle: "Visites", definition: "Visites du site arrivées par le lien suivi de la version." },
  { id: "rendezVous", libelle: "Rendez-vous", definition: "Visiteurs du lien suivi qui ont cliqué vers la prise de rendez-vous." },
];

/** Valeur d'un indicateur, « plus haut = mieux » ; undefined si non mesuré. */
export function valeurIndicateur(r: ResultatsVideo, i: Indicateur): number | undefined {
  const fini = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : undefined);
  switch (i) {
    case "tenue3s": {
      const a = fini(r.tauxAbandon3s);
      return a === undefined ? undefined : 100 - a;
    }
    case "duree":
      return fini(r.dureeMoyenneVueSec);
    case "partages":
      return fini(r.partagesParPortee);
    case "vues":
      return fini(r.vues);
    case "visites":
      return fini(r.visites);
    case "rendezVous":
      return fini(r.rendezVous);
  }
}

/** Résultats d'une publication à partir de ses statistiques (copie du dernier relevé). */
export function resultatsDepuisStats(s: (Partial<StatsPublication> & { visites?: number; rendezVous?: number }) | undefined): ResultatsVideo {
  if (!s) return {};
  return {
    tauxAbandon3s: s.tauxAbandon3s,
    dureeMoyenneVueSec: s.dureeMoyenneVueSec,
    partagesParPortee: s.partagesParPortee,
    vues: s.vues || undefined,
    visites: s.visites,
    rendezVous: s.rendezVous,
  };
}

/** Une vidéo est rangeable si au moins un indicateur est mesuré. */
export function estMesuree(v: Pick<VideoMesuree, "resultats">): boolean {
  return INDICATEURS.some((i) => valeurIndicateur(v.resultats, i.id) !== undefined);
}

/* ------------------------------------------------------------------ */
/* Rangs par réseau                                                    */
/* ------------------------------------------------------------------ */

export interface RangVideo {
  video: VideoMesuree;
  /** 1 = la meilleure ; ex aequo = même rang. */
  rang: number;
  /** Nombre de vidéos comparées (≤ 20). */
  sur: number;
  /** 0 (dernière) à 1 (première) : position relative, comparable d'un réseau à l'autre. */
  position: number;
  /** Rang par indicateur mesuré. */
  parIndicateur: Partial<Record<Indicateur, { rang: number; sur: number }>>;
}

/** Position relative d'une valeur dans une liste (« plus haut = mieux ») : 1 = première, 0 = dernière, ex aequo au milieu. */
function positionDans(valeur: number, toutes: readonly number[]): number {
  if (toutes.length <= 1) return 1;
  const dessous = toutes.filter((x) => x < valeur).length;
  const egales = toutes.filter((x) => x === valeur).length - 1;
  return (dessous + egales / 2) / (toutes.length - 1);
}

function rangDans(valeur: number, toutes: readonly number[]): number {
  return toutes.filter((x) => x > valeur).length + 1;
}

/** Les 20 dernières vidéos mesurées d'un réseau (les plus récentes d'abord). */
export function fenetreReseau(videos: readonly VideoMesuree[], reseau: ReseauDeclinaison, taille = FENETRE_RANGS): VideoMesuree[] {
  return videos
    .filter((v) => v.reseau === reseau && estMesuree(v))
    .sort((a, b) => b.date.localeCompare(a.date) || a.code.localeCompare(b.code))
    .slice(0, taille);
}

/**
 * Rangs d'un réseau : chaque vidéo de la fenêtre est rangée indicateur par indicateur ; son rang général suit la moyenne
 * de ses positions (sur les indicateurs mesurés pour elle). Rien n'est extrapolé.
 */
export function rangsReseau(videos: readonly VideoMesuree[], reseau: ReseauDeclinaison, taille = FENETRE_RANGS): RangVideo[] {
  const fenetre = fenetreReseau(videos, reseau, taille);
  const valeurs = new Map<Indicateur, number[]>();
  for (const i of INDICATEURS) {
    valeurs.set(
      i.id,
      fenetre.map((v) => valeurIndicateur(v.resultats, i.id)).filter((x): x is number => x !== undefined),
    );
  }
  const moyennes = fenetre.map((v) => {
    const parIndicateur: RangVideo["parIndicateur"] = {};
    const positions: number[] = [];
    for (const i of INDICATEURS) {
      const x = valeurIndicateur(v.resultats, i.id);
      const toutes = valeurs.get(i.id)!;
      if (x === undefined || toutes.length === 0) continue;
      parIndicateur[i.id] = { rang: rangDans(x, toutes), sur: toutes.length };
      positions.push(positionDans(x, toutes));
    }
    return { video: v, moyenne: positions.reduce((s, p) => s + p, 0) / positions.length, parIndicateur };
  });
  const scores = moyennes.map((m) => m.moyenne);
  return moyennes
    .map((m) => ({ video: m.video, rang: rangDans(m.moyenne, scores), sur: fenetre.length, position: positionDans(m.moyenne, scores), parIndicateur: m.parIndicateur }))
    .sort((a, b) => a.rang - b.rang || b.video.date.localeCompare(a.video.date));
}

/** Rangs de tous les réseaux présents. */
export function rangsParReseau(videos: readonly VideoMesuree[], taille = FENETRE_RANGS): Partial<Record<ReseauDeclinaison, RangVideo[]>> {
  const r: Partial<Record<ReseauDeclinaison, RangVideo[]>> = {};
  for (const reseau of new Set(videos.map((v) => v.reseau))) {
    const rangs = rangsReseau(videos, reseau, taille);
    if (rangs.length) r[reseau] = rangs;
  }
  return r;
}

/** Tous les rangs (chaque vidéo rangée dans SON réseau), à plat. */
export function tousLesRangs(videos: readonly VideoMesuree[], taille = FENETRE_RANGS): RangVideo[] {
  return Object.values(rangsParReseau(videos, taille)).flat();
}

/* ------------------------------------------------------------------ */
/* Regroupements : réseau, format, structure, type d'ouverture          */
/* ------------------------------------------------------------------ */

export type Axe = "reseau" | "format" | "structure" | "ouverture";

export interface Groupe {
  axe: Axe;
  valeur: string;
  /** Vidéos du groupe (rangées). */
  nombre: number;
  /** Position médiane (0 à 1) ; absente si le groupe est trop petit pour être lu. */
  positionMediane?: number;
  /** Moins de 3 vidéos : on ne dit rien. */
  tropTot: boolean;
  /** Meilleur rang obtenu dans le groupe (ex. « 1er sur 20 »). */
  meilleur?: { code: string; rang: number; sur: number };
}

function valeurAxe(v: VideoMesuree, axe: Axe): string | undefined {
  if (axe === "reseau") return v.reseau;
  if (axe === "format") return v.formatId;
  if (axe === "structure") return v.structure;
  return v.ouverture;
}

export function mediane(xs: readonly number[]): number {
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/** Groupes d'un axe, du plus souvent devant au plus souvent derrière ; les groupes « trop tôt » ferment la liste. */
export function regrouper(rangs: readonly RangVideo[], axe: Axe): Groupe[] {
  const parValeur = new Map<string, RangVideo[]>();
  for (const r of rangs) {
    const val = valeurAxe(r.video, axe);
    if (!val) continue;
    parValeur.set(val, [...(parValeur.get(val) ?? []), r]);
  }
  const groupes: Groupe[] = [...parValeur].map(([valeur, rs]) => {
    const tropTot = rs.length < MINIMUM_GROUPE;
    const meilleur = [...rs].sort((a, b) => a.position === b.position ? a.rang - b.rang : b.position - a.position)[0];
    return {
      axe,
      valeur,
      nombre: rs.length,
      positionMediane: tropTot ? undefined : mediane(rs.map((r) => r.position)),
      tropTot,
      meilleur: { code: meilleur.video.code, rang: meilleur.rang, sur: meilleur.sur },
    };
  });
  return groupes.sort((a, b) => Number(a.tropTot) - Number(b.tropTot) || (b.positionMediane ?? 0) - (a.positionMediane ?? 0) || b.nombre - a.nombre || a.valeur.localeCompare(b.valeur));
}

/* ------------------------------------------------------------------ */
/* « Les 5 plus proches » (B.8 §8)                                     */
/* ------------------------------------------------------------------ */

/** Poids des traits dans le rapprochement : le réseau, le format, la structure et l'ouverture d'abord. */
export const POIDS_PROXIMITE: Readonly<Record<keyof Omit<TraitsVideo, "dureeSec">, number> & { dureeSec: number }> = {
  reseau: 3,
  formatId: 2,
  structure: 2,
  ouverture: 2,
  objectifSujet: 1,
  typeAncrage: 1,
  pointDeVue: 1,
  emotion: 1,
  pilier: 0.5,
  contrePied: 0.5,
  dureeSec: 1,
};

/**
 * Ressemblance de 0 à 1 entre deux vidéos : part des poids des traits identiques (un trait inconnu d'un côté ne compte
 * ni pour ni contre) ; la durée compte à proportion de l'écart (30 s d'écart = rien en commun).
 */
export function ressemblance(a: TraitsVideo, b: TraitsVideo): number {
  let total = 0;
  let commun = 0;
  for (const [cle, poids] of Object.entries(POIDS_PROXIMITE) as [keyof TraitsVideo, number][]) {
    const x = a[cle];
    const y = b[cle];
    if (x === undefined || y === undefined || x === "" || y === "") continue;
    total += poids;
    if (cle === "dureeSec") commun += poids * Math.max(0, 1 - Math.abs((x as number) - (y as number)) / 30);
    else if (x === y) commun += poids;
  }
  return total ? Math.round((commun / total) * 1000) / 1000 : 0;
}

export interface VideoProche {
  code: string;
  titre: string;
  reseau: ReseauDeclinaison;
  date: string;
  /** 0 à 1. */
  ressemblance: number;
  /** Traits communs, pour dire POURQUOI elle est proche. */
  enCommun: ("reseau" | "format" | "structure" | "ouverture")[];
  /** Son rang réel dans son réseau, tel que mesuré. */
  rang: number;
  sur: number;
  exemple?: boolean;
}

/** Avis avant publication : les 5 vidéos mesurées les plus proches et LEURS rangs. Aucune valeur n'est estimée. */
export interface AvisPlusProches {
  proches: VideoProche[];
  /** Vidéos mesurées disponibles pour comparer. */
  comparees: number;
}

export function cinqPlusProches(cible: TraitsVideo & { varianteId?: string; code?: string }, rangs: readonly RangVideo[], nombre = NOMBRE_PLUS_PROCHES): AvisPlusProches {
  const candidates = rangs.filter((r) => r.video.varianteId !== cible.varianteId && (!cible.code || r.video.code !== cible.code));
  const proches = candidates
    .map((r) => ({ r, s: ressemblance(cible, r.video) }))
    .sort((a, b) => b.s - a.s || b.r.video.date.localeCompare(a.r.video.date))
    .slice(0, nombre)
    .map(({ r, s }): VideoProche => {
      const v = r.video;
      const enCommun: VideoProche["enCommun"] = [];
      if (v.reseau === cible.reseau) enCommun.push("reseau");
      if (v.formatId === cible.formatId) enCommun.push("format");
      if (v.structure && v.structure === cible.structure) enCommun.push("structure");
      if (v.ouverture && v.ouverture === cible.ouverture) enCommun.push("ouverture");
      return { code: v.code, titre: v.titre, reseau: v.reseau, date: v.date, ressemblance: s, enCommun, rang: r.rang, sur: r.sur, ...(v.exemple ? { exemple: true } : {}) };
    });
  return { proches, comparees: candidates.length };
}

/* ------------------------------------------------------------------ */
/* Liens suivis : visites et rendez-vous par version                    */
/* ------------------------------------------------------------------ */

export interface LigneLien {
  /** utm_campaign = code de la version. */
  campagne: string;
  /** utm_source = réseau. */
  source?: string;
  visites: number;
  rendezVous: number;
}

/** Définitions écrites avec chaque relevé de lien suivi (B.8 §2). */
export const DEFINITIONS_LIENS: Readonly<Record<"visites" | "rendezVous", string>> = {
  visites: "Visiteurs uniques du site arrivés avec utm_medium=video et utm_campaign = code de la version (lu dans les statistiques du site).",
  rendezVous: "Parmi eux, ceux qui ont cliqué vers la prise de rendez-vous (lien sortant vers calendly.com).",
};

/** Regroupe les lignes lues par code de version (un même code peut revenir par plusieurs sources). */
export function visitesParCode(lignes: readonly LigneLien[]): Map<string, { visites: number; rendezVous: number }> {
  const m = new Map<string, { visites: number; rendezVous: number }>();
  for (const l of lignes) {
    const c = l.campagne.trim();
    if (!c || c === "(not set)") continue;
    const x = m.get(c) ?? { visites: 0, rendezVous: 0 };
    m.set(c, { visites: x.visites + Math.max(0, l.visites | 0), rendezVous: x.rendezVous + Math.max(0, l.rendezVous | 0) });
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Libellés de rang                                                    */
/* ------------------------------------------------------------------ */

/** « 1re », « 2e », « 20e ». */
export function ordinal(n: number): string {
  return n === 1 ? "1re" : `${n}e`;
}
