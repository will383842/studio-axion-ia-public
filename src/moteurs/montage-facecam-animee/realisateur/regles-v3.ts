/**
 * RÈGLES DE DIVERSITÉ ET DÉCISIONS FIXES « v3 » (16/10/2026) — PURES, vérifiables par code.
 *
 * Copie ADAPTÉE de `regles-v2.ts` au catalogue v3 (`catalogue-v3.ts`) : les règles lisent `plan.elementsV3` et rendent des messages
 * en français commençant par leur code (« V1b — … »), comme R1 à R7 de `regles.ts`. Un plan SANS `elementsV3` n'est pas concerné.
 *
 * ┌─ DÉCISIONS FIXES DE WILL (16/10) — chacune a son code, tous BLOQUANTS (le plan n'est pas rendu) ─────────────────────────────┐
 * │ V1  visage ENTIER ou ENTIÈREMENT couvert. Tolérance : quand une grande fenêtre glisse sur le visage, il peut être à moitié      │
 * │     caché pendant 3 images au plus (0,1 s) le temps du passage ; en dehors de ce passage, jamais à moitié.                      │
 * │ V2  AUCUN zoom ni mouvement de cadrage sur la prise (seule la descente sous la carte du haut est permise).                      │
 * │ V3  visage visible au début : rien qui le couvre avant 3 s, aucun coup de poing avant 8 s.                                       │
 * │ V4  aucune musique (bruitages oui) : seuls les fichiers de `sons/` sont permis.                                                  │
 * │ V5  sous-titres JAMAIS sur les yeux (et jamais sous un élément qui les cache).                                                   │
 * │ V6  jamais deux fois de suite le même emplacement ni la même famille.                                                            │
 * │ V7  au plus 1 coup de poing par 20 à 25 s (écart de 20 s au moins entre deux coups de poing).                                   │
 * │ D0  seuls les éléments `actif` du catalogue (14 sur 23) peuvent être choisis.                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 * Les autres règles (variété D2, cadence D11, bruitages D12, quotas D14, littéralité D15, historique D13) sont des erreurs ordinaires :
 * le réalisateur recommence, comme pour R2 ou R6.
 *
 * Périmètre, dit franchement :
 * - l'état du visage est contrôlé sur l'EMPRISE POSÉE déclarée dans la fiche (`rect`) et sur le nombre d'images de visage partiel
 *   déclaré (`imagesVisagePartiel`, tiré de la critique du 16/10) : ce n'est pas une mesure sur le rendu ;
 * - les règles à pourcentage ne se jugent qu'à partir de `SEUILS_V3.statistiqueMin` éléments, et la fenêtre de 60 s sur une vidéo
 *   d'au moins 60 s ;
 * - un plan v3 REMPLACE les cartes, fenêtres, étiquettes et motions de l'ancien catalogue : il les laisse vides (D0b).
 */
