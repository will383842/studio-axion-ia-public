/**
 * RÈGLES DE DIVERSITÉ, DE RYTHME ET DÉCISIONS FIXES « v4 » (17/10/2026) — PURES, vérifiables par code.
 *
 * Adaptation de `regles-v3.ts` au catalogue v4 (`catalogue-v4.ts`, 26 plaquettes) et au standard `STANDARD-DA-V4-2026-10-16.md` (§ 0.4, § G).
 * Les règles lisent `plan.elementsV4` et rendent des messages en français commençant par leur code (« V6a — … »). Un plan SANS
 * `elementsV4` n'est pas concerné ; un plan v4 REMPLACE cartes, fenêtres, calques, motions et éléments v2/v3 (D0b).
 *
 * (Codes : H = rythme du standard § G, R1 à R10 du standard ; les anciens R1 à R7 de `regles.ts` gardent leur sens.)
 * ┌─ DÉCISIONS FIXES DE WILL — chacune a son code, tous BLOQUANTS (le plan n'est pas rendu) ───────────────────────────────────────┐
 * │ V1  visage ENTIER ou ENTIÈREMENT couvert ; tolérance : 3 images au plus de visage à moitié caché au passage d'une grande       │
 * │     fenêtre (3 acceptées, 4 refusées).                                                                                           │
 * │ V2  AUCUN zoom ni recadrage de la prise (seule la descente / remontée verticale est permise) ; fond de la prise jamais modifié. │
 * │ V3  rien SUR le visage avant 5 s (fenêtres) ; aucun plein cadre avant 8 s ; étiquettes et objets AU-DESSUS de la tête dès 0-0,75 s.│
 * │ V4  aucune musique (bruitages oui) : seuls les fichiers de `sons/` sont permis.                                                 │
 * │ V5  sous-titres JAMAIS sur les yeux (position calculée depuis la descente réelle de la prise).                                  │
 * │ V6  jamais deux fois de suite la même plaquette ni le même emplacement.                                                         │
 * │ V7  coups de poing (plein cadre) : 2 à 4 par 60 s, ≥ 8 s entre deux, le dernier ≥ 6 s avant la fin.                              │
 * │ V8  liste de mots interdits à l'écran (Certifexemple, certifié / certification, Villeexemple, gain garanti) : refus dans une plaquette,    │
 * │     masqués dans les sous-titres (le groupe saute le mot) ; V8b : un groupe de sous-titres du plan qui en porte un est refusé.   │
 * │ H1  densité ≥ 2,2 événements par seconde sur toute fenêtre glissante de 5 s, comptés comme le rendu (gestes de vie visibles inclus, salves de   │
 * │     4 images fondues) ; H1b aucun calme > 0,75 s ; H2 prise seule ≤ 0,5 s d'affilée (≤ 3 % du temps).                              │
 * │ D0  seules les 26 plaquettes `actif` du catalogue peuvent être choisies.                                                        │
 * │ D15 littéralité : mots et chiffres affichés = mots et chiffres DITS ; jamais « Villeexemple » ni « aucun gain garanti ».            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 * Les autres règles (H9, H10, D14 quotas, D15 littéralité) sont des erreurs ordinaires : le réalisateur recommence.
 *
 * Périmètre, dit franchement : l'état du visage est contrôlé sur l'EMPRISE POSÉE de la fiche et sur le nombre d'images de visage partiel
 * DÉCLARÉ (`imagesVisagePartiel`, tiré de la critique du 16/10) ; les événements sont ceux DÉCLARÉS par les composants (déroulés + geste de vie
 * toutes les 12 images). Ce n'est pas une mesure sur le rendu : la répétition générale re-mesure sur la vidéo.
 */
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import {
  BANDE_YEUX_V4, CATALOGUE_V4, DEMI_HAUTEUR_SOUS_TITRES_V4, DESCENTE_V4, dureesSansCalmeV4, etatVisagePoseV4, evenementsDeLElementV4, ficheV4, plafondParVideoV4, sousTitresSurLesYeuxV4, ySousTitresV4, Y_SOUS_TITRES_MAX_V4, Y_SOUS_TITRES_MIN_V4,
  type FicheCatalogueV4,
} from "./catalogue-v4";
import { estMotOutil, motsInterditsDans, nettoyer, nombresDansTexte, nombresDits, sansElision, simplifier, type MotTranscrit } from "./mots";
import { EPS } from "./regles-v2";

/** Les fichiers de `studio-rendu/compositions/interface-claire/sons/` (Kenney CC0) + 3 bruitages maison (synthèse ffmpeg, lot 5). Aucune musique. */
export const SONS_V4 = Object.freeze([
  "click_001", "click_002", "click_003", "confirmation_002", "ding-1", "ding-2", "ding-3", "ding-4", "ding-5", "drop_001", "drop_002", "drop_003", "drop_004",
  "eclats", "feutre", "maximize_004", "maximize_006", "maximize_008", "minimize_004", "minimize_006", "select_001", "select_002", "tick_001", "tick_002",
  "tick_004", "vibreur", "whoosh-in", "whoosh-out", "boum", "whoosh-grave", "montee",
] as const);
const MUSIQUE = /musi|music|song|chanson|melod|mélod|instrumental|beat|boucle-audio/i;

