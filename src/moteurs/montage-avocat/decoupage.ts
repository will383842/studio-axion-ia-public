/**
 * DÉCOUPAGE EN PLANS SUR L'AUDIO MAÎTRE (moteur avocat, lot M1 ; plan B.2, v3.2). PUR.
 *
 * Entrée : les mots du texte VALIDÉ, horodatés sur l'audio nettoyé (report.ts), les segments du script, les plans
 * indicatifs de la commande (choix d'illustrations, verrous) et la recette de montage figée dans la commande.
 * Sortie : les plans définitifs, AVANT tout rendu payant (les deux angles et les illustrations partent ensemble).
 *
 * Règles (une règle = un test nommé, `decoupage.test.ts`) :
 *  R1  coupe en fin de mot, de préférence sur une pause ≥ 60 ms (fin de phrase > virgule > simple pause), jamais au
 *      milieu d'un nombre ou d'un montant (« 67 000 € ») ;
 *  R2  première coupe avant 2,0 s ;
 *  R3  ouverture (0-6 s) : plans de 1,5 à 2,5 s, au moins 2 coupes avant 5 s ;
 *  R4  ensuite 2,5-3,5 s, jamais plus de 6 s ;
 *  R5  un blanc de plus de 300 ms au milieu d'un plan force une coupe ;
 *  R6  au-delà de 30 s, une rupture forte (illustration, second angle, incrustation) toutes les 10 à 15 s ;
 *  R7  second angle ≈ 15 % (réglage), jamais deux fois de suite, jamais sur l'accroche ; absent en « un angle » ;
 *  R8  angle principal : large 100 % / poitrine 118-122 %, poitrine de préférence sur l'emphase, écart ≥ 15 %
 *      entre deux plans du double qui se suivent ; lèvres < 85 : poitrine plafonnée à 112 % et jamais 100 → 112 ;
 *  R9  zoom lent 100 → 106 % sur un plan de plus de 3 s, au plus un plan du double sur deux, jamais avec une
 *      incrustation (pas d'empilement) ;
 *  R10 illustrations ≈ 25 % du temps, 1,5-2,5 s, plein écran, jamais deux de suite, jamais dans les 1,5 dernières
 *      secondes, commencées SUR LE MOT qu'elles montrent (−0,2 / +0,1 s, `motAncre`) ; ouverture sur une image
 *      seulement si le réglage le permet (1,5 s au plus, visage avant 2 s) ;
 *  R11 fin 0,4-0,6 s après le dernier mot ;
 *  R12 incrustations jamais pendant l'encadré d'ouverture (0-3 s) ;
 *  R13 identité des plans : `segmentId` + instant ; une illustration verrouillée reste sur la même phrase ;
 *  R14 (lot « intensité », 02/10) : avec un réglage d'intensité, coupes, recadrages et illustrations ne dépassent pas
 *      À EUX SEULS le plafond d'une fenêtre de 3 s (Sobre 3 · Équilibré 5 · Très dynamique 7) : sinon une coupe entre
 *      deux plans du double est retirée (brique `intensite`, `allegerStructure`).
 */
import { allegerStructure } from "@/briques/intensite";
import type { AlerteQualite, Incrustation, IllustrationPlan, NiveauIntensite, PlanCommande, ValeurStyleMontage } from "@/domaine/types";
import type { RecetteMontage } from "@/formats/types";
import type { PlanProduit } from "../types";
import { normaliser, type MotReporte } from "./report";

export interface SegmentDecoupage {
  id: string;
  texte: string;
  /** Bloc de la recette (« accroche », « coeur »…). */
  bloc: string;
  emphase?: string[];
  intentionIllustration?: string;
  incrustation?: Incrustation;
}

