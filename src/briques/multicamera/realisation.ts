/**
 * BRIQUE MULTICAMÉRA — le « réalisateur » automatique (lot F4). PUR.
 *
 * Règles de coupe (décision de Will du 09/10, catalogue des plans C7) :
 *  - on change d'angle au DÉBUT d'une phrase ou d'une idée (blanc, virgule, mot de liaison), jamais au milieu d'un mot :
 *    la coupe tombe toujours dans le blanc entre deux mots ;
 *  - un angle dure 3 à 6 s (rythme) ; le dernier plan n'est jamais plus court que le minimum ;
 *  - l'angle suit le SENS : de côté pour les explications, contre-plongée pour les phrases fortes, retour de face pour
 *    l'appel à l'action ; l'accroche reste sur la prise d'origine (de face, la plus nette) ;
 *  - jamais deux fois de suite le même angle si un autre est disponible ; l'appel à l'action reste d'un seul tenant ;
 *  - coupes « préférées » (fins des plans du format : zooms, illustrations) favorisées, pour que la coupe d'angle
 *    tombe avec la coupe de plan et que les zooms restent entiers.
 * Avec la face seule (angles fabriqués en échec) : un seul plan, de face — le montage d'origine.
 */
import { finitPhrase, normaliser } from "@/briques/coupes/texte";
import type { AngleMulticamera, PlanCamera, RaisonAngle } from "./types";

export interface MotRealisation {
  mot: string;
  debutSec: number;
  finSec: number;
  /** Bloc de la recette (« accroche », « coeur », « appel »…), s'il est connu. */
  bloc?: string;
  enValeur?: boolean;
}

export interface EntreeRealisation {
  mots: MotRealisation[];
  /** Angles utilisables (la face est toujours ajoutée : c'est la prise d'origine). */
  anglesDisponibles: readonly AngleMulticamera[];
  /** Fin de la vidéo (défaut : fin du dernier mot). */
  dureeSec?: number;
  /** Durée d'un angle (défaut 3-6 s). */
  rythme?: { minSec: number; maxSec: number };
  /** Instants où une coupe est bienvenue (fins des plans du format). */
  coupesPrefereesSec?: number[];
  /** Mots forts en plus de `enValeur` (emphases du script). */
  emphases?: string[];
}

export const RYTHME_MULTICAMERA = { minSec: 3, maxSec: 6 };
/** Blanc qui suffit à marquer une nouvelle idée. */
const BLANC_IDEE_SEC = 0.35;
/** Une coupe préférée compte si elle tombe à moins de ceci d'une coupe possible. */
const TOLERANCE_PREFEREE_SEC = 0.15;

const LIAISONS = new Set([
  "mais", "donc", "alors", "ensuite", "enfin", "dabord", "puis", "parce", "car", "sauf", "pourtant", "sinon", "bref",
  "concretement", "autrement", "resultat", "attention", "premierement", "deuxiemement", "troisiemement", "aussi",
  "maintenant", "pourquoi", "comment", "imaginez", "imagine", "prenons", "exemple",
]);
const MOTS_FORTS = new Set([
  "jamais", "toujours", "interdit", "interdite", "illegal", "illegale", "obligatoire", "attention", "absolument", "aucun",
  "aucune", "personne", "rien", "surtout", "grave", "faute", "nul", "nulle", "condamne", "condamnee", "risque", "risquez",
  "amende", "prison", "sanction", "licencie", "licenciee", "droit", "vrai", "faux", "erreur", "piege",
]);
const MOTS_EXPLICATION = new Set([
  "parce", "car", "exemple", "explique", "signifie", "concretement", "dabord", "ensuite", "comment", "pourquoi", "cest",
  "veut", "dire", "article", "loi", "code", "regle", "cas", "procedure", "delai", "etape",
]);
/** Impératifs d'appel à l'action seulement (« message », « lien » sont aussi des mots du droit : jamais seuls). */
const MOTS_APPEL = new Set([
  "abonnez", "abonnezvous", "abonnetoi", "commentez", "ecrivez", "ecrismoi", "ecrivezmoi", "contactez", "contactezmoi",
  "suivez", "suivezmoi", "partagez", "enregistrez", "cliquez", "telechargez", "envoyez", "envoyezmoi",
]);
const BLOCS_APPEL = new Set(["appel", "boucle"]);
const BLOCS_EXPLICATION = new Set(["coeur", "promesse", "explication", "reponse"]);
const BLOCS_FORTS = new Set(["accroche", "preuve"]);

