/**
 * RÈGLES DE DIVERSITÉ « v2 ÉNERGIE » D0 à D13 (standard DA du 16/10/2026, § E) — PURES, vérifiables par code.
 *
 * Retour de Will : « toujours carré, mêmes emplacements, pas d'énergie ». Chaque apparition d'un élément v2 porte 4 étiquettes
 * (famille = l'id du catalogue, emplacement E1-E7, forme F1-F13, mouvement M1-M11 / P1-P5) plus l'angle et la sortie
 * (`catalogue-v2.ts`). Les règles ci-dessous lisent `plan.elementsV2` et rendent des messages en français commençant par leur
 * code (« D1a — … »), comme R1 à R7 de `regles.ts`. Un plan SANS `elementsV2` n'est pas concerné (rien ne change pour lui).
 *
 * ÉCHEC BLOQUANT (le plan n'est pas rendu, standard § E) : D0 (élément inconnu ou écarté), D1, D3, D4, D9, D10.
 * Les autres échecs sont des erreurs ordinaires (le réalisateur recommence), comme R2 ou R6.
 *
 * Périmètre, dit franchement :
 * - les règles D1, D2, D3, D5, D6, D7, D8, D12 portent sur la SUITE des éléments v2 (seuls à avoir emplacement, forme,
 *   mouvement, angle, sortie, taille) ; les anciennes familles (cartes, fenêtres, étiquettes, 12 motions) n'ont pas ces étiquettes ;
 * - D4 (rectangles), D9, D10, D11 portent sur la LIGNE DE TEMPS FUSIONNÉE : éléments v2 + cartes, fenêtres, étiquettes et motions
 *   (un plein écran ancien compte avec les coups de poing, une carte ou une étiquette est un rectangle F12) ;
 * - les règles à pourcentage (D3c, D4a, D4d, D5a, D5b, D7a) ne se jugent qu'à partir de `SEUILS_V2.statistiqueMin` (10) éléments : ce
 *   sont des quotas de vidéo, sur un extrait de 15 s un pourcentage ne veut rien dire ;
 * - D3 (fenêtre glissante de 60 s) ne se juge que sur une vidéo d'au moins 60 s.
 */