export interface EntreeDecoupage {
  mots: MotReporte[];
  segments: SegmentDecoupage[];
  /** Plans de la commande : choix d'illustrations (verrous compris), LUT par plan, encadré d'ouverture. */
  plansIndicatifs: PlanCommande[];
  recette: RecetteMontage;
  style?: ValeurStyleMontage;
  repartition: { principal: number; second: number };
  /** Deux doubles de même tenue et même posture (sinon : un angle, effet 2 caméras par recadrage). */
  deuxAngles: boolean;
  ouvertureSurIllustration: boolean;
  /** Brique « illustrations » allumée. */
  illustrations: boolean;
  levresNote?: number;
  personnageId?: string;
  /** Durée de l'audio maître (la fin de la vidéo ne la dépasse pas). */
  dureeAudioSec?: number;
  /**
   * Lot « intensité » (02/10) : réglage global de la vidéo. Présent, le découpage consulte le chef d'orchestre (brique
   * `intensite`) : une structure trop chargée pour le plafond (Sobre surtout) perd une coupe. Absent (commande d'avant
   * le lot, démonstration M4) : découpage inchangé.
   */
  intensite?: NiveauIntensite;
  /**
   * Générateur G6 (ajout pur) : coupes IMPOSÉES (s) aux frontières ouverture | corps | facultatif | fin, pour que chaque
   * version par réseau se raccorde à la mère sur une coupe. Jamais déplacées ni fusionnées ; aucune illustration ne
   * les chevauche. Absent : découpage inchangé.
   */
  coupesImposeesSec?: number[];
  /**
   * Correcteur réel 2 (04/10) : le double est filmé EN PIED (réglage « Votre avatar est filmé »). Les cadrages
   * deviennent large ≈ mi-cuisse, poitrine, serré visage (emphase), centrés sur le haut du corps. Absent : inchangé.
   */
  sujetEnPied?: boolean;
  /** Correcteur réel 2 : fin courte « en boucle » (0,4-0,6 s). Absent : vraie respiration de fin (≈ 1,2 s). */
  finEnBoucle?: boolean;
}

/** Jamais moins que ceci après le dernier mot (le son déjà fabriqué peut être plus court que la fin voulue). */
const FIN_PLANCHER_SEC = 0.4;

/** Cadrages d'un sujet en pied si la recette n'en donne pas (commande d'avant le correcteur réel 2). */
export const CADRAGES_EN_PIED_PAR_DEFAUT = { largePct: 140, poitrinePct: 200, serrePct: 260, poitrineLevresFaiblesPct: 175, pointInteretY: 0.18 };
/** Au-delà, l'agrandissement de la piste 1080p perd en netteté : alerte. */
export const ZOOM_MAX_NET = 2.6;

type Genre = "principal" | "second" | "illustration";

interface Brouillon {
  debutSec: number;
  finSec: number;
  genre: Genre;
  illustration?: IllustrationPlan;
  motAncre?: number;
  segmentAncre?: string;
  zoom: number;
  zoomFin?: number;
  valeur?: "large" | "poitrine";
  incrustation?: Incrustation;
}

interface PointDeCoupe {
  t: number;
  /** 3 fin de phrase, 2 virgule, 1 simple pause ≥ 60 ms, 0 fin de mot sans pause. */
  qualite: number;
  force: boolean;
}

/** Paramètres chiffrés lus dans la recette et le style (jamais de valeur en dur dans le calcul). */
function parametres(e: EntreeDecoupage) {
  const s = e.style;
  const r = e.recette;
  return {
    ouverture: s?.dureePlanOuvertureSec ?? [1.5, 2.5],
    ouvertureSec: s?.ouvertureSec ?? 6,
    normal: [s?.dureePlanMinSec ?? 2.5, s?.dureePlanMaxSec ?? 3.5] as [number, number],
    plafond: s?.dureePlanPlafondSec ?? 6,
    rupture: s?.ruptureForteToutesLesSec ?? [10, 15],
    ecartMin: (s?.ecartCadrageMinPct ?? 15) / 100,
    premiere: r.coupes.premiereAvantSec,
    pauseMin: r.coupes.pauseMinMs / 1000,
    blancForce: r.coupes.blancForceCoupeMs / 1000,
    finApres: ((e.finEnBoucle ? (r.coupes.finBoucleSec ?? [0.4, 0.6]) : r.coupes.finApresDernierMotSec)[0] + (e.finEnBoucle ? (r.coupes.finBoucleSec ?? [0.4, 0.6]) : r.coupes.finApresDernierMotSec)[1]) / 2,
    // Correcteur réel 2 : la fin ne dépasse jamais le son ; sur un son plus court, au moins 0,4 s.
    finApresMin: Math.min(FIN_PLANCHER_SEC, (e.finEnBoucle ? (r.coupes.finBoucleSec ?? [0.4, 0.6]) : r.coupes.finApresDernierMotSec)[0]),
  };
}

const r3 = (x: number) => +x.toFixed(3);