import type { ElementV3Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import {
  bandeYeuxV3, classeTailleV3, DESCENTE_PRISE_V3, estCoupDePoingV3, etatVisagePose, ficheV3, YEUX_V3,
  type FicheCatalogueV3,
} from "./catalogue-v3";
import { familleDeSon } from "./familles";
import { motsInterditsDans, nettoyer, nombresDansTexte, nombresDits, sansElision, simplifier, type MotTranscrit } from "./mots";
import type { HistoriqueVideo } from "./regles";
import { EPS } from "./regles-v2";

/** Les 28 fichiers de `studio-rendu/compositions/interface-claire/sons/` (Kenney CC0). Aucune musique : jamais d'autre son. */
export const SONS_V3 = Object.freeze([
  "click_001", "click_002", "click_003", "confirmation_002", "ding-1", "ding-2", "ding-3", "ding-4", "ding-5", "drop_001", "drop_002", "drop_003", "drop_004",
  "eclats", "feutre", "maximize_004", "maximize_006", "maximize_008", "minimize_004", "minimize_006", "select_001", "select_002", "tick_001", "tick_002",
  "tick_004", "vibreur", "whoosh-in", "whoosh-out",
] as const);
const MUSIQUE = /musi|music|song|chanson|melod|mélod|instrumental|beat|boucle-audio/i;

/** Hauteur du bloc de sous-titres (fraction de H) : celle de `SousTitres.tsx` après l'agrandissement de 25 % (test de cohérence). */
export const HAUTEUR_SOUS_TITRES_V3 = 0.0563;
/** Hauteur par défaut du centre des sous-titres quand aucun élément v3 ne les déplace (`SOUS_TITRES.hors` de `cadrage.ts`). */
export const Y_SOUS_TITRES_DEFAUT_V3 = 0.64;

export const SEUILS_V3 = Object.freeze({
  /** V1 : images de visage partiel tolérées au passage d'un grand élément (Will, 16/10 : 3 images = 0,1 s). */
  imagesVisagePartielMax: 3,
  /** V3 : rien ne couvre le visage avant 3 s ; aucun coup de poing avant 8 s. */
  couvertureAvantSec: 3,
  coupAvantSec: 8,
  /** V7 : un coup de poing au plus par 20 à 25 s. */
  ecartCoupsSec: 20,
  periodeCoupSec: 25,
  /** Après un coup de poing, au moins 1 s de Will seul ; le dernier tombe 8 s au moins avant l'écran de fin. */
  willSeulApresCoupSec: 1,
  coupAvantFinSec: 8,
  /** D2 : fenêtre de 5 apparitions. */
  fenetreApparitions: 5,
  emplacementsDansFenetre: 4,
  famillesDansFenetre: 3,
  /** D11 : cadence (relâchée par rapport à la v2 : 14 éléments, des durées de 1 à 8 s). */
  intervalleMoyenMaxSec: 4.5,
  sansEvenementMaxSec: 7,
  debutsEcartMinSec: 0.4,
  /** D12 : bruitages. */
  partSonMax: 0.3,
  sonsMinPourPart: 7,
  statistiqueMin: 10,
});

/** Codes dont l'échec interdit le rendu : les décisions fixes de Will et le catalogue. */
export const CODES_BLOQUANT_RENDU_V3 = Object.freeze(["D0", "V1", "V2", "V3", "V4", "V5", "V6", "V7"]);
export const estRendableV3 = (erreurs: readonly string[]) => !erreurs.some((e) => /^(?:D0|V[1-7])[a-z]? — /.test(e));

const sec = (x: number) => `${x.toFixed(2).replace(".", ",")} s`;
const v = (x: number) => String(x).replace(".", ",");
const pct = (x: number) => `${(x * 100).toFixed(0)} %`;

/** Un élément du plan résolu contre le catalogue. */
export interface ElementResoluV3 {
  fiche: FicheCatalogueV3;
  debut: number;
  fin: number;
  mots: readonly string[];
  lignes: readonly { texte: string; a: number }[];
  nombre?: number;
  recherches: readonly string[];
  illustre?: string;
  /** Position dans le plan, pour les messages (« élément 3 »). */
  rang: number;
}

const nomElement = (e: ElementResoluV3) => `élément v3 ${e.rang} « ${e.fiche.id} » à ${sec(e.debut)}`;

/* ---------------- D0 : résolution contre le catalogue ---------------- */

export function resoudreElementsV3(elements: readonly ElementV3Plan[] | undefined, duree: number): { elements: ElementResoluV3[]; erreurs: string[] } {
  const erreurs: string[] = [];
  const resolus: ElementResoluV3[] = [];
  [...(elements ?? [])].sort((a, b) => a.debut - b.debut || a.fin - b.fin).forEach((e, k) => {
    const fiche = ficheV3(e.id);
    const rang = k + 1;
    if (!fiche) {
      erreurs.push(`D0 — élément v3 ${rang} : « ${e.id} » n'existe pas dans le catalogue des 23 éléments v3.`);
      return;
    }
    if (!fiche.actif) erreurs.push(`D0 — élément v3 ${rang} « ${e.id} » : cet élément est ÉCARTÉ du catalogue (actif: false, Will ne l'a pas retenu) ; choisissez-en un autre.`);
    if (e.fin <= e.debut + EPS) erreurs.push(`D0 — élément v3 ${rang} « ${e.id} » : il finit (${sec(e.fin)}) avant d'avoir commencé (${sec(e.debut)}).`);
    else {
      const d = e.fin - e.debut;
      const [min, max] = fiche.dureeSec;
      if (d < min - 0.05 || d > max + 0.05) erreurs.push(`D0 — élément v3 ${rang} « ${e.id} » : ${sec(d)} à l'écran, la fiche prévoit de ${sec(min)} à ${sec(max)}.`);
    }
    if (e.fin > duree + EPS) erreurs.push(`D0 — élément v3 ${rang} « ${e.id} » : il finit à ${sec(e.fin)}, après la fin de la vidéo (${sec(duree)}).`);
    resolus.push({ fiche, debut: e.debut, fin: e.fin, mots: e.mots ?? [], lignes: e.lignes ?? [], nombre: e.nombre, recherches: e.recherches ?? [], illustre: e.illustre, rang });
  });
  for (let k = 1; k < resolus.length; k++) {
    if (resolus[k].debut < resolus[k - 1].fin - EPS) erreurs.push(`D0 — ${nomElement(resolus[k - 1])} (jusqu'à ${sec(resolus[k - 1].fin)}) et ${nomElement(resolus[k])} sont à l'écran en même temps ; un seul élément v3 à la fois.`);
  }
  return { elements: resolus, erreurs };
}

/* ---------------- V5 : sous-titres jamais sur les yeux ---------------- */

/** Position des sous-titres (fraction de H) pendant un élément : celle de sa fiche, la position par défaut sinon, `null` : masqués. */
export const ySousTitresV3 = (f: Pick<FicheCatalogueV3, "sousTitresY">): number | null => (f.sousTitresY === undefined ? Y_SOUS_TITRES_DEFAUT_V3 : f.sousTitresY);

/** Erreurs V5 d'une fiche : la bande des sous-titres touche les yeux (qui descendent avec la prise sous `carte-verre`), sort de l'image, ou recoupe l'élément. */
export function erreursSousTitresV3(f: FicheCatalogueV3, yeux = YEUX_V3, hauteur = HAUTEUR_SOUS_TITRES_V3): string[] {
  const y = ySousTitresV3(f);
  if (y === null) return [];
  const erreurs: string[] = [];
  const demi = hauteur / 2;
  const [y0, y1] = [y - demi, y + demi];
  const decal = f.descentePrise ? DESCENTE_PRISE_V3 : 0;
  const [e0, e1] = bandeYeuxV3(yeux).map((x) => x + decal) as [number, number];
  if (y0 < e1 - EPS && y1 > e0 + EPS) erreurs.push(`V5a — « ${f.id} » : les sous-titres (de ${v(+y0.toFixed(3))} à ${v(+y1.toFixed(3))} H) tombent sur les yeux de Will (de ${v(+e0.toFixed(3))} à ${v(+e1.toFixed(3))} H) ; ils restent hors de cette bande.`);
  if (y0 < -EPS || y1 > 1 + EPS) erreurs.push(`V5b — « ${f.id} » : les sous-titres sortent de l'image (de ${v(+y0.toFixed(3))} à ${v(+y1.toFixed(3))} H).`);
  const r = f.rect;
  if (f.emplacement !== "plein-ecran" && !f.derriereVisage && y0 < r.y1 - EPS && y1 > r.y0 + EPS && r.x0 < 0.9 && r.x1 > 0.1) {
    erreurs.push(`V5c — « ${f.id} » : les sous-titres (de ${v(+y0.toFixed(3))} à ${v(+y1.toFixed(3))} H) passent SOUS l'élément qui les cache (de ${v(r.y0)} à ${v(r.y1)} H) ; placez-les au-dessus ou au-dessous.`);
  }
  return erreurs;
}

/* ---------------- Le contrôle ---------------- */

export interface ContexteControleV3 {
  /** Durée de la vidéo (s) et début de l'écran de fin : l'horizon des règles est le plus petit des deux. */
  duree: number;
  finDebut: number;
  /** Le plan porte des zooms ou des mouvements de cadrage (interdits par Will). */
  prisBougee?: boolean;
  /** Nombre d'objets de l'ancien catalogue (cartes, fenêtres, calques, motions) : un plan v3 n'en a aucun. */
  anciens?: number;
  /** Hauteur des yeux de la prise (fraction de H) ; absente : 0,34. */
  yeux?: number;
  /** Les 5 dernières vidéos, la plus récente en premier (D13). */
  historique?: readonly HistoriqueVideo[];
}

export interface MesuresV3 {
  elements: number;
  emplacements: Record<string, number>;
  familles: Record<string, number>;
  coupsDePoing: number;
  premierElementSec: number | null;
  premierCouvrantSec: number | null;
  premierCoupDePoingSec: number | null;
  imagesVisagePartielMax: number;
}

const compte = (valeurs: readonly string[]) => valeurs.reduce<Record<string, number>>((r, x) => ((r[x] = (r[x] ?? 0) + 1), r), {});

/** Deux textes partagent-ils un mot (4 premières lettres, accents et élisions ôtés) ? */
function partageUnMot(a: string, b: string): boolean {
  const mots = (t: string) => t.split(/[\s'’·/-]+/).map((x) => simplifier(sansElision(nettoyer(x)))).filter((x) => x.length >= 3 && !/\d/.test(x));
  const rb = mots(b).map((x) => x.slice(0, 4));
  return mots(a).some((x) => rb.includes(x.slice(0, 4)));
}

/**
 * Contrôle d'une SUITE d'éléments v3 (fonction pure, testable sans plan). Les messages commencent par leur code.
 * `mots` : la transcription (littéralité) ; absente, la littéralité n'est pas contrôlée.
 */
export function controlerSuiteV3(elements: readonly ElementResoluV3[], ctx: ContexteControleV3, mots?: readonly MotTranscrit[]): { erreurs: string[]; avertissements: string[]; mesures: MesuresV3 } {
  const S = SEUILS_V3;
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const els = [...elements].sort((a, b) => a.debut - b.debut || a.fin - b.fin);
  const N = els.length;
  const horizon = Math.min(ctx.finDebut, ctx.duree);
  const fiches = els.map((e) => e.fiche);
  const couvrants = els.filter((e) => e.fiche.couvreVisage);
  const coups = els.filter((e) => estCoupDePoingV3(e.fiche));

  const mesures: MesuresV3 = {
    elements: N,
    emplacements: compte(fiches.map((f) => f.emplacement)),
    familles: compte(fiches.map((f) => f.famille)),
    coupsDePoing: coups.length,
    premierElementSec: N ? els[0].debut : null,
    premierCouvrantSec: couvrants[0]?.debut ?? null,
    premierCoupDePoingSec: coups[0]?.debut ?? null,
    imagesVisagePartielMax: Math.max(0, ...fiches.map((f) => f.imagesVisagePartiel)),
  };
  if ((ctx.anciens ?? 0) > 0) erreurs.push(`D0b — ${ctx.anciens} objet${(ctx.anciens ?? 0) > 1 ? "s" : ""} de l'ancien catalogue (cartes, fenêtres, calques, motions) dans un plan v3 ; les éléments v3 les remplacent : laissez « cartes », « fenetres », « calques » et « motions » vides.`);
  if (!N) return { erreurs, avertissements, mesures };

  /* V1 — visage ENTIER ou ENTIÈREMENT couvert ; 3 images de visage partiel au plus au passage d'un grand élément. */
  for (const e of els) {
    const f = e.fiche;
    const etat = etatVisagePose(f);
    const attendu = f.couvreVisage ? "couvert" : "entier";
    if (etat === "partiel") erreurs.push(`V1a — ${nomElement(e)} : une fois posé, il cache la MOITIÉ du visage (emprise de ${v(f.rect.x0)} à ${v(f.rect.x1)} L et de ${v(f.rect.y0)} à ${v(f.rect.y1)} H) ; le visage est entier ou entièrement couvert, jamais à moitié.`);
    else if (etat !== attendu) erreurs.push(`V1a — ${nomElement(e)} : la fiche dit « visage ${attendu} » mais l'emprise le laisse « ${etat} ».`);
    if (f.imagesVisagePartiel > S.imagesVisagePartielMax) erreurs.push(`V1b — ${nomElement(e)} : le visage est à moitié caché pendant ${f.imagesVisagePartiel} images au passage ; ${S.imagesVisagePartielMax} images au plus (0,1 s, tolérance de Will pour une grande fenêtre qui glisse).`);
    if (!f.couvreVisage && f.imagesVisagePartiel > 0) erreurs.push(`V1c — ${nomElement(e)} : un élément qui laisse le visage entier ne le touche jamais (${f.imagesVisagePartiel} image${f.imagesVisagePartiel > 1 ? "s" : ""} de visage partiel).`);
  }

  /* V2 — aucun zoom, aucun mouvement de cadrage sur la prise. */
  if (ctx.prisBougee) erreurs.push("V2 — la prise porte un zoom ou un mouvement de cadrage ; la prise de Will ne bouge JAMAIS (décision de Will du 15/10), seule la descente sous la carte du haut est permise.");

  /* V3 — visage visible au début : rien qui le couvre avant 3 s, aucun coup de poing avant 8 s. */
  for (const e of couvrants) {
    if (e.debut < S.couvertureAvantSec - EPS) erreurs.push(`V3a — ${nomElement(e)} couvre le visage avant ${v(S.couvertureAvantSec)} s ; le visage de Will reste visible jusqu'à ${v(S.couvertureAvantSec)} s.`);
  }
  for (const e of coups) {
    if (e.debut < S.coupAvantSec - EPS) erreurs.push(`V3b — ${nomElement(e)} est un coup de poing avant ${v(S.coupAvantSec)} s ; aucun coup de poing avant ${v(S.coupAvantSec)} s.`);
  }

  /* V4 — aucune musique : que les bruitages de `sons/`. */
  for (const f of new Set(fiches)) {
    for (const b of f.bruitages) {
      if (MUSIQUE.test(b.son)) erreurs.push(`V4a — « ${f.id} » : le son « ${b.son} » est une musique ; AUCUNE musique (décision de Will), seulement des bruitages.`);
      else if (!(SONS_V3 as readonly string[]).includes(b.son)) erreurs.push(`V4b — « ${f.id} » : le son « ${b.son} » n'est pas un fichier de bruitage de sons/.`);
    }
  }

  /* V5 — sous-titres jamais sur les yeux. */
  for (const f of new Set(fiches)) erreurs.push(...erreursSousTitresV3(f, ctx.yeux));

  /* V6 — jamais deux fois de suite le même emplacement ni la même famille (ni le même élément). */
  for (let k = 1; k < N; k++) {
    const a = els[k - 1];
    const b = els[k];
    const aucun = `${nomElement(a)} puis ${nomElement(b)}`;
    if (a.fiche.emplacement === b.fiche.emplacement) erreurs.push(`V6a — ${aucun} : même emplacement « ${b.fiche.emplacement} » deux fois de suite ; les emplacements tournent.`);
    if (a.fiche.famille === b.fiche.famille) erreurs.push(`V6b — ${aucun} : même famille « ${b.fiche.famille} » (lot ${b.fiche.lot}) deux fois de suite ; les familles alternent.`);
    if (a.fiche.id === b.fiche.id) erreurs.push(`V6c — ${aucun} : le même élément deux fois de suite.`);
    if (a.fiche.mouvement === b.fiche.mouvement) avertissements.push(`V6d — ${aucun} : même mouvement d'entrée « ${b.fiche.mouvement} » deux fois de suite ; variez-le si possible.`);
  }

  /* V7 — au plus 1 coup de poing par 20 à 25 s ; Will seul 1 s après ; le dernier 8 s avant l'écran de fin. */
  for (let k = 1; k < coups.length; k++) {
    const ecart = coups[k].debut - coups[k - 1].debut;
    if (ecart < S.ecartCoupsSec - EPS) erreurs.push(`V7a — ${sec(ecart)} entre le coup de poing à ${sec(coups[k - 1].debut)} et celui à ${sec(coups[k].debut)} ; ${v(S.ecartCoupsSec)} s au moins (un coup de poing au plus toutes les ${v(S.ecartCoupsSec)} à ${v(S.periodeCoupSec)} s).`);
  }
  for (const c of coups) {
    const suivant = els.find((x) => x.debut > c.debut + EPS && x !== c);
    if (suivant && suivant.debut - c.fin < S.willSeulApresCoupSec - EPS) erreurs.push(`V7b — ${nomElement(suivant)} entre ${sec(Math.max(0, suivant.debut - c.fin))} après la fin du coup de poing ${nomElement(c)} ; ${sec(S.willSeulApresCoupSec)} de Will seul au moins.`);
  }
  if (coups.length) {
    const dernier = coups[coups.length - 1];
    if (dernier.debut > ctx.finDebut - S.coupAvantFinSec + EPS) erreurs.push(`V7c — le dernier coup de poing (${nomElement(dernier)}) tombe à ${sec(dernier.debut)}, moins de ${S.coupAvantFinSec} s avant l'écran de fin (${sec(ctx.finDebut)}).`);
  }

  /* D2 — fenêtre de 5 apparitions : 4 emplacements et 3 familles différents. */
  if (N >= S.fenetreApparitions) {
    for (let k = 0; k + S.fenetreApparitions <= N; k++) {
      const w = els.slice(k, k + S.fenetreApparitions);
      const de = `de ${sec(w[0].debut)} à ${sec(w[w.length - 1].debut)}`;
      const emp = new Set(w.map((e) => e.fiche.emplacement)).size;
      const fam = new Set(w.map((e) => e.fiche.famille)).size;
      if (emp < S.emplacementsDansFenetre) erreurs.push(`D2a — seulement ${emp} emplacements différents sur les ${S.fenetreApparitions} éléments ${de} ; ${S.emplacementsDansFenetre} au moins.`);
      if (fam < S.famillesDansFenetre) erreurs.push(`D2b — seulement ${fam} familles différentes sur les ${S.fenetreApparitions} éléments ${de} ; ${S.famillesDansFenetre} au moins.`);
    }
  }

  /* D6 — contraste de taille : jamais 3 éléments de suite dans la même classe de taille. */
  for (let k = 2; k < N; k++) {
    const c = classeTailleV3(els[k].fiche);
    if (c === classeTailleV3(els[k - 1].fiche) && c === classeTailleV3(els[k - 2].fiche)) avertissements.push(`D6a — ${nomElement(els[k - 2])}, ${nomElement(els[k - 1])} et ${nomElement(els[k])} sont tous trois de classe « ${c} » ; variez les tailles.`);
  }

  /* D11 — cadence (sur les éléments v3, qui remplacent les anciens objets). */
  if (horizon > 0) {
    const moyen = horizon / N;
    if (moyen > S.intervalleMoyenMaxSec + EPS) erreurs.push(`D11a — un élément v3 toutes les ${v(Math.round(moyen * 100) / 100)} s en moyenne (${N} éléments pour ${sec(horizon)}) ; un toutes les ${v(S.intervalleMoyenMaxSec)} s au plus.`);
    const points = [0, ...els.map((e) => e.debut), horizon];
    for (let k = 1; k < points.length; k++) {
      if (points[k] - points[k - 1] > S.sansEvenementMaxSec + EPS) erreurs.push(`D11b — ${sec(points[k] - points[k - 1])} sans nouvel élément entre ${sec(points[k - 1])} et ${sec(points[k])} ; ${S.sansEvenementMaxSec} s au plus.`);
    }
    for (let k = 1; k < N; k++) {
      if (els[k].debut - els[k - 1].debut < S.debutsEcartMinSec - EPS) erreurs.push(`D11c — ${nomElement(els[k - 1])} et ${nomElement(els[k])} commencent à ${sec(els[k].debut - els[k - 1].debut)} d'écart ; ${S.debutsEcartMinSec} s au moins.`);
    }
  }

  /* D12 — bruitages : jamais le même fichier deux fois de suite ; une famille de son ≤ 30 % des sons. */
  for (let k = 1; k < N; k++) {
    const a = els[k - 1].fiche.bruitages;
    const b = els[k].fiche.bruitages;
    if (a.length && b.length && a[a.length - 1].son === b[0].son) erreurs.push(`D12a — ${nomElement(els[k - 1])} puis ${nomElement(els[k])} : le bruitage « ${b[0].son} » deux fois de suite.`);
  }
  {
    const paires = new Map<string, number>();
    let total = 0;
    for (const e of els) for (const f of new Set(e.fiche.bruitages.map((b) => familleDeSon(b.son)))) {
      paires.set(f, (paires.get(f) ?? 0) + 1);
      total++;
    }
    if (total >= S.sonsMinPourPart) {
      for (const [f, n] of paires) if (n > S.partSonMax * total + EPS) erreurs.push(`D12b — le bruitage « ${f} » fait ${pct(n / total)} des sons des éléments v3 (${n} sur ${total}) ; ${pct(S.partSonMax)} au plus.`);
    }
  }

  /* D14 — quotas par élément. */
  for (const [id, n] of Object.entries(compte(fiches.map((f) => f.id)))) {
    const max = ficheV3(id)?.maxParVideo ?? 3;
    if (n > max) erreurs.push(`D14 — « ${id} » apparaît ${n} fois ; ${max} au plus par vidéo.`);
  }

  /* D15 — littéralité : mots et chiffres affichés = mots et chiffres DITS, jamais « Villeexemple » ; vidéos littérales. */
  for (const e of els) {
    const f = e.fiche;
    const [tMin, tMax] = f.textes;
    if (e.mots.length < tMin || e.mots.length > tMax) erreurs.push(`D15a — ${nomElement(e)} : ${e.mots.length} texte${e.mots.length > 1 ? "s" : ""} dans « mots » ; l'élément en prend de ${tMin} à ${tMax} (${f.contenu}).`);
    const [lMin, lMax] = f.lignes;
    if (e.lignes.length < lMin || e.lignes.length > lMax) erreurs.push(`D15a — ${nomElement(e)} : ${e.lignes.length} ligne${e.lignes.length > 1 ? "s" : ""} dans « lignes » ; l'élément en prend de ${lMin} à ${lMax} (${f.contenu}).`);
    const [vMin, vMax] = f.videos;
    if (e.recherches.length < vMin || e.recherches.length > vMax) erreurs.push(`D15f — ${nomElement(e)} : ${e.recherches.length} recherche${e.recherches.length > 1 ? "s" : ""} de vidéo dans « recherches » ; il faut une recherche par vidéo, de ${vMin} à ${vMax}.`);
    if (!e.illustre?.trim()) erreurs.push(`D15g — ${nomElement(e)} : « illustre » manquant ; recopiez les mots EXACTS de la transcription que cet élément représente.`);
    else for (const r of e.recherches) {
      if (!partageUnMot(r, e.illustre)) erreurs.push(`D15h — ${nomElement(e)} : la recherche de vidéo « ${r} » ne reprend aucun mot de ce que l'élément illustre (« ${e.illustre} ») ; montrez LITTÉRALEMENT ce que Will dit (la chose, le lieu ou l'action nommés), jamais une image d'idée.`);
    }
    if (f.exigeNombreDit && e.nombre === undefined) erreurs.push(`D15c — ${nomElement(e)} : il affiche un NOMBRE dit par Will (« ${f.contenu} ») ; « nombre » est absent.`);
    const textes = [...e.mots, ...e.lignes.map((l) => l.texte)];
    for (const texte of textes) for (const interdit of motsInterditsDans(texte)) erreurs.push(`D15b — ${nomElement(e)} : texte interdit « ${interdit} » dans « ${texte} ».`);
    if (!mots) continue;
    const proches = mots.filter((m) => m.a >= e.debut - 2 - EPS && m.a <= e.fin + 1 + EPS);
    const dits = new Set(proches.map((m) => simplifier(sansElision(nettoyer(m.w)))));
    const nombres = nombresDits(proches);
    if (e.nombre !== undefined && ![...nombres].some((d) => Math.abs(d - e.nombre!) < 1e-9)) erreurs.push(`D15d — ${nomElement(e)} : le nombre ${v(e.nombre)} n'est pas dit par Will entre ${sec(Math.max(0, e.debut - 2))} et ${sec(e.fin + 1)}.`);
    for (const texte of textes) {
      for (const n of nombresDansTexte(texte)) if (![...nombres].some((d) => Math.abs(d - n) < 1e-9)) erreurs.push(`D15d — ${nomElement(e)} : le chiffre ${v(n)} (« ${texte} ») n'est pas dit par Will entre ${sec(Math.max(0, e.debut - 2))} et ${sec(e.fin + 1)}.`);
      for (const w of texte.split(/[\s'’·/-]+/).map((x) => simplifier(sansElision(nettoyer(x)))).filter((x) => x.length >= 2 && !/\d/.test(x))) {
        if (!dits.has(w) && ![...dits].some((d) => d.includes("-") && d.split("-").includes(w))) {
          erreurs.push(`D15e — ${nomElement(e)} : le mot « ${w} » (« ${texte} ») n'est pas dit par Will entre ${sec(Math.max(0, e.debut - 2))} et ${sec(e.fin + 1)} ; l'élément n'affiche que des mots DITS.`);
          break;
        }
      }
    }
  }

  /* D13 — d'une vidéo à l'autre : le premier élément et le premier coup de poing diffèrent de ceux des vidéos précédentes. */
  const hist = (ctx.historique ?? []).slice(0, 3);
  for (const [k, h] of hist.entries()) {
    const nomH = h.titre ? `« ${h.titre} »` : `n° ${k + 1} de l'historique`;
    if (h.premierV3) {
      if (h.premierV3.emplacement === els[0].fiche.emplacement) erreurs.push(`D13a — le premier élément est en « ${els[0].fiche.emplacement} » comme celui de la vidéo ${nomH} ; l'emplacement du premier élément diffère de celui des 3 vidéos précédentes.`);
      if (h.premierV3.famille === els[0].fiche.famille) erreurs.push(`D13b — le premier élément est de la famille « ${els[0].fiche.famille} » comme celui de la vidéo ${nomH} ; la famille du premier élément diffère de celle des 3 vidéos précédentes.`);
    }
  }
  const precedente = ctx.historique?.[0];
  if (precedente?.premierCoupV3 && coups.length && coups[0].fiche.id === precedente.premierCoupV3) erreurs.push(`D13c — le premier coup de poing est « ${coups[0].fiche.id} », comme dans la vidéo précédente ; son type diffère.`);

  return { erreurs, avertissements, mesures };
}

/* ---------------- Le contrôle d'un plan ---------------- */

/** Ce qu'un plan laisse dans l'historique pour D13 (vide si le plan n'a pas d'éléments v3). */
export function historiqueV3(elements: readonly ElementV3Plan[] | undefined): Pick<HistoriqueVideo, "premierV3" | "premierCoupV3"> {
  const { elements: els } = resoudreElementsV3(elements, Number.POSITIVE_INFINITY);
  if (!els.length) return {};
  const coup = els.find((e) => estCoupDePoingV3(e.fiche));
  return {
    premierV3: { emplacement: els[0].fiche.emplacement, famille: els[0].fiche.famille },
    ...(coup ? { premierCoupV3: coup.fiche.id } : {}),
  };
}

/** D0 à D15 et V1 à V7 sur le plan (rien si le plan n'a pas d'`elementsV3`). Les messages commencent par leur code. */
export function controlerDiversiteV3(plan: PlanFacecamAnimee, options: { historique?: readonly HistoriqueVideo[]; mots?: readonly MotTranscrit[] } = {}): { erreurs: string[]; avertissements: string[]; mesures: MesuresV3 | null } {
  if (!plan.elementsV3?.length) return { erreurs: [], avertissements: [], mesures: null };
  const resolu = resoudreElementsV3(plan.elementsV3, plan.duree);
  const r = controlerSuiteV3(
    resolu.elements,
    {
      duree: plan.duree,
      finDebut: plan.fin.debut,
      prisBougee: plan.zooms.length > 0 || (plan.mouvements?.length ?? 0) > 0,
      anciens: plan.cartes.length + plan.fenetres.length + plan.calques.length + (plan.motions?.length ?? 0),
      yeux: plan.prise.yeux,
      historique: options.historique,
    },
    options.mots,
  );
  return { erreurs: [...resolu.erreurs, ...r.erreurs], avertissements: r.avertissements, mesures: r.mesures };
}