import type { ElementV2Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { apparitionsDuPlan, CATALOGUE_FAMILLES, familleDeSon, type Apparition } from "./familles";
import {
  classeTailleV2, ficheV2, estCoupDePoingV2, FORMES_PREFEREES_V2, NOMS_EMPLACEMENTS_V2, signeAngleV2,
  type FicheCatalogueV2,
} from "./catalogue-v2";
import { motsInterditsDans, nettoyer, nombresDansTexte, nombresDits, sansElision, simplifier, type MotTranscrit } from "./mots";
import type { HistoriqueVideo } from "./regles";
import { EPS } from "@/briques/intensite/orchestrateur";

export { EPS };

/** Seuils du standard § E (D1 à D13). */
export const SEUILS_V2 = Object.freeze({
  /** D9 : premier élément entre 0,8 et 2,0 s ; rien qui couvre le visage avant 5 s ; aucun plein écran avant 10 s. */
  premierElementSec: [0.8, 2.0] as const,
  couvertureAvantSec: 5,
  pleinEcranAvantSec: 10,
  /** D2 : fenêtre de 5 apparitions. */
  fenetreApparitions: 5,
  differentsDansFenetre: 4,
  /** D3 : fenêtre glissante de 60 s. */
  fenetreSec: 60,
  lateralDansFenetreMin: 3,
  bas4PartMax: 0.3,
  /** D4 : rectangles. */
  rectanglesPartMax: 0.35,
  cartesFenetreSec: 12,
  formesPrefereesPartMin: 0.5,
  /** D5 : asymétrie. */
  inclinesPartMin: 0.6,
  inclinaisonDeg: [3, 14] as const,
  centresPartMax: 0.3,
  centreBande: [0.4, 0.6] as const,
  /** D6 : contraste de taille. */
  memeClasseDeSuiteMax: 2,
  grandToutesLesSec: 10,
  /** D7 : orange. */
  orangeSurfaceMinPct: 3,
  orangePartMin: 1 / 3,
  orangeFenetreSec: 8,
  /** D8 : secousse. */
  secousseTrancheSec: 4,
  /** D10 : coups de poing. */
  premierCoupSec: [10, 16] as const,
  ecartCoupsSec: [18, 30] as const,
  periodeCoupSec: 25,
  coupsParTranche: { minSiPlusDeSec: 45, minimum: 2, maxPour90: 4 },
  coupsAvantFinSec: 8,
  willSeulApresCoupSec: 1,
  pleinEcranPar60sMax: 2,
  /** D11 : cadence (R5d conservée). */
  intervalleMoyenSec: [1, 2.5] as const,
  sansEvenementMaxSec: 3,
  debutsEcartMinSec: 0.4,
  /** D12 : bruitages. */
  partSonMax: 0.3,
  sonsMinPourPart: 7,
  /** D13 : une vidéo de plus de 45 s contient chacun des 5 lots. */
  lotsToutesLesVideosSiPlusDeSec: 45,
  /**
   * Les règles à pourcentage (D4a, D4d, D5a, D5b, D7a, D3c) sont des quotas de VIDÉO (« repère : 40 à 55 apparitions pour 90 s ») : elles
   * ne se jugent qu'à partir de ce nombre d'éléments, un extrait de 15 s n'ayant pas de quotas à 30 % près.
   */
  statistiqueMin: 10,
});

/** Codes dont l'échec interdit le rendu (standard § E : « D1, D3, D4, D9 et D10 », plus D0 : un élément inconnu ne se rend pas). */
export const CODES_BLOQUANT_RENDU_V2 = Object.freeze(["D0", "D1", "D3", "D4", "D9", "D10"]);
/** Le plan est-il rendable, vu ses erreurs v2 ? (`regles.ts` y ajoute R1, R3a, R4a, R5a.) */
export const estRendableV2 = (erreurs: readonly string[]) => !erreurs.some((e) => /^D(?:0|1|3|4|9|10)[a-z]? — /.test(e));

const sec = (x: number) => `${x.toFixed(2).replace(".", ",")} s`;
const v = (x: number) => String(x).replace(".", ",");
const pct = (x: number) => `${(x * 100).toFixed(0)} %`;

/** Un élément du plan résolu contre le catalogue. */
export interface ElementResolu {
  fiche: FicheCatalogueV2;
  debut: number;
  fin: number;
  /** Inclinaison posée (celle du plan, sinon celle de la fiche). */
  angle: number;
  mots: readonly string[];
  /** Position dans le plan, pour les messages (« élément 3 »). */
  rang: number;
}

const nomElement = (e: ElementResolu) => `élément v2 ${e.rang} « ${e.fiche.id} » à ${sec(e.debut)}`;

/** Instant de la secousse d'un élément (s), ou null. */
const instantSecousse = (e: ElementResolu) => (e.fiche.secousseSec === null ? null : e.debut + e.fiche.secousseSec);

/* ---------------- D0 : résolution contre le catalogue ---------------- */

export function resoudreElementsV2(elements: readonly ElementV2Plan[] | undefined, duree: number): { elements: ElementResolu[]; erreurs: string[] } {
  const erreurs: string[] = [];
  const resolus: ElementResolu[] = [];
  [...(elements ?? [])].sort((a, b) => a.debut - b.debut || a.fin - b.fin).forEach((e, k) => {
    const fiche = ficheV2(e.id);
    const rang = k + 1;
    if (!fiche) {
      erreurs.push(`D0 — élément v2 ${rang} : « ${e.id} » n'existe pas dans le catalogue des 24 éléments.`);
      return;
    }
    if (!fiche.actif) erreurs.push(`D0 — élément v2 ${rang} « ${e.id} » : cet élément est ÉCARTÉ du catalogue (actif: false) ; choisissez-en un autre.`);
    if (e.fin <= e.debut + EPS) erreurs.push(`D0 — élément v2 ${rang} « ${e.id} » : il finit (${sec(e.fin)}) avant d'avoir commencé (${sec(e.debut)}).`);
    else {
      const d = e.fin - e.debut;
      const [min, max] = fiche.dureeSec;
      if (d < min - 0.05 || d > max + 0.05) erreurs.push(`D0 — élément v2 ${rang} « ${e.id} » : ${sec(d)} à l'écran, la fiche prévoit de ${sec(min)} à ${sec(max)}.`);
    }
    if (e.fin > duree + EPS) erreurs.push(`D0 — élément v2 ${rang} « ${e.id} » : il finit à ${sec(e.fin)}, après la fin de la vidéo (${sec(duree)}).`);
    resolus.push({ fiche, debut: e.debut, fin: e.fin, angle: e.angle ?? fiche.angle, mots: e.mots ?? [], rang });
  });
  return { elements: resolus, erreurs };
}

/* ---------------- Ligne de temps fusionnée (D4, D9, D10, D11) ---------------- */

export type GenreFusion = "v2" | "carte" | "fenetre" | "etiquette" | "motion";

export interface ItemFusionne {
  genre: GenreFusion;
  nom: string;
  debut: number;
  fin: number;
  /** F12 : carte, fenêtre, étiquette. */
  rectangle: boolean;
  /** Plein écran (E7). */
  plein: boolean;
  couvre: boolean;
  /** Grand (D6) : plein écran, ou surface d'entrée de plus de 15 % de l'image. */
  grand: boolean;
  v2?: ElementResolu;
}

/** Les apparitions de l'ancien catalogue vues comme des items de la ligne de temps. */
function itemsAnciens(ap: readonly Apparition[]): ItemFusionne[] {
  return ap.map((x) => ({
    genre: x.famille === "carte" ? "carte" : x.famille === "fenetre" ? "fenetre" : x.famille === "etiquette" ? "etiquette" : "motion",
    nom: x.nom,
    debut: x.debut,
    fin: x.fin,
    rectangle: x.famille === "carte" || x.famille === "fenetre" || x.famille === "etiquette",
    plein: x.plein,
    couvre: x.couvre,
    grand: x.plein || CATALOGUE_FAMILLES[x.famille].surfaceEntree > 15,
  }));
}

const itemsV2 = (els: readonly ElementResolu[]): ItemFusionne[] =>
  els.map((e) => ({ genre: "v2", nom: nomElement(e), debut: e.debut, fin: e.fin, rectangle: false, plein: e.fiche.emplacement === "E7", couvre: e.fiche.couvreVisage, grand: classeTailleV2(e.fiche) === "grand", v2: e }));

const parDebut = (a: ItemFusionne, b: ItemFusionne) => a.debut - b.debut || a.fin - b.fin;

/* ---------------- Le contrôle ---------------- */

export interface ContexteControleV2 {
  /** Durée de la vidéo (s) et début de l'écran de fin : l'horizon des fenêtres glissantes est le plus petit des deux. */
  duree: number;
  finDebut: number;
  /** Apparitions des cartes, fenêtres, étiquettes et motions du plan. */
  anciennes?: readonly Apparition[];
  /** Début des cartes (D4c : une carte au plus par fenêtre de 12 s). */
  debutsCartes?: readonly number[];
  /** Le plan porte des zooms ou des mouvements de cadrage (interdits par Will ; D8 le redit). */
  prisBougee?: boolean;
  /** Les 5 dernières vidéos, la plus récente en premier (D13). */
  historique?: readonly HistoriqueVideo[];
}

export interface MesuresV2 {
  elements: number;
  emplacements: Record<string, number>;
  formes: Record<string, number>;
  mouvements: Record<string, number>;
  coupsDePoing: number;
  partRectangles: number;
  partInclines: number;
  partCentres: number;
  partOrange: number;
  premierElementSec: number | null;
  premierCoupDePoingSec: number | null;
}

const compte = (valeurs: readonly string[]) => valeurs.reduce<Record<string, number>>((r, x) => ((r[x] = (r[x] ?? 0) + 1), r), {});

/** Fenêtres de `largeur` s glissant de 0,5 s sur [0, horizon] ; une seule si la vidéo est plus courte. */
function fenetres(horizon: number, largeur: number, pas = 0.5): [number, number][] {
  if (horizon <= largeur + EPS) return [[0, horizon]];
  const r: [number, number][] = [];
  for (let t = 0; t + largeur <= horizon + EPS; t += pas) r.push([t, t + largeur]);
  return r;
}

/**
 * Contrôle d'une SUITE d'éléments v2 (fonction pure, testable sans plan). Les messages commencent par leur code.
 * `mots` : la transcription (littéralité) ; absente, la littéralité n'est pas contrôlée.
 */
export function controlerSuiteV2(elements: readonly ElementResolu[], ctx: ContexteControleV2, mots?: readonly MotTranscrit[]): { erreurs: string[]; avertissements: string[]; mesures: MesuresV2 } {
  const S = SEUILS_V2;
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const els = [...elements].sort((a, b) => a.debut - b.debut || a.fin - b.fin);
  const N = els.length;
  const horizon = Math.min(ctx.finDebut, ctx.duree);
  const anciennes = ctx.anciennes ?? [];
  const fusion = [...itemsAnciens(anciennes.filter((x) => x.debut < horizon)), ...itemsV2(els.filter((e) => e.debut < horizon))].sort(parDebut);
  const fiches = els.map((e) => e.fiche);
  const stat = N >= S.statistiqueMin;

  const mesures: MesuresV2 = {
    elements: N,
    emplacements: compte(fiches.map((f) => f.emplacement)),
    formes: compte(fiches.map((f) => f.forme)),
    mouvements: compte(fiches.map((f) => f.mouvement)),
    coupsDePoing: fiches.filter(estCoupDePoingV2).length,
    partRectangles: fusion.length ? fusion.filter((x) => x.rectangle).length / fusion.length : 0,
    partInclines: N ? els.filter((e) => Math.abs(e.angle) >= S.inclinaisonDeg[0] - EPS && Math.abs(e.angle) <= S.inclinaisonDeg[1] + EPS).length / N : 0,
    partCentres: N ? els.filter((e) => e.fiche.centreX >= S.centreBande[0] - EPS && e.fiche.centreX <= S.centreBande[1] + EPS).length / N : 0,
    partOrange: N ? els.filter((e) => e.fiche.orangePct >= S.orangeSurfaceMinPct - EPS).length / N : 0,
    premierElementSec: N ? els[0].debut : null,
    premierCoupDePoingSec: els.find((e) => estCoupDePoingV2(e.fiche))?.debut ?? null,
  };
  if (!N) return { erreurs, avertissements, mesures };

  /* D1 — jamais deux fois de suite : emplacement, forme, mouvement, famille, signe d'inclinaison, sortie. */
  for (let k = 1; k < N; k++) {
    const a = els[k - 1];
    const b = els[k];
    const aucun = `${nomElement(a)} puis ${nomElement(b)}`;
    if (a.fiche.emplacement === b.fiche.emplacement) erreurs.push(`D1a — ${aucun} : même emplacement ${b.fiche.emplacement} (${NOMS_EMPLACEMENTS_V2[b.fiche.emplacement]}) deux fois de suite ; les emplacements tournent.`);
    if (a.fiche.forme === b.fiche.forme) erreurs.push(`D1b — ${aucun} : même forme ${b.fiche.forme} deux fois de suite.`);
    if (a.fiche.mouvement === b.fiche.mouvement) erreurs.push(`D1c — ${aucun} : même mouvement d'entrée ${b.fiche.mouvement} deux fois de suite.`);
    if (a.fiche.id === b.fiche.id) erreurs.push(`D1d — ${aucun} : le même élément deux fois de suite.`);
    if (signeAngleV2(a.angle) === signeAngleV2(b.angle)) erreurs.push(`D1e — ${aucun} : même sens d'inclinaison (${a.angle}° puis ${b.angle}°) ; on alterne + et −.`);
    if (a.fiche.sortie === b.fiche.sortie) erreurs.push(`D1f — ${aucun} : même sortie « ${b.fiche.sortie} » deux fois de suite ; deux éléments consécutifs ne sortent jamais de la même façon.`);
  }

  /* D2 — fenêtre de 5 apparitions consécutives : 4 emplacements, 4 formes, 4 mouvements différents, et un latéral. */
  if (N >= S.fenetreApparitions) {
    for (let k = 0; k + S.fenetreApparitions <= N; k++) {
      const w = els.slice(k, k + S.fenetreApparitions);
      const de = `de ${sec(w[0].debut)} à ${sec(w[w.length - 1].debut)}`;
      const diffs = (cle: (f: FicheCatalogueV2) => string) => new Set(w.map((e) => cle(e.fiche))).size;
      if (diffs((f) => f.emplacement) < S.differentsDansFenetre) erreurs.push(`D2a — seulement ${diffs((f) => f.emplacement)} emplacements différents sur les ${S.fenetreApparitions} éléments ${de} ; ${S.differentsDansFenetre} au moins.`);
      if (diffs((f) => f.forme) < S.differentsDansFenetre) erreurs.push(`D2b — seulement ${diffs((f) => f.forme)} formes différentes sur les ${S.fenetreApparitions} éléments ${de} ; ${S.differentsDansFenetre} au moins.`);
      if (diffs((f) => f.mouvement) < S.differentsDansFenetre) erreurs.push(`D2c — seulement ${diffs((f) => f.mouvement)} mouvements différents sur les ${S.fenetreApparitions} éléments ${de} ; ${S.differentsDansFenetre} au moins.`);
      if (!w.some((e) => e.fiche.emplacement === "E2" || e.fiche.emplacement === "E3")) erreurs.push(`D2d — aucun élément latéral (gauche E2 ou droite E3) sur les ${S.fenetreApparitions} éléments ${de} ; un au moins.`);
    }
  }

  /* D3 — fenêtre glissante de 60 s (vidéos de 60 s et plus) : les 6 emplacements E1 à E6, E2 et E3 ensemble 3 fois, E4 ≤ 30 %. */
  if (horizon >= S.fenetreSec - EPS) {
    for (const [a, b] of fenetres(horizon, S.fenetreSec)) {
      const dedans = els.filter((e) => e.debut >= a - EPS && e.debut < b - EPS);
      const presents = new Set(dedans.map((e) => e.fiche.emplacement));
      const manquants = (["E1", "E2", "E3", "E4", "E5", "E6"] as const).filter((x) => !presents.has(x));
      if (manquants.length) {
        erreurs.push(`D3a — il manque ${manquants.map((x) => `${x} (${NOMS_EMPLACEMENTS_V2[x]})`).join(", ")} entre ${sec(a)} et ${sec(b)} ; les 6 emplacements E1 à E6 apparaissent tous au moins une fois sur toute fenêtre de 60 s.`);
        break;
      }
    }
    for (const [a, b] of fenetres(horizon, S.fenetreSec)) {
      const dedans = els.filter((e) => e.debut >= a - EPS && e.debut < b - EPS);
      const laterales = dedans.filter((e) => e.fiche.emplacement === "E2" || e.fiche.emplacement === "E3").length;
      if (laterales < S.lateralDansFenetreMin) {
        erreurs.push(`D3b — ${laterales} élément${laterales > 1 ? "s" : ""} latéral${laterales > 1 ? "aux" : ""} (E2 ou E3) entre ${sec(a)} et ${sec(b)} ; ${S.lateralDansFenetreMin} au moins sur toute fenêtre de 60 s.`);
        break;
      }
    }
  }
  if (stat) {
    const bas = els.filter((e) => e.fiche.emplacement === "E4").length;
    if (bas > S.bas4PartMax * N + EPS) erreurs.push(`D3c — ${bas} éléments en bas (E4) sur ${N} (${pct(bas / N)}) ; ${pct(S.bas4PartMax)} au plus (le défaut de la planche refusée : tout en bas, au centre).`);
  }

  /* D4 — rectangles : au plus 35 % des apparitions, jamais 2 de suite, au plus une carte par fenêtre de 12 s, formes préférées ≥ 50 %. */
  if (fusion.length >= S.statistiqueMin) {
    const rect = fusion.filter((x) => x.rectangle).length;
    if (rect > S.rectanglesPartMax * fusion.length + EPS) erreurs.push(`D4a — ${rect} rectangles (cartes, fenêtres, étiquettes) sur ${fusion.length} apparitions (${pct(rect / fusion.length)}) ; ${pct(S.rectanglesPartMax)} au plus.`);
    const preferees = fusion.filter((x) => x.v2 && FORMES_PREFEREES_V2.includes(x.v2.fiche.forme)).length;
    if (preferees < S.formesPrefereesPartMin * fusion.length - EPS) erreurs.push(`D4d — ${preferees} apparitions sur ${fusion.length} (${pct(preferees / fusion.length)}) ont une forme F1-F6, F9 ou F11 ; ${pct(S.formesPrefereesPartMin)} au moins.`);
  }
  for (let k = 1; k < fusion.length; k++) {
    if (fusion[k].rectangle && fusion[k - 1].rectangle) erreurs.push(`D4b — ${fusion[k - 1].nom} puis ${fusion[k].nom} : deux rectangles de suite.`);
  }
  const cartes = [...(ctx.debutsCartes ?? [])].sort((a, b) => a - b);
  for (let k = 1; k < cartes.length; k++) {
    if (cartes[k] - cartes[k - 1] < S.cartesFenetreSec - EPS) {
      erreurs.push(`D4c — deux cartes à ${sec(cartes[k - 1])} et ${sec(cartes[k])} ; au plus une carte par fenêtre de ${S.cartesFenetreSec} s.`);
      break;
    }
  }

  /* D5 — asymétrie : ≥ 60 % inclinés de 3 à 14°, ≤ 30 % centrés sur l'axe, après un latéral à gauche le prochain latéral va à droite. */
  if (stat) {
    const inclines = Math.round(mesures.partInclines * N);
    if (inclines < S.inclinesPartMin * N - EPS) erreurs.push(`D5a — ${inclines} éléments sur ${N} (${pct(mesures.partInclines)}) inclinés de ${S.inclinaisonDeg[0]} à ${S.inclinaisonDeg[1]}° ; ${pct(S.inclinesPartMin)} au moins (une composition droite et symétrique paraît calme).`);
    const centres = Math.round(mesures.partCentres * N);
    if (centres > S.centresPartMax * N + EPS) erreurs.push(`D5b — ${centres} éléments sur ${N} (${pct(mesures.partCentres)}) centrés sur l'axe vertical (entre ${v(S.centreBande[0])} et ${v(S.centreBande[1])} L) ; ${pct(S.centresPartMax)} au plus.`);
  }
  let dernierCote: "E2" | "E3" | null = null;
  let dernierLateral: ElementResolu | null = null;
  for (const e of els) {
    if (e.fiche.emplacement !== "E2" && e.fiche.emplacement !== "E3") continue;
    if (dernierCote === e.fiche.emplacement && dernierLateral) erreurs.push(`D5c — ${nomElement(dernierLateral)} puis ${nomElement(e)} : deux éléments latéraux du même côté (${e.fiche.emplacement}) ; après la gauche, le prochain latéral va à droite, et inversement.`);
    dernierCote = e.fiche.emplacement;
    dernierLateral = e;
  }

  /* D6 — contraste de taille : jamais 3 de suite dans la même classe, au moins un « grand » toutes les 10 s. */
  for (let k = 2; k < N; k++) {
    const c = classeTailleV2(els[k].fiche);
    if (c === classeTailleV2(els[k - 1].fiche) && c === classeTailleV2(els[k - 2].fiche)) erreurs.push(`D6a — ${nomElement(els[k - 2])}, ${nomElement(els[k - 1])} et ${nomElement(els[k])} sont tous trois de classe « ${c} » ; jamais 3 éléments de suite dans la même classe de taille.`);
  }
  if (horizon >= S.grandToutesLesSec - EPS) {
    const grands = fusion.filter((x) => x.grand);
    for (const [a, b] of fenetres(horizon, S.grandToutesLesSec)) {
      if (!grands.some((g) => g.debut >= a - EPS && g.debut < b - EPS)) {
        erreurs.push(`D6b — aucun élément « grand » (plus de 15 % de l'image, ou plein écran) n'entre entre ${sec(a)} et ${sec(b)} ; un au moins toutes les ${S.grandToutesLesSec} s.`);
        break;
      }
    }
  }

  /* D7 — orange : au moins 1 élément sur 3 avec une surface orange pleine ≥ 3 % de l'image, et un par fenêtre de 8 s. */
  if (stat && mesures.partOrange < S.orangePartMin - EPS) erreurs.push(`D7a — ${Math.round(mesures.partOrange * N)} éléments sur ${N} (${pct(mesures.partOrange)}) ont une surface orange pleine d'au moins ${S.orangeSurfaceMinPct} % de l'image ; un sur trois au moins.`);
  if (horizon >= S.orangeFenetreSec - EPS) {
    const oranges = els.filter((e) => e.fiche.orangePct >= S.orangeSurfaceMinPct - EPS);
    for (const [a, b] of fenetres(horizon, S.orangeFenetreSec)) {
      if (!oranges.some((e) => e.debut < b - EPS && e.fin > a + EPS)) {
        erreurs.push(`D7b — aucun élément orange (surface pleine ≥ ${S.orangeSurfaceMinPct} %) à l'écran entre ${sec(a)} et ${sec(b)} ; un au moins par fenêtre de ${S.orangeFenetreSec} s.`);
        break;
      }
    }
  }

  /* D8 — secousse : au plus une par tranche de 4 s, de l'élément seul ; la prise ne bouge jamais. */
  const secousses = els.map((e) => ({ e, t: instantSecousse(e) })).filter((x): x is { e: ElementResolu; t: number } => x.t !== null).sort((a, b) => a.t - b.t);
  for (let k = 1; k < secousses.length; k++) {
    if (secousses[k].t - secousses[k - 1].t < S.secousseTrancheSec - EPS) {
      erreurs.push(`D8a — secousse de ${nomElement(secousses[k - 1].e)} à ${sec(secousses[k - 1].t)} et de ${nomElement(secousses[k].e)} à ${sec(secousses[k].t)} : ${sec(secousses[k].t - secousses[k - 1].t)} d'écart ; une secousse au plus par tranche de ${S.secousseTrancheSec} s.`);
    }
  }
  if (ctx.prisBougee) erreurs.push("D8b — la prise porte un zoom ou un mouvement de cadrage ; la secousse ne touche que l'élément, jamais la prise de Will (décision du 15/10 : aucun zoom).");

  /* D9 — ouverture : premier élément « entier » et vif entre 0,8 et 2 s, rien qui couvre le visage avant 5 s, aucun plein écran avant 10 s. */
  const premier = fusion[0];
  if (premier && premier.genre !== "v2") erreurs.push(`D9a — le premier élément est ${premier.nom}, pas un élément v2 ; la micro-accroche à ${v(S.premierElementSec[0])}-${v(S.premierElementSec[1])} s est un élément v2 vif.`);
  else if (premier?.v2) {
    const e = premier.v2;
    if (e.debut < S.premierElementSec[0] - EPS || e.debut > S.premierElementSec[1] + EPS) erreurs.push(`D9a — le premier élément (${nomElement(e)}) entre à ${sec(e.debut)} ; il entre entre ${sec(S.premierElementSec[0])} et ${sec(S.premierElementSec[1])} (rien d'autre que les sous-titres avant).`);
    if (!e.fiche.accrocheOuverture || !["E5", "E1", "E2", "E3"].includes(e.fiche.emplacement)) {
      erreurs.push(`D9b — le premier élément (${nomElement(e)}, ${e.fiche.emplacement}) n'est pas une accroche d'ouverture ; choisissez parmi mot-saute, eclat-mot, autocollant-mot, pastille-chiffre, bulle-cri et onde-de-choc, en E5, E1, E2 ou E3.`);
    }
  }
  for (const x of fusion.filter((y) => y.couvre && y.debut < S.couvertureAvantSec - EPS)) erreurs.push(`D9c — ${x.nom} couvre le visage avant ${S.couvertureAvantSec} s ; le visage de Will reste visible jusqu'à ${S.couvertureAvantSec} s.`);
  for (const x of fusion.filter((y) => y.plein && y.debut < S.pleinEcranAvantSec - EPS)) erreurs.push(`D9d — ${x.nom} est plein écran avant ${S.pleinEcranAvantSec} s ; aucun E7 avant ${S.pleinEcranAvantSec} s.`);

  /* D10 — coups de poing (P1 à P5). */
  const coups = els.filter((e) => estCoupDePoingV2(e.fiche));
  const [min1, max1] = S.premierCoupSec;
  if (coups.length && (coups[0].debut < min1 - EPS || coups[0].debut > max1 + EPS)) erreurs.push(`D10a — le premier coup de poing (${nomElement(coups[0])}) tombe à ${sec(coups[0].debut)} ; entre ${sec(min1)} et ${sec(max1)}.`);
  for (let k = 1; k < coups.length; k++) {
    const ecart = coups[k].debut - coups[k - 1].debut;
    if (ecart < S.ecartCoupsSec[0] - EPS || ecart > S.ecartCoupsSec[1] + EPS) erreurs.push(`D10b — ${sec(ecart)} entre le coup de poing à ${sec(coups[k - 1].debut)} et celui à ${sec(coups[k].debut)} ; de ${S.ecartCoupsSec[0]} à ${S.ecartCoupsSec[1]} s d'écart (un environ toutes les ${S.periodeCoupSec} s).`);
  }
  {
    const cible = Math.round(horizon / S.periodeCoupSec);
    const T = S.coupsParTranche;
    const minimum = horizon > T.minSiPlusDeSec ? Math.max(T.minimum, cible - 1) : horizon >= 20 ? 1 : 0;
    const maximum = Math.max(1, Math.ceil((T.maxPour90 * horizon) / 90 - EPS));
    if (coups.length < minimum) erreurs.push(`D10c — ${coups.length} coup${coups.length > 1 ? "s" : ""} de poing pour ${sec(horizon)} ; ${minimum} au moins (environ un toutes les ${S.periodeCoupSec} s, deux au moins au-delà de ${T.minSiPlusDeSec} s).`);
    if (coups.length > maximum) erreurs.push(`D10c — ${coups.length} coups de poing pour ${sec(horizon)} ; ${maximum} au plus (${T.maxPour90} par tranche de 90 s).`);
  }
  {
    const vus = new Map<string, ElementResolu>();
    for (const c of coups) {
      const avant = vus.get(c.fiche.mouvement);
      if (avant) erreurs.push(`D10d — le coup de poing ${c.fiche.mouvement} revient (${nomElement(avant)} puis ${nomElement(c)}) ; les 5 types ne se répètent pas dans une même vidéo.`);
      else vus.set(c.fiche.mouvement, c);
    }
  }
  {
    const pleins = fusion.filter((x) => x.plein);
    for (const [a, b] of fenetres(horizon, S.fenetreSec)) {
      const n = pleins.filter((x) => x.debut >= a - EPS && x.debut < b - EPS).length;
      if (n > S.pleinEcranPar60sMax) {
        erreurs.push(`D10e — ${n} plein écran (coups de poing, volets, écrans partagés) entre ${sec(a)} et ${sec(b)} ; ${S.pleinEcranPar60sMax} au plus par 60 s.`);
        break;
      }
    }
    for (let k = 1; k < pleins.length; k++) {
      const entre = fusion.filter((x) => x.debut > pleins[k - 1].debut + EPS && x.debut < pleins[k].debut - EPS);
      if (!entre.length) erreurs.push(`D10h — ${pleins[k - 1].nom} puis ${pleins[k].nom} : deux plein écran consécutifs ; jamais deux E7 de suite.`);
    }
  }
  if (coups.length) {
    const dernier = coups[coups.length - 1];
    if (dernier.debut > ctx.finDebut - S.coupsAvantFinSec + EPS) erreurs.push(`D10f — le dernier coup de poing (${nomElement(dernier)}) tombe à ${sec(dernier.debut)}, moins de ${S.coupsAvantFinSec} s avant l'écran de fin (${sec(ctx.finDebut)}).`);
  }
  for (const c of coups) {
    const suivant = fusion.find((x) => x.debut > c.debut + EPS && x.v2 !== c);
    if (!suivant) continue;
    const vide = suivant.debut - c.fin;
    if (vide < S.willSeulApresCoupSec - EPS) erreurs.push(`D10g — ${suivant.nom} entre ${sec(Math.max(0, vide))} après la fin du coup de poing ${nomElement(c)} ; au moins ${sec(S.willSeulApresCoupSec)} de Will seul.`);
    const classe = suivant.v2 ? classeTailleV2(suivant.v2.fiche) : suivant.grand ? "grand" : "moyen";
    if (suivant.rectangle || classe === "grand") erreurs.push(`D10g — après le coup de poing ${nomElement(c)}, ${suivant.nom} est ${suivant.rectangle ? "un rectangle" : "un élément grand"} ; l'élément suivant est « petit » ou « moyen », jamais un grand ni un rectangle.`);
  }

  /* D11 — cadence (R5d conservée, sur la ligne de temps fusionnée). */
  if (fusion.length) {
    const moyen = horizon / fusion.length;
    if (moyen < S.intervalleMoyenSec[0] - EPS || moyen > S.intervalleMoyenSec[1] + EPS) erreurs.push(`D11a — un événement visuel toutes les ${v(Math.round(moyen * 100) / 100)} s en moyenne (${fusion.length} apparitions pour ${sec(horizon)}) ; il en faut un toutes les ${v(S.intervalleMoyenSec[0])} à ${v(S.intervalleMoyenSec[1])} s.`);
    const points = [0, ...fusion.map((x) => x.debut), horizon];
    for (let k = 1; k < points.length; k++) {
      if (points[k] - points[k - 1] > S.sansEvenementMaxSec + EPS) erreurs.push(`D11b — ${sec(points[k] - points[k - 1])} sans nouvel objet entre ${sec(points[k - 1])} et ${sec(points[k])} ; ${S.sansEvenementMaxSec} s au plus.`);
    }
    for (let k = 1; k < fusion.length; k++) {
      if (fusion[k].debut - fusion[k - 1].debut < S.debutsEcartMinSec - EPS) erreurs.push(`D11c — ${fusion[k - 1].nom} et ${fusion[k].nom} commencent à ${sec(fusion[k].debut - fusion[k - 1].debut)} d'écart ; ${S.debutsEcartMinSec} s au moins entre deux débuts.`);
    }
  }

  /* D12 — bruitages : jamais le même fichier deux fois de suite ; un même bruitage (famille de son) ≤ 30 % des sons. */
  for (let k = 1; k < N; k++) {
    const a = els[k - 1].fiche.bruitages;
    const b = els[k].fiche.bruitages;
    if (a.length && b.length && a[a.length - 1] === b[0]) erreurs.push(`D12a — ${nomElement(els[k - 1])} puis ${nomElement(els[k])} : le bruitage « ${b[0]} » deux fois de suite.`);
  }
  {
    const paires = new Map<string, number>();
    let total = 0;
    for (const e of els) for (const f of new Set(e.fiche.bruitages.map(familleDeSon))) {
      paires.set(f, (paires.get(f) ?? 0) + 1);
      total++;
    }
    if (total >= S.sonsMinPourPart) {
      for (const [f, n] of paires) if (n > S.partSonMax * total + EPS) erreurs.push(`D12b — le bruitage « ${f} » fait ${pct(n / total)} des sons des éléments v2 (${n} sur ${total}) ; ${pct(S.partSonMax)} au plus.`);
    }
  }

  /* Quotas par élément (standard § E, quotas par vidéo) : chaque élément au plus 3 fois (2 pour 1, 11, 23 ; 1 si sa fiche le dit). */
  for (const [id, n] of Object.entries(compte(fiches.map((f) => f.id)))) {
    const max = ficheV2(id)?.maxParVideo ?? 3;
    if (n > max) erreurs.push(`D14 — « ${id} » apparaît ${n} fois ; ${max} au plus par vidéo.`);
  }

  /* Littéralité : mots et chiffres affichés = mots et chiffres DITS (décision de Will), jamais « Villeexemple ». */
  for (const e of els) {
    const [tMin, tMax] = e.fiche.textes;
    if (tMax > 0 && (e.mots.length < tMin || e.mots.length > tMax)) erreurs.push(`D15a — ${nomElement(e)} : ${e.mots.length} texte${e.mots.length > 1 ? "s" : ""} affiché${e.mots.length > 1 ? "s" : ""} ; l'élément en prend de ${tMin} à ${tMax} (${e.fiche.contenu}).`);
    for (const texte of e.mots) for (const interdit of motsInterditsDans(texte)) erreurs.push(`D15b — ${nomElement(e)} : texte interdit « ${interdit} » dans « ${texte} ».`);
    if (e.fiche.exigeNombreDit && !e.mots.some((t) => /\d/.test(t))) erreurs.push(`D15c — ${nomElement(e)} : il affiche un NOMBRE dit par Will (« ${e.fiche.contenu} ») ; aucun chiffre dans ses textes.`);
    if (!mots) continue;
    const proches = mots.filter((m) => m.a >= e.debut - 2 - EPS && m.a <= e.fin + 1 + EPS);
    const dits = new Set(proches.map((m) => simplifier(sansElision(nettoyer(m.w)))));
    const nombres = nombresDits(proches);
    for (const texte of e.mots) {
      for (const n of nombresDansTexte(texte)) if (![...nombres].some((d) => Math.abs(d - n) < 1e-9)) erreurs.push(`D15d — ${nomElement(e)} : le chiffre ${v(n)} (« ${texte} ») n'est pas dit par Will entre ${sec(Math.max(0, e.debut - 2))} et ${sec(e.fin + 1)}.`);
      for (const w of texte.split(/[\s'’·/-]+/).map((x) => simplifier(sansElision(nettoyer(x)))).filter((x) => x.length >= 2 && !/\d/.test(x))) {
        if (!dits.has(w) && ![...dits].some((d) => d.includes("-") && d.split("-").includes(w))) {
          erreurs.push(`D15e — ${nomElement(e)} : le mot « ${w} » (« ${texte} ») n'est pas dit par Will entre ${sec(Math.max(0, e.debut - 2))} et ${sec(e.fin + 1)} ; l'élément n'affiche que des mots DITS.`);
          break;
        }
      }
    }
  }

  /* D13 — d'une vidéo à l'autre. */
  const hist = (ctx.historique ?? []).slice(0, 3);
  const premierEl = els[0];
  for (const [k, h] of hist.entries()) {
    const nomH = h.titre ? `« ${h.titre} »` : `n° ${k + 1} de l'historique`;
    if (h.premierV2) {
      if (h.premierV2.emplacement === premierEl.fiche.emplacement) erreurs.push(`D13a — le premier élément est en ${premierEl.fiche.emplacement} (${NOMS_EMPLACEMENTS_V2[premierEl.fiche.emplacement]}) comme celui de la vidéo ${nomH} ; l'emplacement du premier élément diffère de celui des 3 vidéos précédentes.`);
      if (h.premierV2.forme === premierEl.fiche.forme) erreurs.push(`D13b — le premier élément est en forme ${premierEl.fiche.forme} comme celui de la vidéo ${nomH} ; la forme du premier élément diffère de celle des 3 vidéos précédentes.`);
    }
  }
  const precedente = ctx.historique?.[0];
  if (precedente?.premierCoupV2 && coups.length && coups[0].fiche.mouvement === precedente.premierCoupV2) erreurs.push(`D13c — le premier coup de poing est ${coups[0].fiche.mouvement}, comme dans la vidéo précédente ; son type diffère.`);
  if (horizon > S.lotsToutesLesVideosSiPlusDeSec) {
    const lots = new Set(fiches.map((f) => f.lot));
    const manquants = ([1, 2, 3, 4, 5] as const).filter((l) => !lots.has(l));
    if (manquants.length) erreurs.push(`D13d — la vidéo dure ${sec(horizon)} mais le lot ${manquants.join(", ")} n'apparaît pas ; chacun des 5 lots est présent au moins une fois dans une vidéo de plus de ${S.lotsToutesLesVideosSiPlusDeSec} s.`);
  }

  return { erreurs, avertissements, mesures };
}

/* ---------------- Le contrôle d'un plan ---------------- */

/** Ce qu'un plan laisse dans l'historique pour D13 (vide si le plan n'a pas d'éléments v2). */
export function historiqueV2(elements: readonly ElementV2Plan[] | undefined): Pick<HistoriqueVideo, "premierV2" | "premierCoupV2" | "lotsV2"> {
  const { elements: els } = resoudreElementsV2(elements, Number.POSITIVE_INFINITY);
  if (!els.length) return {};
  const coup = els.find((e) => estCoupDePoingV2(e.fiche));
  return {
    premierV2: { emplacement: els[0].fiche.emplacement, forme: els[0].fiche.forme },
    ...(coup ? { premierCoupV2: coup.fiche.mouvement } : {}),
    lotsV2: [...new Set(els.map((e) => e.fiche.lot))].sort(),
  };
}

/** D0 à D13 sur le plan (rien si le plan n'a pas d'`elementsV2`). Les messages commencent par leur code. */
export function controlerDiversiteV2(plan: PlanFacecamAnimee, options: { historique?: readonly HistoriqueVideo[]; mots?: readonly MotTranscrit[] } = {}): { erreurs: string[]; avertissements: string[]; mesures: MesuresV2 | null } {
  if (!plan.elementsV2?.length) return { erreurs: [], avertissements: [], mesures: null };
  const resolu = resoudreElementsV2(plan.elementsV2, plan.duree);
  const r = controlerSuiteV2(
    resolu.elements,
    {
      duree: plan.duree,
      finDebut: plan.fin.debut,
      anciennes: apparitionsDuPlan(plan),
      debutsCartes: plan.cartes.map((c) => c.debut),
      prisBougee: plan.zooms.length > 0 || (plan.mouvements?.length ?? 0) > 0,
      historique: options.historique,
    },
    options.mots,
  );
  return { erreurs: [...resolu.erreurs, ...r.erreurs], avertissements: r.avertissements, mesures: r.mesures };
}