/** Un nombre et ce qui le suit (« 67 000 € », « 135 € », « 4 points ») ne se séparent jamais d'une coupe. */
export function insecables(a: string, b: string): boolean {
  return /\d[\s ]*$/.test(a) && /^(\d|€|%|\$|euros?\b|pts?\b|points?\b|ans?\b|mois\b|jours?\b|km\b|h\b)/i.test(b);
}

function pointsDeCoupe(mots: MotReporte[], pauseMin: number, blancForce: number): PointDeCoupe[] {
  const points: PointDeCoupe[] = [];
  for (let i = 0; i + 1 < mots.length; i++) {
    if (insecables(mots[i].mot, mots[i + 1].mot)) continue;
    const blanc = mots[i + 1].debutSec - mots[i].finSec;
    const fin = mots[i].mot;
    const qualite = blanc < pauseMin ? 0 : /[.?!…]["»\s ]*$/.test(fin) ? 3 : /[,;:]["»\s ]*$/.test(fin) ? 2 : 1;
    points.push({ t: r3((mots[i].finSec + mots[i + 1].debutSec) / 2), qualite, force: blanc > blancForce });
  }
  return points;
}

/** Meilleure coupe dans [de, a] : la plus proche de la cible, une meilleure pause vaut 0,25 s d'écart. */
function meilleureCoupe(points: PointDeCoupe[], de: number, a: number, cible: number, qualiteMin: number): PointDeCoupe | undefined {
  let meilleur: PointDeCoupe | undefined;
  let score = Infinity;
  for (const p of points) {
    if (p.t < de || p.t > a || p.qualite < qualiteMin) continue;
    const s = Math.abs(p.t - cible) - 0.25 * p.qualite;
    if (s < score) {
      score = s;
      meilleur = p;
    }
  }
  return meilleur;
}