export const SEUILS_V4 = Object.freeze({
  /** V1 : images de visage partiel tolérées au passage d'une grande fenêtre (Will : 3 images = 0,1 s). */
  imagesVisagePartielMax: 3,
  /** V3 : aucune plaquette qui couvre le visage avant 5 s ; aucun plein cadre avant 8 s ; la 1ʳᵉ plaquette entre avant 0,75 s (= le calme maximal H1b, décision de Will du 18/10 : V3c et H1b ne se contredisent plus). */
  couvertureAvantSec: 5,
  pleinCadreAvantSec: 8,
  premierElementAvantSec: 0.75,
  /** V7 : coups de poing (plein cadre) par 60 s, écart minimal, distance à la fin. */
  coupsMin60: 2,
  coupsMax60: 4,
  ecartCoupsSec: 8,
  coupAvantFinSec: 6,
  /** H1 : densité d'événements sur une fenêtre glissante de 5 s. */
  densiteMin: 2.2,
  fenetreDensiteSec: 5,
  /** H1b : aucun calme (rien qui change à l'écran) plus long que ça (s), mesuré sur le rendu à 0,75 s. */
  calmeMaxSec: 0.75,
  /** H2 : prise seule. */
  priseSeuleMaxSec: 0.5,
  priseSeulePartMax: 0.03,
  /** R9 : durée maximale dans un même gabarit ; intervalle moyen entre changements de gabarit. */
  memeGabaritMaxSec: 5.5,
  changementMoyenMaxSec: 3.5,
  /** H10 : plaquettes différentes par tranche de 30 s. */
  diversiteSec: 30,
  diversiteMin: 8,
  /** D2 : fenêtre de 5 apparitions → 3 emplacements différents au moins. */
  fenetreApparitions: 5,
  emplacementsDansFenetre: 3,
  statistiqueMin: 10,
  /** Jeu toléré sur les durées de la fiche et sur les raccords (s). */
  tolerance: 0.05,
});