type Nature = "phrase" | "idee" | "mot";
interface Candidate {
  t: number;
  /** Index du mot qui commence après la coupe. */
  i: number;
  nature: Nature;
  preferee: boolean;
  /** Début de l'appel à l'action : coupe toujours voulue (retour de face), même si l'appel est court. */
  versAppel: boolean;
}

/** Durée minimale d'un appel à l'action isolé sur la face. */
const APPEL_MIN_SEC = 1.5;

const r2 = (x: number) => Math.round(x * 1000) / 1000;

/** Vrai si l'instant tombe à l'intérieur d'un mot (bornes exclues). Sert de garde et aux tests. */
export function coupeDansUnMot(t: number, mots: readonly { debutSec: number; finSec: number }[]): boolean {
  return mots.some((m) => t > m.debutSec + 1e-6 && t < m.finSec - 1e-6);
}

function coupesPossibles(mots: MotRealisation[], preferees: number[]): Candidate[] {
  const sortie: Candidate[] = [];
  for (let i = 1; i < mots.length; i++) {
    const avant = mots[i - 1];
    const mot = mots[i];
    const blanc = Math.max(0, mot.debutSec - avant.finSec);
    const t = blanc > 0 ? avant.finSec + blanc / 2 : mot.debutSec;
    if (coupeDansUnMot(t, mots)) continue;
    const changeBloc = !!mot.bloc && !!avant.bloc && mot.bloc !== avant.bloc;
    const nature: Nature =
      finitPhrase(avant.mot) || changeBloc ? "phrase" : blanc >= BLANC_IDEE_SEC || /[,;:—–]["»”]?$/.test(avant.mot.trim()) || LIAISONS.has(normaliser(mot.mot)) ? "idee" : "mot";
    const preferee = preferees.some((p) => Math.abs(p - t) <= TOLERANCE_PREFEREE_SEC || (p >= avant.finSec - 1e-6 && p <= mot.debutSec + 1e-6));
    const versAppel = (!!mot.bloc && BLOCS_APPEL.has(mot.bloc) && !(avant.bloc && BLOCS_APPEL.has(avant.bloc))) || (finitPhrase(avant.mot) && MOTS_APPEL.has(normaliser(mot.mot)));
    sortie.push({ t, i, nature, preferee, versAppel });
  }
  return sortie;
}

const POIDS_NATURE: Record<Nature, number> = { phrase: 3, idee: 2, mot: 0 };

/** Découpe en plans de 3 à 6 s, coupés aux débuts de phrase ou d'idée. */
function decouper(mots: MotRealisation[], fin: number, rythme: { minSec: number; maxSec: number }, preferees: number[]): { debut: number; fin: number }[] {
  const candidats = coupesPossibles(mots, preferees);
  const plans: { debut: number; fin: number }[] = [];
  let debut = 0;
  const cible = (rythme.minSec + rythme.maxSec) / 2;
  for (;;) {
    // Retour de face pour l'appel : la coupe tombe à son premier mot dès que le plan en cours a sa durée minimale.
    const appel = candidats.find((c) => c.versAppel && c.t - debut >= rythme.minSec - 1e-6 && c.t - debut <= rythme.maxSec + 2 && fin - c.t >= APPEL_MIN_SEC);
    if (appel) {
      plans.push({ debut, fin: appel.t });
      debut = appel.t;
      continue;
    }
    if (fin - debut <= rythme.maxSec) break;
    // Jamais un dernier plan plus court que le minimum.
    const utiles = candidats.filter((c) => c.t - debut >= rythme.minSec - 1e-6 && fin - c.t >= rythme.minSec - 1e-6);
    let fenetre = utiles.filter((c) => c.t - debut <= rythme.maxSec + 1e-6);
    // Rien de bon dans la fenêtre : début de phrase ou d'idée juste après (≤ 2 s de plus) ; sinon, plutôt qu'une coupe
    // au milieu d'une phrase, un dernier plan un peu plus long (≤ max + min) ; en dernier recours, un simple blanc.
    if (!fenetre.some((c) => c.nature !== "mot")) {
      const apres = utiles.filter((c) => c.nature !== "mot" && c.t - debut <= rythme.maxSec + 2);
      if (apres.length) fenetre = [apres[0]];
    }
    if (!fenetre.some((c) => c.nature !== "mot") && fin - debut <= rythme.maxSec + rythme.minSec) break;
    if (!fenetre.length) {
      const suivante = utiles[0];
      if (!suivante) break;
      fenetre = [suivante];
    }
    const note = (c: Candidate) => POIDS_NATURE[c.nature] + (c.preferee ? 1.5 : 0) - Math.abs(c.t - debut - cible) * 0.3;
    const choisie = fenetre.reduce((a, b) => (note(b) > note(a) ? b : a));
    plans.push({ debut, fin: choisie.t });
    debut = choisie.t;
  }
  plans.push({ debut, fin });
  return plans;
}

function motsDuPlan(mots: MotRealisation[], p: { debut: number; fin: number }): number[] {
  const idx: number[] = [];
  mots.forEach((m, i) => {
    const milieu = (m.debutSec + m.finSec) / 2;
    if (milieu >= p.debut && milieu < p.fin) idx.push(i);
  });
  return idx;
}

function raisonDu(mots: MotRealisation[], idx: number[], emphases: Set<string>, premier: boolean): RaisonAngle {
  if (premier) return "accroche";
  if (!idx.length) return "neutre";
  const formes = idx.map((i) => normaliser(mots[i].mot));
  const blocs = idx.map((i) => mots[i].bloc).filter(Boolean) as string[];
  const blocDominant = blocs.length ? blocs[0] : undefined;
  if ((blocDominant && BLOCS_APPEL.has(blocDominant)) || formes.some((f) => MOTS_APPEL.has(f))) return "appel";
  const dernier = mots[idx[idx.length - 1]].mot.trim();
  const fort =
    idx.some((i) => mots[i].enValeur || emphases.has(normaliser(mots[i].mot))) ||
    formes.some((f) => MOTS_FORTS.has(f)) ||
    /!["»”]?$/.test(dernier) ||
    idx.some((i) => /\d|€|%/.test(mots[i].mot)) ||
    (!!blocDominant && BLOCS_FORTS.has(blocDominant));
  if (fort) return "phrase-forte";
  if ((blocDominant && BLOCS_EXPLICATION.has(blocDominant)) || formes.some((f) => MOTS_EXPLICATION.has(f))) return "explication";
  return "neutre";
}

/** Préférence de chaque angle selon le sens du passage (plus c'est haut, mieux c'est). */
const PREFERENCES: Record<RaisonAngle, Record<AngleMulticamera, number>> = {
  accroche: { face: 100, cote: 1, "contre-plongee": 2 },
  appel: { face: 100, cote: 1, "contre-plongee": 1 },
  "phrase-forte": { face: 2, cote: 1, "contre-plongee": 6 },
  explication: { face: 2, cote: 6, "contre-plongee": 1 },
  neutre: { face: 3, cote: 2, "contre-plongee": 2 },
  repli: { face: 1, cote: 0, "contre-plongee": 0 },
};

/**
 * Choix des angles : la suite qui suit le mieux le sens, sans jamais deux fois le même angle de suite (programmation
 * dynamique, déterministe). Avec un seul angle disponible, la contrainte tombe.
 */
function choisirAngles(raisons: RaisonAngle[], angles: AngleMulticamera[]): AngleMulticamera[] {
  const n = raisons.length;
  if (angles.length === 1) return raisons.map(() => angles[0]);
  const meilleur: number[][] = [];
  const precedent: number[][] = [];
  for (let k = 0; k < n; k++) {
    meilleur.push([]);
    precedent.push([]);
    angles.forEach((a, j) => {
      // Vérif A2 (10/10) : l'accroche est TOUJOURS de face (prise d'origine). Avant, à égalité avec un appel de face
      // juste après (aucun angle deux fois de suite), le départ partait sur un angle fabriqué.
      const gain = raisons[k] === "accroche" && a !== "face" ? -1e6 : PREFERENCES[raisons[k]][a];
      if (k === 0) {
        meilleur[k][j] = gain;
        precedent[k][j] = -1;
        return;
      }
      let best = -Infinity;
      let arg = -1;
      angles.forEach((_, p) => {
        if (p === j) return;
        if (meilleur[k - 1][p] > best) {
          best = meilleur[k - 1][p];
          arg = p;
        }
      });
      meilleur[k][j] = best + gain;
      precedent[k][j] = arg;
    });
  }
  let j = 0;
  angles.forEach((_, x) => {
    if (meilleur[n - 1][x] > meilleur[n - 1][j]) j = x;
  });
  const sortie: AngleMulticamera[] = new Array(n);
  for (let k = n - 1; k >= 0; k--) {
    sortie[k] = angles[j];
    j = precedent[k][j];
  }
  return sortie;
}

/** Ordre stable des angles disponibles, face toujours présente. */
export function anglesUtilisables(disponibles: readonly AngleMulticamera[]): AngleMulticamera[] {
  return ["face", "cote", "contre-plongee"].filter((a) => a === "face" || disponibles.includes(a as AngleMulticamera)) as AngleMulticamera[];
}

/** Les plans de caméra de toute la vidéo. */
export function realiserMulticamera(e: EntreeRealisation): PlanCamera[] {
  const mots = [...e.mots].sort((a, b) => a.debutSec - b.debutSec);
  const fin = Math.max(e.dureeSec ?? 0, mots.length ? mots[mots.length - 1].finSec : 0);
  const angles = anglesUtilisables(e.anglesDisponibles);
  if (angles.length === 1 || !mots.length) {
    return [{ angle: "face", debutSec: 0, finSec: r2(fin), raison: angles.length === 1 ? "repli" : "neutre", premierMot: mots.length ? 0 : -1, dernierMot: mots.length - 1 }];
  }
  const rythme = e.rythme ?? RYTHME_MULTICAMERA;
  const emphases = new Set((e.emphases ?? []).map(normaliser));
  const tranches = decouper(mots, fin, rythme, e.coupesPrefereesSec ?? []);

  // L'appel à l'action reste d'un seul tenant (de face) : ses plans successifs fusionnent.
  type Bout = { debut: number; fin: number; idx: number[]; raison: RaisonAngle };
  const bouts: Bout[] = [];
  tranches.forEach((t, k) => {
    const idx = motsDuPlan(mots, t);
    const raison = raisonDu(mots, idx, emphases, k === 0);
    const dernier = bouts[bouts.length - 1];
    if (dernier && dernier.raison === "appel" && raison === "appel") {
      dernier.fin = t.fin;
      dernier.idx.push(...idx);
    } else bouts.push({ ...t, idx, raison });
  });

  const choix = choisirAngles(
    bouts.map((b) => b.raison),
    angles,
  );
  return bouts.map((b, k) => ({
    angle: choix[k],
    debutSec: r2(b.debut),
    finSec: r2(b.fin),
    raison: b.raison,
    premierMot: b.idx.length ? b.idx[0] : -1,
    dernierMot: b.idx.length ? b.idx[b.idx.length - 1] : -1,
  }));
}

/** L'angle montré à l'instant `t` (le dernier plan couvre jusqu'à la fin). */
export function angleAuTemps(plans: readonly PlanCamera[], t: number): AngleMulticamera {
  const p = plans.find((x) => t >= x.debutSec && t < x.finSec) ?? plans[plans.length - 1];
  return p?.angle ?? "face";
}