/** Mot d'ancrage d'une illustration : le premier mot du segment qui rejoint l'intention, sinon le premier mot plein. */
const MOTS_OUTILS = new Set(["le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "au", "aux", "en", "ce", "ces", "cette", "il", "elle", "on", "vous", "tu", "je", "nous", "est", "pas", "ne", "que", "qui", "se", "sa", "son", "ses", "votre", "vos", "ton", "ta", "tes", "mais", "pour", "par", "sur", "dans", "avec", "si", "y", "l", "d", "c", "qu", "j", "n", "s", "t"]);

function racine(mot: string): string {
  return normaliser(mot).replace(/(s|x|e|es)$/, "").slice(0, 6);
}

export function motAncreDe(motsSegment: MotReporte[], intention?: string): MotReporte | undefined {
  const pleins = motsSegment.filter((m) => !MOTS_OUTILS.has(normaliser(m.mot.split(/['’]/).pop() ?? m.mot)));
  const cibles = new Set((intention ?? "").split(/[\s'’,.;:!?]+/).filter((x) => x.length > 2 && !MOTS_OUTILS.has(normaliser(x))).map(racine));
  return pleins.find((m) => cibles.has(racine(m.mot.split(/['’]/).pop() ?? m.mot))) ?? pleins[0] ?? motsSegment[0];
}

const estEmphase = (texte: string, seg?: SegmentDecoupage) => /\d/.test(texte) || !!seg?.emphase?.some((e) => texte.toLowerCase().includes(e.toLowerCase()));

/** Découpe l'audio maître en plans (règles R1 à R13). */
export function decouperEnPlans(e: EntreeDecoupage): PlanProduit[] {
  const P = parametres(e);
  const mots = e.mots;
  if (!mots.length) return [];
  const dernier = mots[mots.length - 1].finSec;
  // R11 : fin 0,4-0,6 s après le dernier mot (sans dépasser le son, qui garde 0,5 s de queue).
  const fin = r3(Math.max(dernier + P.finApresMin, Math.min(dernier + P.finApres, e.dureeAudioSec ?? Infinity)));
  const points = pointsDeCoupe(mots, P.pauseMin, P.blancForce);
  const imposees = (e.coupesImposeesSec ?? []).filter((t) => t > 0.3 && t < fin - 0.3).sort((a, b) => a - b);
  const imposee = (t: number) => imposees.some((x) => Math.abs(x - t) < 0.002);
  const segmentParId = new Map(e.segments.map((s) => [s.id, s]));
  const motsDuSegment = (id: string) => mots.filter((m) => m.segmentId === id);

  // --- R10 : illustrations, posées d'abord (elles commencent sur leur mot, le reste s'organise autour). ---
  const illustrations: Brouillon[] = [];
  if (e.illustrations) {
    const debutMin = e.ouvertureSurIllustration ? 0 : 3;
    const couvertureMax = (e.recette.illustrations.couverturePct / 100) * fin;
    const [dMin, dMax] = e.recette.illustrations.dureeSec;
    const [avant, apres] = e.recette.illustrations.ancrageMotSec;
    const candidats = e.segments
      .map((s, rang) => {
        const indicatif = e.plansIndicatifs.filter((p) => p.segmentId === s.id && p.sourceImage === "illustration" && p.illustration).sort((a, b) => Number(!!b.illustration?.verrouille) - Number(!!a.illustration?.verrouille))[0];
        const illustration: IllustrationPlan | undefined = indicatif?.illustration ?? (s.intentionIllustration ? { source: "bibliotheque", requete: s.intentionIllustration, verrouille: false, candidats: [] } : undefined);
        return { s, rang, illustration };
      })
      .filter((c): c is { s: SegmentDecoupage; rang: number; illustration: IllustrationPlan } => !!c.illustration)
      // Les choix verrouillés par Will passent en premier (ils ne comptent pas dans le plafond de 25 %).
      .sort((a, b) => Number(b.illustration.verrouille) - Number(a.illustration.verrouille) || a.rang - b.rang);
    let couverture = 0;
    for (const c of candidats) {
      const ancre = motAncreDe(motsDuSegment(c.s.id), c.illustration.requete ?? c.s.intentionIllustration);
      if (!ancre) continue;
      const ouvre = e.ouvertureSurIllustration && c.rang === 0;
      let debut: number;
      let finIllu: number;
      if (ouvre) {
        debut = 0;
        const om = e.recette.illustrations.ouvertureMaxSec;
        finIllu = (meilleureCoupe(points, 1.0, om, om, 1) ?? meilleureCoupe(points, 1.0, om, om, 0))?.t ?? om;
      } else {
        // Sur le mot : une coupe existante entre −0,2 et +0,1 s du début du mot, sinon −0,1 s.
        debut = meilleureCoupe(points, ancre.debutSec + avant, ancre.debutSec + apres, ancre.debutSec - 0.05, 0)?.t ?? r3(ancre.debutSec - 0.1);
        // Vérif A2 (10/10) : sans pause dans la fenêtre (débit lent), la sortie tombe quand même ENTRE deux mots (R1) ;
        // avant, le repli coupait au milieu d'un mot (12,477 s dans « le » à 3,5 mots/s).
        const cible = debut + (dMin + dMax) / 2;
        finIllu = (meilleureCoupe(points, debut + dMin, debut + dMax, cible, 1) ?? meilleureCoupe(points, debut + dMin, debut + dMax, cible, 0))?.t ?? r3(cible);
      }
      const duree = finIllu - debut;
      const libre = illustrations.every((x) => finIllu + 1.5 <= x.debutSec || debut >= x.finSec + 1.5) && !imposees.some((t) => t > debut + 1e-3 && t < finIllu - 1e-3);
      const dansLaFin = finIllu > fin - e.recette.illustrations.pasDansDernieresSec;
      const tropTot = !ouvre && debut < debutMin;
      const auDela = !c.illustration.verrouille && couverture + duree > couvertureMax + 0.5;
      if (!libre || dansLaFin || tropTot || auDela) continue;
      illustrations.push({ debutSec: r3(debut), finSec: r3(finIllu), genre: "illustration", illustration: { ...c.illustration }, motAncre: ancre.index, segmentAncre: c.s.id, zoom: 1 });
      couverture += duree;
    }
    illustrations.sort((a, b) => a.debutSec - b.debutSec);
  }

  // --- R1-R5 : le double entre les illustrations. ---
  const plans: Brouillon[] = [];
  const couperDouble = (a: number, b: number) => {
    // R5 : un blanc trop long force une coupe, si elle laisse au moins 1 s de chaque côté.
    const forces = points.filter((p) => p.force && p.t > a + 1 && p.t < b - 1 && !imposees.some((t) => Math.abs(t - p.t) < 1)).map((p) => p.t);
    // G6 : les coupes imposées bornent aussi le remplissage (le raccord des versions tombe sur une coupe).
    const bornes = [a, ...[...forces, ...imposees.filter((t) => t > a + 1e-3 && t < b - 1e-3)].sort((x, y) => x - y), b];
    for (let k = 0; k + 1 < bornes.length; k++) remplir(bornes[k], bornes[k + 1]);
  };
  const remplir = (a: number, b: number) => {
    let t = a;
    while (b - t > 1e-6) {
      const enOuverture = t < P.ouvertureSec;
      let [min, max] = enOuverture ? P.ouverture : P.normal;
      let cible = (min + max) / 2;
      // R2 : la toute première coupe de la vidéo avant 2,0 s.
      if (t === 0) {
        max = Math.min(max, P.premiere - 0.05);
        min = Math.min(min, max - 0.4);
        cible = (min + max) / 2;
      }
      const reste = b - t;
      if (reste <= max + 1e-6 || (reste < 2 * min && reste <= P.plafond && t !== 0)) {
        plans.push({ debutSec: r3(t), finSec: r3(b), genre: "principal", zoom: 1 });
        return;
      }
      const limite = Math.min(t + max, b - (t === 0 ? 0.6 : min));
      const c =
        meilleureCoupe(points, t + min, limite, t + cible, 1) ??
        meilleureCoupe(points, t + min, limite, t + cible, 0) ??
        meilleureCoupe(points, t + (t === 0 ? 1.0 : 1.2), Math.min(t + (t === 0 ? P.premiere - 0.05 : P.plafond), b - 0.6), t + cible, 0);
      const coupe = c?.t ?? r3(Math.min(t + cible, b));
      plans.push({ debutSec: r3(t), finSec: r3(coupe), genre: "principal", zoom: 1 });
      t = coupe;
    }
  };
  let curseur = 0;
  for (const illu of illustrations) {
    if (illu.debutSec > curseur + 1e-6) couperDouble(curseur, illu.debutSec);
    plans.push(illu);
    curseur = illu.finSec;
  }
  if (fin > curseur + 1e-6) couperDouble(curseur, fin);
  // Un dernier morceau trop court rejoint le plan du double qui le précède (sans dépasser 6 s).
  for (let i = plans.length - 1; i > 0; i--) {
    const p = plans[i];
    const q = plans[i - 1];
    if (p.genre !== "illustration" && q.genre !== "illustration" && p.finSec - p.debutSec < 1.0 && p.finSec - q.debutSec <= P.plafond && !imposee(p.debutSec)) {
      q.finSec = p.finSec;
      plans.splice(i, 1);
    }
  }

  // Segment et texte de chaque plan.
  const motsDans = (p: Brouillon) => mots.filter((m) => (m.debutSec + m.finSec) / 2 >= p.debutSec && (m.debutSec + m.finSec) / 2 < p.finSec);
  const segmentDe = (p: Brouillon) => p.segmentAncre ?? motsDans(p)[0]?.segmentId ?? mots.filter((m) => m.debutSec < p.finSec).at(-1)?.segmentId ?? e.segments[0]?.id ?? "";

  // --- R12 : incrustations, sur le premier plan du double de leur segment après l'encadré (0-3 s). ---
  for (const s of e.segments) {
    const inc = s.incrustation ?? e.plansIndicatifs.find((p) => p.segmentId === s.id && p.incrustation)?.incrustation;
    if (!inc) continue;
    const cible = plans.find((p) => p.genre !== "illustration" && p.debutSec >= 3 && segmentDe(p) === s.id);
    if (cible) cible.incrustation = inc;
  }

  // --- R7 + R6 : second angle. ---
  const accroche = new Set(e.segments.filter((s) => s.bloc === "accroche").map((s) => s.id));
  const finAccroche = Math.max(0, ...mots.filter((m) => accroche.has(m.segmentId)).map((m) => m.finSec));
  const secondPossible = e.deuxAngles && e.repartition.second > 0;
  const eligible = (i: number) => {
    const p = plans[i];
    return secondPossible && p.genre === "principal" && p.debutSec >= finAccroche - 1e-6 && plans[i - 1]?.genre !== "second" && plans[i + 1]?.genre !== "second";
  };
  const rupture = (p: Brouillon) => p.genre === "illustration" || p.genre === "second" || !!p.incrustation;
  if (fin > 30) {
    let derniere = 0;
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];
      if (rupture(p)) {
        derniere = p.debutSec;
        continue;
      }
      if (p.debutSec - derniere < P.rupture[0]) continue;
      const prochaine = plans.slice(i + 1).find(rupture);
      if (prochaine && prochaine.debutSec <= derniere + P.rupture[1]) continue;
      if (eligible(i)) {
        p.genre = "second";
        derniere = p.debutSec;
      }
    }
  }
  const dureeDouble = plans.filter((p) => p.genre !== "illustration").reduce((s, p) => s + p.finSec - p.debutSec, 0);
  const dureeSecond = () => plans.filter((p) => p.genre === "second").reduce((s, p) => s + p.finSec - p.debutSec, 0);
  for (let garde = 0; garde < plans.length && dureeSecond() < e.repartition.second * dureeDouble - 1.5; garde++) {
    // Le plus loin possible des ruptures existantes.
    let choix = -1;
    let distance = -1;
    plans.forEach((p, i) => {
      if (!eligible(i)) return;
      const d = Math.min(...plans.filter(rupture).map((x) => Math.abs(x.debutSec - p.debutSec)), Infinity);
      if (d > distance) {
        distance = d;
        choix = i;
      }
    });
    if (choix < 0) break;
    plans[choix].genre = "second";
  }

  // --- R8 : cadrages de l'angle principal. ---
  const C = e.recette.cadrages;
  const levresFaibles = (e.levresNote ?? 100) < C.seuilLevres;
  const poitrine = levresFaibles ? C.poitrinePlafondLevresFaiblesPct / 100 : C.poitrineParDefautPct / 100;
  const emphaseDe = (p: Brouillon) => estEmphase(motsDans(p).map((m) => m.mot).join(" "), segmentParId.get(segmentDe(p)));
  for (let i = 0; i < plans.length; ) {
    if (plans[i].genre !== "principal") {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < plans.length && plans[j + 1].genre === "principal") j++;
    const suite = plans.slice(i, j + 1);
    if (levresFaibles) {
      // Jamais 100 → 112 % (écart trop faible) : large partout, 112 % seulement pour un plan isolé sur l'emphase.
      for (const p of suite) {
        p.valeur = suite.length === 1 && emphaseDe(p) ? "poitrine" : "large";
        p.zoom = p.valeur === "poitrine" ? poitrine : C.largePct / 100;
      }
    } else {
      const score = (parite: number) => suite.reduce((s, p, k) => s + ((k % 2 === parite) === true && emphaseDe(p) ? 1 : 0), 0);
      // parité 1 : les plans impairs de la suite en poitrine ; parité 0 : les pairs. À égalité, on ouvre large.
      const pariteePoitrine = score(0) > score(1) ? 0 : 1;
      suite.forEach((p, k) => {
        p.valeur = k % 2 === pariteePoitrine ? "poitrine" : "large";
        p.zoom = p.valeur === "poitrine" ? poitrine : C.largePct / 100;
      });
    }
    i = j + 1;
  }
  for (const p of plans) if (p.genre === "second") {
    p.valeur = "large";
    p.zoom = C.largePct / 100;
  }
  // Lèvres faibles : deux plans principaux voisins au même cadrage sont fusionnés (sans dépasser 6 s).
  if (levresFaibles) {
    for (let i = plans.length - 1; i > 0; i--) {
      const p = plans[i];
      const q = plans[i - 1];
      if (p.genre === "principal" && q.genre === "principal" && p.zoom === q.zoom && !p.incrustation && p.finSec - q.debutSec <= P.plafond && !imposee(p.debutSec)) {
        q.finSec = p.finSec;
        plans.splice(i, 1);
      }
    }
  }

  // --- R9 : zoom lent 100 → 106 % (plan large de plus de 3 s, un plan du double sur deux, jamais avec une incrustation). ---
  const [z0, z1] = C.zoomLentPct;
  let precedentZoome = false;
  for (const p of plans) {
    if (p.genre === "illustration") continue;
    const peut: boolean = p.genre === "principal" && p.valeur === "large" && p.finSec - p.debutSec > C.zoomLentApresSec && !p.incrustation && !precedentZoome;
    if (peut) p.zoomFin = +((p.zoom * z1) / z0).toFixed(3);
    precedentZoome = peut;
  }
  // R8 : écart ≥ 15 % au raccord entre deux plans principaux voisins (le zoom lent compte par sa fin).
  for (let i = 1; i < plans.length; i++) {
    const a = plans[i - 1];
    const b = plans[i];
    if (a.genre !== "principal" || b.genre !== "principal") continue;
    const ecart = (x: number, y: number) => Math.abs(y - x) / Math.min(x, y);
    if (ecart(a.zoomFin ?? a.zoom, b.zoom) >= P.ecartMin) continue;
    if (b.valeur === "poitrine" && !levresFaibles) b.zoom = C.poitrinePct[1] / 100;
    if (ecart(a.zoomFin ?? a.zoom, b.zoom) < P.ecartMin) a.zoomFin = undefined;
  }

  // --- Correcteur réel 2 : sujet en pied → large ≈ mi-cuisse, poitrine, serré visage sur l'emphase (effet 2 caméras). ---
  const pied = e.sujetEnPied ? (e.recette.cadrages.enPied ?? CADRAGES_EN_PIED_PAR_DEFAUT) : null;
  if (pied) {
    for (const p of plans) {
      if (p.genre === "illustration") continue;
      const lent = p.zoomFin !== undefined ? p.zoomFin / p.zoom : undefined;
      if (p.valeur === "poitrine" && p.genre === "principal") p.zoom = levresFaibles ? pied.poitrineLevresFaiblesPct / 100 : emphaseDe(p) ? pied.serrePct / 100 : pied.poitrinePct / 100;
      else p.zoom = pied.largePct / 100;
      if (lent !== undefined) p.zoomFin = +(p.zoom * lent).toFixed(3);
    }
  }
  const pointY = pied ? pied.pointInteretY : 0.38;

  // --- Plans produits. ---
  const encadre = e.plansIndicatifs.find((p) => p.texteEcran)?.texteEcran;
  const produits = plans.map((p, i) => {
    const segmentId = segmentDe(p);
    const seg = segmentParId.get(segmentId);
    const texte = motsDans(p).map((m) => m.mot).join(" ");
    const indicatif = e.plansIndicatifs.find((x) => x.segmentId === segmentId);
    const angle = p.genre === "second" ? e.recette.angles.second : p.genre === "principal" ? e.recette.angles.principal : undefined;
    const produit: PlanProduit = {
      ordre: i + 1,
      debutSec: p.debutSec,
      finSec: p.finSec,
      texte,
      segmentId,
      personnageId: p.genre === "illustration" ? undefined : e.personnageId,
      angle,
      sourceImage: p.genre === "illustration" ? "illustration" : "double",
      illustration: p.illustration,
      texteEcran: i === 0 ? encadre : undefined,
      motsEnValeur: (seg?.emphase ?? []).filter((x) => texte.toLowerCase().includes(x.toLowerCase())),
      cadrage: { pointInteret: { x: 0.5, y: p.genre === "illustration" ? 0.38 : pointY }, zoom: p.zoom, zoomFin: p.zoomFin, valeur: p.valeur },
      transition: "coupe",
      lutId: indicatif?.lutId,
      incrustation: p.incrustation,
      motAncre: p.motAncre,
    };
    return produit;
  });
  // Lot « intensité » : la structure respecte le plafond de la fenêtre de 3 s (R14, `allegerStructure`).
  return e.intensite ? allegerStructure(produits, e.intensite, { angleSecond: e.recette.angles.second, plafondPlanSec: P.plafond, ...(imposees.length ? { coupesProtegees: imposees } : {}) }) : produits;
}

export interface ContexteControle {
  recette: RecetteMontage;
  style?: ValeurStyleMontage;
  mots?: MotReporte[];
  segments?: SegmentDecoupage[];
  ouvertureSurIllustration?: boolean;
  /** Correcteur réel 2 : option « fin en boucle » (fin attendue 0,4-0,6 s). */
  finEnBoucle?: boolean;
}

/** Contrôle `rythme` et `fin` (B.8) : jamais bloquant ; sert aussi d'oracle aux tests du découpage. */
export function controlerRythme(plans: PlanProduit[], ctx: ContexteControle): AlerteQualite[] {
  const alertes: AlerteQualite[] = [];
  if (!plans.length) return alertes;
  const P = parametres({ recette: ctx.recette, style: ctx.style } as EntreeDecoupage);
  const coupes = plans.slice(1).map((p) => p.debutSec);
  const dureeTotale = plans[plans.length - 1].finSec;
  if (coupes.length && coupes[0] >= P.premiere) alertes.push({ code: "rythme", gravite: "attention", message: "La première coupe arrive après 2 s." });
  if (dureeTotale > 5 && coupes.filter((c) => c < 5).length < ctx.recette.coupes.auMoinsAvant5s) alertes.push({ code: "rythme", gravite: "attention", message: "Moins de 2 coupes avant 5 s." });
  for (const p of plans) if (p.finSec - p.debutSec > P.plafond + 1e-6) alertes.push({ code: "rythme", gravite: "attention", message: `Le plan ${p.ordre} dure plus de 6 s.` });
  // Correcteur réel 2 : agrandi plus de 2,6 fois, la piste du double (1080p) perd en netteté.
  for (const p of plans) if (p.sourceImage === "double" && Math.max(p.cadrage.zoom, p.cadrage.zoomFin ?? 0) > ZOOM_MAX_NET + 1e-6) alertes.push({ code: "defaut-visuel", gravite: "attention", message: `Plan ${p.ordre} : votre avatar est agrandi plus de 2,6 fois, l'image peut perdre en netteté.` });
  for (let i = 1; i < plans.length; i++) {
    const a = plans[i - 1];
    const b = plans[i];
    if (a.sourceImage === "double" && b.sourceImage === "double" && a.angle === b.angle) {
      const za = a.cadrage.zoomFin ?? a.cadrage.zoom;
      if (Math.abs(b.cadrage.zoom - za) / Math.min(za, b.cadrage.zoom) < P.ecartMin - 1e-6) alertes.push({ code: "rythme", gravite: "info", message: `Cadrages trop proches entre les plans ${a.ordre} et ${b.ordre}.` });
    }
    if (a.sourceImage === "illustration" && b.sourceImage === "illustration") alertes.push({ code: "rythme", gravite: "attention", message: `Deux illustrations de suite (plans ${a.ordre} et ${b.ordre}).` });
    if (a.angle && a.angle === ctx.recette.angles.second && b.angle === ctx.recette.angles.second && a.sourceImage === "double" && b.sourceImage === "double") alertes.push({ code: "rythme", gravite: "attention", message: "Le second angle revient deux fois de suite." });
  }
  const premierVisage = plans.find((p) => p.sourceImage === "double");
  if (premierVisage && premierVisage.debutSec >= ctx.recette.illustrations.visageAvantSec) alertes.push({ code: "rythme", gravite: "attention", message: "Le visage apparaît après 2 s." });
  for (const p of plans) {
    if (p.sourceImage === "illustration" && p.finSec > dureeTotale - ctx.recette.illustrations.pasDansDernieresSec + 1e-6) alertes.push({ code: "rythme", gravite: "attention", message: "Une illustration tombe dans les dernières secondes." });
  }
  if (ctx.segments && ctx.mots) {
    const accroche = new Set(ctx.segments.filter((s) => s.bloc === "accroche").map((s) => s.id));
    const finAccroche = Math.max(0, ...ctx.mots.filter((m) => accroche.has(m.segmentId)).map((m) => m.finSec));
    if (plans.some((p) => p.angle === ctx.recette.angles.second && p.sourceImage === "double" && p.debutSec < finAccroche - 1e-6)) alertes.push({ code: "rythme", gravite: "attention", message: "Le second angle tombe sur l'accroche." });
  }
  if (ctx.mots?.length) {
    const ecart = dureeTotale - ctx.mots[ctx.mots.length - 1].finSec;
    const [a, b] = ctx.finEnBoucle ? (ctx.recette.coupes.finBoucleSec ?? [0.4, 0.6]) : ctx.recette.coupes.finApresDernierMotSec;
    const f = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
    if (ecart < a - 1e-6 || ecart > b + 1e-6) alertes.push({ code: "fin", gravite: "attention", message: `La fin ne tombe pas ${f(a)} à ${f(b)} s après le dernier mot.` });
  }
  if (dureeTotale > 30) {
    let derniere = 0;
    for (const p of plans) {
      const estRupture = p.sourceImage === "illustration" || p.angle === ctx.recette.angles.second || !!p.incrustation;
      if (!estRupture) continue;
      if (p.debutSec - derniere > P.rupture[1] + 1e-6) alertes.push({ code: "rythme", gravite: "info", message: `Aucune rupture forte entre ${Math.round(derniere)} s et ${Math.round(p.debutSec)} s.` });
      derniere = p.debutSec;
    }
    if (dureeTotale - derniere > P.rupture[1] + 3) alertes.push({ code: "rythme", gravite: "info", message: `Aucune rupture forte après ${Math.round(derniere)} s.` });
  }
  return alertes;
}