/** Codes dont l'échec interdit le rendu : les décisions fixes de Will, le rythme et le catalogue. */
export const CODES_BLOQUANT_RENDU_V4 = Object.freeze(["D0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "H1", "H1b", "H2"]);
export const estRendableV4 = (erreurs: readonly string[]) => !erreurs.some((e) => /^(?:D0|V[1-8]|H[12])[a-z]? — /.test(e));

const sec = (x: number) => `${x.toFixed(2).replace(".", ",")} s`;
/** 3 décimales : un écart de quelques millisecondes n'est plus caché par l'arrondi du message. */
const s3 = (x: number) => `${x.toFixed(3).replace(".", ",")} s`;
const v = (x: number) => String(x).replace(".", ",");

/** Un élément du plan résolu contre le catalogue. */
export interface ElementResoluV4 {
  fiche: Readonly<FicheCatalogueV4>;
  debut: number;
  fin: number;
  mots: readonly string[];
  lignes: readonly { texte: string; a: number }[];
  instants: readonly number[];
  nombre?: number;
  recherches: readonly string[];
  illustre?: string;
  /** Position dans le plan (« élément 3 »). */
  rang: number;
}

const nomElement = (e: ElementResoluV4) => `élément v4 ${e.rang} « ${e.fiche.id} » à ${sec(e.debut)}`;

/* ---------------- D0 : résolution contre le catalogue ---------------- */

export function resoudreElementsV4(elements: readonly ElementV4Plan[] | undefined, duree: number): { elements: ElementResoluV4[]; erreurs: string[] } {
  const erreurs: string[] = [];
  const resolus: ElementResoluV4[] = [];
  [...(elements ?? [])].sort((a, b) => a.debut - b.debut || a.fin - b.fin).forEach((e, k) => {
    const fiche = ficheV4(e.id);
    const rang = k + 1;
    if (!fiche) {
      erreurs.push(`D0 — élément v4 ${rang} : « ${e.id} » n'existe pas dans le catalogue v4 (26 plaquettes actives).`);
      return;
    }
    if (!fiche.actif) {
      erreurs.push(`D0 — élément v4 ${rang} « ${e.id} » : cette plaquette est EN COULISSE (${fiche.raison}) ; choisissez-en une des 26 actives.`);
      return;
    }
    if (e.fin <= e.debut + EPS) erreurs.push(`D0 — élément v4 ${rang} « ${e.id} » : il finit (${sec(e.fin)}) avant d'avoir commencé (${sec(e.debut)}).`);
    else {
      const d = e.fin - e.debut;
      const [min, max] = fiche.dureeSec;
      if (d < min - SEUILS_V4.tolerance || d > max + SEUILS_V4.tolerance) erreurs.push(`D0 — élément v4 ${rang} « ${e.id} » : ${sec(d)} à l'écran, la fiche prévoit de ${sec(min)} à ${sec(max)}.`);
    }
    if (e.fin > duree + EPS) erreurs.push(`D0 — élément v4 ${rang} « ${e.id} » : il finit à ${s3(e.fin)}, après la fin de la vidéo (${s3(duree)}).`);
    resolus.push({ fiche, debut: e.debut, fin: e.fin, mots: e.mots ?? [], lignes: e.lignes ?? [], instants: e.instants ?? [], nombre: e.nombre, recherches: e.recherches ?? [], illustre: e.illustre, rang });
  });
  for (let k = 1; k < resolus.length; k++) {
    if (resolus[k].debut < resolus[k - 1].fin - SEUILS_V4.tolerance) erreurs.push(`D0 — ${nomElement(resolus[k - 1])} (jusqu'à ${sec(resolus[k - 1].fin)}) et ${nomElement(resolus[k])} sont à l'écran en même temps ; une seule plaquette à la fois (la suivante entre dans l'image où la précédente sort).`);
  }
  return { elements: resolus, erreurs };
}

/* ---------------- V5 : sous-titres jamais sur les yeux ---------------- */

/** Erreurs V5 d'une fiche : pour chaque descente RÉELLE possible de la prise (de 0 à la descente de la fiche, par 0,01 H), la boîte des sous-titres évite la bande des yeux. */
export function erreursSousTitresV4(f: Pick<FicheCatalogueV4, "id" | "sousTitres" | "descente">): string[] {
  const erreurs: string[] = [];
  const max = Math.max(f.descente, f.sousTitres === "carte" ? DESCENTE_V4.D2 : 0);
  // Position FIXE d'une fiche : elle doit déjà être dans la zone sûre (le bornage de `ySousTitresV4` ne doit pas masquer une fiche mal réglée).
  if (typeof f.sousTitres === "number" && (f.sousTitres < Y_SOUS_TITRES_MIN_V4 - EPS || f.sousTitres > Y_SOUS_TITRES_MAX_V4 + EPS)) {
    return [`V5b — « ${f.id} » : la position fixe des sous-titres (${v(+f.sousTitres.toFixed(3))} H) sort de la zone sûre TikTok / Reels / Shorts (de ${v(+Y_SOUS_TITRES_MIN_V4.toFixed(3))} à ${v(+Y_SOUS_TITRES_MAX_V4.toFixed(3))} H).`];
  }
  for (let d = 0; d <= max + 1e-9; d += 0.01) {
    // Position fixe : on contrôle la valeur ÉCRITE dans la fiche (le bornage de `ySousTitresV4` la déplacerait et masquerait la faute).
    const y = typeof f.sousTitres === "number" ? f.sousTitres : ySousTitresV4(f, d);
    if (y !== null && (y < Y_SOUS_TITRES_MIN_V4 - EPS || y > Y_SOUS_TITRES_MAX_V4 + EPS)) {
      erreurs.push(`V5b — « ${f.id} » : les sous-titres sortent de la zone sûre TikTok / Reels / Shorts (centre à ${v(+y.toFixed(3))} H, descente ${v(+d.toFixed(2))} : la boîte doit rester entre ${v(+(Y_SOUS_TITRES_MIN_V4 - DEMI_HAUTEUR_SOUS_TITRES_V4).toFixed(2))} et ${v(+(Y_SOUS_TITRES_MAX_V4 + DEMI_HAUTEUR_SOUS_TITRES_V4).toFixed(2))} H, sous les boutons des réseaux).`);
      break;
    }
    if (sousTitresSurLesYeuxV4(y, d)) {
      erreurs.push(`V5a — « ${f.id} » : à la descente ${v(+d.toFixed(2))} H, les sous-titres (centre ${v(+(y as number).toFixed(3))} H) tombent sur les yeux de Will (de ${v(+(BANDE_YEUX_V4[0] + d).toFixed(3))} à ${v(+(BANDE_YEUX_V4[1] + d).toFixed(3))} H).`);
      break;
    }
  }
  return erreurs;
}

/* ---------------- Le contrôle ---------------- */

export interface ContexteControleV4 {
  /** Durée de la vidéo (s) et début de l'écran de fin (= durée si la vidéo n'en a pas) : l'horizon des règles est le plus petit des deux. */
  duree: number;
  finDebut: number;
  /** Le plan porte des zooms ou des mouvements de cadrage (interdits par Will). */
  prisBougee?: boolean;
  /** Nombre d'objets d'un ancien catalogue (cartes, fenêtres, calques, motions, éléments v2/v3) : un plan v4 n'en a aucun. */
  anciens?: number;
}

export interface MesuresV4 {
  elements: number;
  /** Plaquettes utilisées et combien de fois. */
  plaquettes: Record<string, number>;
  emplacements: Record<string, number>;
  coupsDePoing: number;
  premierElementSec: number | null;
  premierCouvrantSec: number | null;
  premierPleinCadreSec: number | null;
  /** Densité d'événements déclarés : moyenne et minimum sur les fenêtres glissantes de 5 s. */
  densiteMoyenne: number;
  densiteMinFenetre5s: number;
  /** Plus longue prise seule d'affilée (s) et part du temps en prise seule. */
  priseSeuleMaxSec: number;
  priseSeulePart: number;
  imagesVisagePartielMax: number;
  /** Temps passé dans chaque gabarit (s). */
  tempsParGabarit: Record<string, number>;
}

const compte = (valeurs: readonly string[]) => valeurs.reduce<Record<string, number>>((r, x) => ((r[x] = (r[x] ?? 0) + 1), r), {});

/** Deux événements à moins de 4 images (0,13 s) forment UNE salve, comme dans `outils/facecam-animee-v4/mesurer-densite.mjs` (la mesure du rendu). */
export const SALVE_IMAGES_V4 = 4;
/**
 * Instants (s) des événements graphiques de tous les éléments, triés : événements de la fiche + gestes de vie visibles (ceux du rendu), puis
 * REGROUPÉS en salves (H1 se juge sur ce que la mesure du rendu comptera, pas sur la somme brute des déclarations des fiches).
 */
export function evenementsDuPlanV4(els: readonly ElementResoluV4[]): number[] {
  const t: number[] = [];
  for (const e of els) {
    const n = Math.round((e.fin - e.debut) * 30);
    for (const f of evenementsDeLElementV4(e.fiche, n)) t.push(+(e.debut + f / 30).toFixed(4));
  }
  t.sort((a, b) => a - b);
  const salves: number[] = [];
  for (const x of t) if (!salves.length || x - salves[salves.length - 1] >= SALVE_IMAGES_V4 / 30 - 1e-6) salves.push(x);
  return salves;
}
/** Plus long intervalle sans événement (s) entre deux salves consécutives de [0, horizon] et son début. */
export function plusLongCalmeV4(evenements: readonly number[], horizon: number): { duree: number; debut: number } {
  let duree = 0;
  let debut = 0;
  let prec = 0;
  for (const x of [...evenements, horizon]) {
    if (x - prec > duree) { duree = x - prec; debut = prec; }
    prec = x;
  }
  return { duree, debut };
}

const plage = ([a, b]: [number, number]) => (a === b ? sec(a) : `${sec(a)} à ${sec(b)}`);

/**
 * Conseil d'un calme H1b : Opus ne voit pas les événements du rendu, on lui nomme la plaquette fautive (celle en cours au début du calme)
 * et ce qu'il peut faire — raccourcir/allonger dans une durée sans calme, enchaîner la suivante, ou en ajouter une.
 */
export function conseilCalmeV4(calme: { duree: number; debut: number }, els: readonly ElementResoluV4[], horizon: number): string {
  const fin = calme.debut + calme.duree;
  const courant = [...els].reverse().find((e) => e.debut <= calme.debut + EPS && e.fin >= calme.debut - 1 / 30 - EPS);
  const suivant = els.find((e) => e.debut >= calme.debut + EPS && Math.abs(e.debut - fin) < 1 / 30 + EPS);
  if (courant && courant.fin >= fin - EPS) {
    const sans = dureesSansCalmeV4(courant.fiche);
    const d = courant.fin - courant.debut;
    // Durée déjà sans calme : le calme ne vient pas de la durée (arrondis, salves) ; on n'invente pas une fourchette contradictoire.
    if (sans.some(([a, b]) => d >= a - 1 / 60 && d <= b + 1 / 60)) return `« ${courant.fiche.id} » (${sec(courant.debut)} → ${sec(courant.fin)}) n'a plus de mouvement pendant ce temps ; remplacez-la par une plaquette plus vivante ou enchaînez la suivante plus tôt.`;
    const ok = sans.map(plage).join(" ; ");
    return `« ${courant.fiche.id} » (${sec(courant.debut)} → ${sec(courant.fin)}) n'a plus aucun mouvement pendant ce temps (les lignes et les instants n'y changent rien) ; donnez-lui une durée sans calme${ok ? ` (${ok})` : ""}, ou remplacez-la.`;
  }
  if (suivant && !courant) return `aucune plaquette avant ${sec(suivant.debut)} : faites entrer « ${suivant.fiche.id} » (ou une autre) dès 0 à ${v(SEUILS_V4.premierElementAvantSec)} s.`;
  if (suivant && courant) return `« ${courant.fiche.id} » finit à ${sec(courant.fin)} et « ${suivant.fiche.id} » n'entre qu'à ${sec(suivant.debut)} : faites entrer la suivante dans l'image où la précédente sort.`;
  return `plus aucune plaquette entre ${sec(calme.debut)} et la fin (${sec(horizon)}) : ajoutez-en une avant ${sec(calme.debut + 0.7)}.`;
}

/** Intervalles de prise seule (aucune plaquette) sur [0, horizon], gaps de moins de 1 image ignorés. */
export function priseSeuleV4(els: readonly ElementResoluV4[], horizon: number): [number, number][] {
  const trous: [number, number][] = [];
  let t = 0;
  for (const e of [...els].sort((a, b) => a.debut - b.debut)) {
    if (e.debut - t > 1 / 30 + EPS) trous.push([t, e.debut]);
    t = Math.max(t, e.fin);
  }
  if (horizon - t > 1 / 30 + EPS) trous.push([t, horizon]);
  return trous;
}

/** Densité d'événements : moyenne et minimum sur toutes les fenêtres glissantes de 5 s (pas de 0,1 s) de [0, horizon]. */
export function densiteV4(evenements: readonly number[], horizon: number, fenetre: number = SEUILS_V4.fenetreDensiteSec): { moyenne: number; min: number; pire: number } {
  if (horizon <= 0) return { moyenne: 0, min: 0, pire: 0 };
  const largeur = Math.min(fenetre, horizon);
  let min = Infinity;
  let pire = 0;
  for (let w = 0; w + largeur <= horizon + 1e-9; w += 0.1) {
    const n = evenements.filter((e) => e >= w - 1e-9 && e < w + largeur - 1e-9).length / largeur;
    if (n < min) { min = n; pire = w; }
  }
  return { moyenne: evenements.length / horizon, min: Number.isFinite(min) ? min : 0, pire };
}

/** Deux textes partagent-ils un mot (4 premières lettres, accents et élisions ôtés) ? */
function partageUnMot(a: string, b: string): boolean {
  const mots = (t: string) => t.split(/[\s'’·/-]+/).map((x) => simplifier(sansElision(nettoyer(x)))).filter((x) => x.length >= 3 && !/\d/.test(x));
  const rb = mots(b).map((x) => x.slice(0, 4));
  return mots(a).some((x) => rb.includes(x.slice(0, 4)));
}

/**
 * Contrôle d'une SUITE d'éléments v4 (fonction pure, testable sans plan). Les messages commencent par leur code.
 * `mots` : la transcription (littéralité, calage) ; absente, la littéralité n'est pas contrôlée.
 */
export function controlerSuiteV4(elements: readonly ElementResoluV4[], ctx: ContexteControleV4, mots?: readonly MotTranscrit[]): { erreurs: string[]; avertissements: string[]; mesures: MesuresV4 } {
  const S = SEUILS_V4;
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const els = [...elements].sort((a, b) => a.debut - b.debut || a.fin - b.fin);
  const N = els.length;
  const horizon = Math.min(ctx.finDebut, ctx.duree);
  const fiches = els.map((e) => e.fiche);
  const couvrants = els.filter((e) => e.fiche.couvreVisage);
  const pleins = els.filter((e) => e.fiche.coupDePoing);
  const evenements = evenementsDuPlanV4(els);
  const dens = densiteV4(evenements, horizon);
  const trous = priseSeuleV4(els, horizon);
  const tempsSeul = trous.reduce((s, [a, b]) => s + (b - a), 0);

  const mesures: MesuresV4 = {
    elements: N,
    plaquettes: compte(fiches.map((f) => f.id)),
    emplacements: compte(fiches.map((f) => f.slot)),
    coupsDePoing: pleins.length,
    premierElementSec: N ? els[0].debut : null,
    premierCouvrantSec: couvrants[0]?.debut ?? null,
    premierPleinCadreSec: pleins[0]?.debut ?? null,
    densiteMoyenne: +dens.moyenne.toFixed(2),
    densiteMinFenetre5s: +dens.min.toFixed(2),
    priseSeuleMaxSec: +Math.max(0, ...trous.map(([a, b]) => b - a)).toFixed(2),
    priseSeulePart: horizon > 0 ? +(tempsSeul / horizon).toFixed(4) : 0,
    imagesVisagePartielMax: Math.max(0, ...fiches.map((f) => f.imagesVisagePartiel)),
    tempsParGabarit: els.reduce<Record<string, number>>((r, e) => ((r[e.fiche.gabarit] = +((r[e.fiche.gabarit] ?? 0) + e.fin - e.debut).toFixed(2)), r), {}),
  };
  if ((ctx.anciens ?? 0) > 0) erreurs.push(`D0b — ${ctx.anciens} objet${(ctx.anciens ?? 0) > 1 ? "s" : ""} d'un ancien catalogue (cartes, fenêtres, calques, motions, éléments v2 ou v3) dans un plan v4 ; les plaquettes v4 les remplacent : laissez « cartes », « fenetres », « calques », « motions », « elementsV2 » et « elementsV3 » vides.`);
  if (!N) {
    erreurs.push("H2a — aucune plaquette dans le plan : la prise est seule du début à la fin.");
    return { erreurs, avertissements, mesures };
  }

  /* V1 — visage ENTIER ou ENTIÈREMENT couvert ; 3 images de visage partiel au plus au passage d'une grande fenêtre. */
  for (const e of els) {
    const f = e.fiche;
    const etat = etatVisagePoseV4(f);
    const attendu = f.couvreVisage ? "couvert" : "entier";
    if (etat === "partiel") erreurs.push(`V1a — ${nomElement(e)} : une fois posé, il cache la MOITIÉ du visage ; le visage est entier ou entièrement couvert, jamais à moitié.`);
    else if (etat !== attendu) erreurs.push(`V1a — ${nomElement(e)} : la fiche dit « visage ${attendu} » mais l'emprise le laisse « ${etat} ».`);
    if (f.imagesVisagePartiel > S.imagesVisagePartielMax) erreurs.push(`V1b — ${nomElement(e)} : le visage est à moitié caché pendant ${f.imagesVisagePartiel} images au passage ; ${S.imagesVisagePartielMax} images au plus (0,1 s, tolérance de Will quand une grande fenêtre passe).`);
    if (!f.couvreVisage && f.imagesVisagePartiel > 0) erreurs.push(`V1c — ${nomElement(e)} : une plaquette qui laisse le visage entier ne le touche jamais (${f.imagesVisagePartiel} image${f.imagesVisagePartiel > 1 ? "s" : ""} de visage partiel).`);
  }

  /* V2 — aucun zoom, aucun mouvement de cadrage sur la prise. */
  if (ctx.prisBougee) erreurs.push("V2 — la prise porte un zoom ou un mouvement de cadrage ; la prise de Will ne bouge JAMAIS (ni zoom, ni recadrage, fond intact), seule la descente verticale sous une plaquette est permise.");

  /* V3 — rien sur le visage avant 5 s ; aucun plein cadre avant 8 s ; une plaquette au-dessus de la tête dès 0-0,75 s. */
  for (const e of couvrants) {
    if (e.debut < S.couvertureAvantSec - EPS) erreurs.push(`V3a — ${nomElement(e)} couvre le visage avant ${v(S.couvertureAvantSec)} s ; rien sur le visage avant ${v(S.couvertureAvantSec)} s (seuls les objets au-dessus de la tête et les cartes hautes sont permis).`);
  }
  for (const e of pleins) {
    if (e.debut < S.pleinCadreAvantSec - EPS) erreurs.push(`V3b — ${nomElement(e)} est un plein cadre avant ${v(S.pleinCadreAvantSec)} s ; aucun plein cadre avant ${v(S.pleinCadreAvantSec)} s.`);
  }
  if (els[0].debut > S.premierElementAvantSec + EPS) erreurs.push(`V3c — la première plaquette entre à ${sec(els[0].debut)} ; une étiquette ou un objet au-dessus de la tête entre dès 0 à ${v(S.premierElementAvantSec)} s.`);

  /* V4 — aucune musique : que les bruitages de `sons/`. */
  for (const f of new Set(fiches)) {
    for (const son of f.sons) {
      if (MUSIQUE.test(son)) erreurs.push(`V4a — « ${f.id} » : le son « ${son} » est une musique ; AUCUNE musique (décision de Will), seulement des bruitages.`);
      else if (!(SONS_V4 as readonly string[]).includes(son)) erreurs.push(`V4b — « ${f.id} » : le son « ${son} » n'est pas un fichier de bruitage de sons/.`);
    }
  }

  /* V5 — sous-titres jamais sur les yeux. */
  for (const f of new Set(fiches)) erreurs.push(...erreursSousTitresV4(f));

  /* V6 — jamais deux fois de suite la même plaquette ni le même emplacement. */
  for (let k = 1; k < N; k++) {
    const a = els[k - 1];
    const b = els[k];
    const paire = `${nomElement(a)} puis ${nomElement(b)}`;
    if (a.fiche.id === b.fiche.id) erreurs.push(`V6a — ${paire} : la même plaquette deux fois de suite.`);
    if (a.fiche.slot === b.fiche.slot) erreurs.push(`V6b — ${paire} : même emplacement « ${b.fiche.slot} » deux fois de suite ; les emplacements tournent (tête, carte haute, fenêtre, plein cadre, bas).`);
  }

  /* V7 — coups de poing : 2 à 4 par 60 s, 8 s au moins entre deux, le dernier 6 s au moins avant la fin. */
  for (let k = 1; k < pleins.length; k++) {
    const ecart = pleins[k].debut - pleins[k - 1].debut;
    if (ecart < S.ecartCoupsSec - EPS) erreurs.push(`V7a — ${sec(ecart)} entre le plein cadre à ${sec(pleins[k - 1].debut)} et celui à ${sec(pleins[k].debut)} ; ${v(S.ecartCoupsSec)} s au moins.`);
  }
  for (let k = 0; k < pleins.length; k++) {
    const dans60 = pleins.filter((p) => p.debut >= pleins[k].debut - EPS && p.debut < pleins[k].debut + 60 - EPS).length;
    if (dans60 > S.coupsMax60) { erreurs.push(`V7b — ${dans60} pleins cadres en 60 s à partir de ${sec(pleins[k].debut)} ; ${S.coupsMax60} au plus.`); break; }
  }
  if (horizon >= 60 && pleins.length < Math.floor((S.coupsMin60 * horizon) / 60)) erreurs.push(`V7c — ${pleins.length} plein${pleins.length > 1 ? "s" : ""} cadre${pleins.length > 1 ? "s" : ""} pour ${sec(horizon)} ; ${S.coupsMin60} à ${S.coupsMax60} par 60 s.`);
  if (pleins.length) {
    const dernier = pleins[pleins.length - 1];
    if (dernier.fin > ctx.finDebut - S.coupAvantFinSec + EPS) erreurs.push(`V7d — le dernier plein cadre (${nomElement(dernier)}) finit à ${sec(dernier.fin)}, moins de ${S.coupAvantFinSec} s avant la fin (${sec(ctx.finDebut)}).`);
  }

  /* H1 — densité ≥ 2,2 événements par seconde sur toute fenêtre glissante de 5 s. */
  if (horizon >= S.fenetreDensiteSec && dens.min < S.densiteMin - EPS) erreurs.push(`H1a — densité de ${v(+dens.min.toFixed(2))} événements par seconde sur la fenêtre de 5 s qui commence à ${sec(dens.pire)} ; ${v(S.densiteMin)} au moins (cible 2,6) : rapprochez les plaquettes ou choisissez-en de plus vivantes.`);

  /* H1b — aucun calme de plus de 0,75 s (la mesure du rendu le vérifie image par image). */
  if (horizon >= S.fenetreDensiteSec) {
    const calme = plusLongCalmeV4(evenements, horizon);
    if (calme.duree > S.calmeMaxSec + EPS) erreurs.push(`H1b — rien ne change à l'écran pendant ${sec(calme.duree)} à partir de ${sec(calme.debut)} ; ${v(S.calmeMaxSec)} s au plus : ${conseilCalmeV4(calme, els, horizon)}`);
  }

  /* H2 — prise seule ≤ 0,5 s d'affilée, ≤ 3 % du temps. */
  for (const [a, b] of trous) {
    if (b - a > S.priseSeuleMaxSec + S.tolerance) erreurs.push(`H2a — Will est seul à l'écran pendant ${sec(b - a)} (de ${sec(a)} à ${sec(b)}) ; ${v(S.priseSeuleMaxSec)} s au plus d'affilée : une plaquette entre dans l'image où la précédente sort.`);
  }
  if (horizon > 0 && tempsSeul / horizon > S.priseSeulePartMax + EPS) erreurs.push(`H2b — Will est seul à l'écran ${v(+((tempsSeul / horizon) * 100).toFixed(1))} % du temps ; ${v(S.priseSeulePartMax * 100)} % au plus.`);

  /* H9 — changement de gabarit : jamais plus de 5,5 s dans le même, toutes les 3,5 s en moyenne au plus. */
  for (const e of els) {
    if (e.fin - e.debut > S.memeGabaritMaxSec + EPS) erreurs.push(`H9a — ${nomElement(e)} reste ${sec(e.fin - e.debut)} dans le même gabarit ; ${v(S.memeGabaritMaxSec)} s au plus.`);
  }
  if (N >= S.statistiqueMin) {
    let changements = 0;
    for (let k = 1; k < N; k++) if (els[k].fiche.gabarit !== els[k - 1].fiche.gabarit) changements++;
    const moyen = horizon / Math.max(1, changements + 1);
    if (moyen > S.changementMoyenMaxSec + EPS) erreurs.push(`H9b — un changement de gabarit toutes les ${v(+moyen.toFixed(2))} s en moyenne ; ${v(S.changementMoyenMaxSec)} s au plus.`);
  }

  /* H10 — diversité : 8 plaquettes différentes au moins par tranche de 30 s ; un même élément 3 fois au plus (D14). */
  if (horizon >= S.diversiteSec) {
    for (let w = 0; w + S.diversiteSec <= horizon + 1e-9; w += 5) {
      const dedans = els.filter((e) => e.debut >= w - EPS && e.debut < w + S.diversiteSec - EPS);
      const n = new Set(dedans.map((e) => e.fiche.id)).size;
      if (n < S.diversiteMin) { erreurs.push(`H10a — seulement ${n} plaquettes différentes entre ${sec(w)} et ${sec(w + S.diversiteSec)} ; ${S.diversiteMin} au moins par tranche de ${S.diversiteSec} s.`); break; }
    }
  }
  for (const [id, n] of Object.entries(mesures.plaquettes)) {
    const f = CATALOGUE_V4.find((x) => x.id === id);
    const max = f ? plafondParVideoV4(f, ctx.duree) : 0;
    if (f && n > max) erreurs.push(`D14 — « ${id} » apparaît ${n} fois ; ${max} au plus par vidéo de ${sec(ctx.duree)}.`);
  }

  /* D2 — fenêtre de 5 apparitions : 3 emplacements différents au moins. */
  if (N >= S.fenetreApparitions) {
    for (let k = 0; k + S.fenetreApparitions <= N; k++) {
      const w = els.slice(k, k + S.fenetreApparitions);
      const emp = new Set(w.map((e) => e.fiche.slot)).size;
      if (emp < S.emplacementsDansFenetre) erreurs.push(`D2a — seulement ${emp} emplacements différents sur les ${S.fenetreApparitions} plaquettes de ${sec(w[0].debut)} à ${sec(w[w.length - 1].debut)} ; ${S.emplacementsDansFenetre} au moins.`);
    }
  }

  /* D15 — littéralité : mots et chiffres affichés = mots et chiffres DITS, jamais « Villeexemple » ; vidéos littérales ; calage sur la voix. */
  for (const e of els) {
    const f = e.fiche;
    const compter = (nom: string, n: number, [min, max]: readonly [number, number], quoi: string) => {
      if (n < min || n > max) erreurs.push(`D15a — ${nomElement(e)} : ${n} ${nom} ; la plaquette en prend de ${min} à ${max} (${quoi}).`);
    };
    compter(`texte${e.mots.length > 1 ? "s" : ""} dans « mots »`, e.mots.length, f.textes, f.contenu);
    compter(`ligne${e.lignes.length > 1 ? "s" : ""} dans « lignes »`, e.lignes.length, f.lignes, f.contenu);
    compter(`instant${e.instants.length > 1 ? "s" : ""} dans « instants »`, e.instants.length, f.instants, f.contenu);
    const [vMin, vMax] = f.videos;
    if (e.recherches.length < vMin || e.recherches.length > vMax) erreurs.push(`D15f — ${nomElement(e)} : ${e.recherches.length} recherche${e.recherches.length > 1 ? "s" : ""} de vidéo dans « recherches » ; il faut une recherche par vidéo, de ${vMin} à ${vMax}.`);
    if (!e.illustre?.trim()) erreurs.push(`D15g — ${nomElement(e)} : « illustre » manquant ; recopiez les mots EXACTS de la transcription que cette plaquette représente.`);
    else for (const r of e.recherches) {
      if (!partageUnMot(r, e.illustre)) erreurs.push(`D15h — ${nomElement(e)} : la recherche de vidéo « ${r} » ne reprend aucun mot de ce que la plaquette illustre (« ${e.illustre} ») ; montrez LITTÉRALEMENT ce que Will dit (la chose, le lieu ou l'action nommés), jamais une image d'idée.`);
    }
    if (f.exigeNombreDit && e.nombre === undefined) erreurs.push(`D15c — ${nomElement(e)} : il affiche un NOMBRE dit par Will (« ${f.contenu} ») ; « nombre » est absent.`);
    for (const t of e.instants) if (t < e.debut - EPS || t > e.fin + EPS) erreurs.push(`D15i — ${nomElement(e)} : l'instant ${sec(t)} est hors de la plaquette (${sec(e.debut)} → ${sec(e.fin)}).`);
    for (const l of e.lignes) if (l.a < e.debut - EPS || l.a > e.fin + EPS) erreurs.push(`D15i — ${nomElement(e)} : la ligne « ${l.texte} » est datée ${sec(l.a)}, hors de la plaquette (${sec(e.debut)} → ${sec(e.fin)}).`);
    const textes = [...e.mots, ...e.lignes.map((l) => l.texte)];
    for (const texte of textes) for (const interdit of motsInterditsDans(texte)) erreurs.push(`V8a — ${nomElement(e)} : texte interdit à l'écran « ${interdit} » dans « ${texte} » (liste de mots interdits à l'écran, décision de Will du 17/10 : jamais affiché, même si Will le dit).`);
    if (!mots) continue;
    const proches = mots.filter((m) => m.a >= e.debut - 2 - EPS && m.a <= e.fin + 1 + EPS);
    const dits = new Set(proches.map((m) => simplifier(sansElision(nettoyer(m.w)))));
    const nombres = nombresDits(proches);
    if (e.nombre !== undefined && ![...nombres].some((d) => Math.abs(d - e.nombre!) < 1e-9) && !(f.id === "Chrono" && [...nombres].some((d) => d * 60 === e.nombre))) {
      erreurs.push(`D15d — ${nomElement(e)} : le nombre ${v(e.nombre)} n'est pas dit par Will entre ${sec(Math.max(0, e.debut - 2))} et ${sec(e.fin + 1)}.`);
    }
    for (const texte of textes) {
      for (const n of nombresDansTexte(texte)) if (![...nombres].some((d) => Math.abs(d - n) < 1e-9)) erreurs.push(`D15d — ${nomElement(e)} : le chiffre ${v(n)} (« ${texte} ») n'est pas dit par Will entre ${sec(Math.max(0, e.debut - 2))} et ${sec(e.fin + 1)}.`);
      for (const w of texte.split(/[\s'’·/-]+/).map((x) => simplifier(sansElision(nettoyer(x)))).filter((x) => x.length >= 2 && !/\d/.test(x))) {
        if (!dits.has(w) && ![...dits].some((d) => d.includes("-") && d.split("-").includes(w))) {
          /* Aide au réessai : les mots réellement dits ici (forme brute, accents gardés, sans mot interdit) et la forme dite qui ressemble au mot refusé (même début, cherchée parmi TOUS les mots dits). */
          const bruts = [...new Set(proches.map((m) => nettoyer(m.w)))].filter((d) => d.length >= 2 && !estMotOutil(simplifier(sansElision(d))) && motsInterditsDans(d).length === 0);
          const ici = bruts.slice(0, 15);
          const proche = w.length >= 4 ? bruts.find((d) => simplifier(sansElision(d)).slice(0, 4) === w.slice(0, 4)) : undefined;
          erreurs.push(`D15e — ${nomElement(e)} : le mot « ${w} » (« ${texte} ») n'est pas dit par Will entre ${sec(Math.max(0, e.debut - 2))} et ${sec(e.fin + 1)} ; la plaquette n'affiche que des mots DITS (dits ici : ${ici.join(", ")})${proche ? ` ; forme dite la plus proche : « ${proche} » (recopiez-la exactement)` : ""}.`);
          break;
        }
      }
    }
    /* Calage sur la VRAIE voix : chaque ligne datée tombe sur son mot, à 0,4 s près. */
    for (const l of e.lignes) {
      const premier = l.texte.split(/[\s'’·/-]+/).filter((x) => x && !estMotOutil(x)).map((x) => simplifier(sansElision(nettoyer(x))))[0] ?? "";
      if (!premier || /\d/.test(premier)) continue;
      const trouve = mots.some((m) => Math.abs(m.a - l.a) <= 0.8 && simplifier(sansElision(nettoyer(m.w))).startsWith(premier.slice(0, 4)));
      if (!trouve) avertissements.push(`D15j — ${nomElement(e)} : la ligne « ${l.texte} » est datée ${sec(l.a)} mais Will ne dit pas « ${premier} » à 0,8 s près de cet instant ; calez-la sur le mot.`);
    }
  }

  return { erreurs, avertissements, mesures };
}

/* ---------------- Le contrôle d'un plan ---------------- */

/** D0 à D15 et V1 à V7, H1, H2 sur le plan (rien si le plan n'a pas d'`elementsV4`). Les messages commencent par leur code. */
export function controlerDiversiteV4(plan: PlanFacecamAnimee, options: { mots?: readonly MotTranscrit[]; interdites?: readonly string[] } = {}): { erreurs: string[]; avertissements: string[]; mesures: MesuresV4 | null } {
  if (!plan.elementsV4?.length) return { erreurs: [], avertissements: [], mesures: null };
  const resolu = resoudreElementsV4(plan.elementsV4, plan.duree);
  const interditsSousTitres: string[] = [];
  plan.groupes.forEach((g, k) => {
    const texte = g.mots.map((m) => m.w).join(" ");
    for (const interdit of motsInterditsDans(texte)) interditsSousTitres.push(`V8b — sous-titre ${k + 1} « ${texte} » à ${sec(g.mots[0].a)} : mot interdit à l'écran « ${interdit} » ; le groupe doit sauter ce mot (même dit par Will).`);
  });
  const r = controlerSuiteV4(
    resolu.elements,
    {
      duree: plan.duree,
      finDebut: plan.fin.debut,
      prisBougee: plan.zooms.length > 0 || (plan.mouvements?.length ?? 0) > 0,
      anciens: plan.cartes.length + plan.fenetres.length + plan.calques.length + (plan.motions?.length ?? 0) + (plan.elementsV2?.length ?? 0) + (plan.elementsV3?.length ?? 0),
    },
    options.mots,
  );
  // D16 (repli « sans vidéo », 19/10) : plaquettes INTERDITES dans ce plan, parce qu'aucune vidéo fidèle à ce que Will dit n'a été trouvée.
  // Non bloquante au rendu (`estRendableV4` ne la compte pas) : elle fait seulement recommencer le réalisateur.
  const interdites = (options.interdites?.length ? resolu.elements.filter((e) => options.interdites!.includes(e.fiche.id)) : []).map(
    (e) => `D16 — élément v4 ${e.rang} « ${e.fiche.id} » à ${sec(e.debut)} : plaquette à vidéo INTERDITE dans ce plan (aucune vidéo fidèle à ce que Will dit n'a été trouvée) ; remplacez-la par une plaquette sans vidéo, sans « recherches ».`,
  );
  return { erreurs: [...resolu.erreurs, ...interditsSousTitres, ...interdites, ...r.erreurs], avertissements: r.avertissements, mesures: r.mesures };
}
