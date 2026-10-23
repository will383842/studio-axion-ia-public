/**
 * BRIQUE COMMUNE « DÉCLINAISON PAR RÉSEAU » (générateur G6 et G6b ; plan v5 B.2.3, B.4.2, B.6.17, B.10). PUR.
 *
 * Une vidéo MÈRE (la version la plus longue du sujet, en 9:16) est fabriquée une fois ; chaque autre réseau reçoit une
 * VERSION dont seuls le début et la fin sont refaits : le corps est repris de la mère, morceau par morceau, et chaque
 * raccord tombe sur une COUPE de la mère (changement de plan). Le segment facultatif (LinkedIn) est retiré de la même
 * façon. Le même assemblage sert à « je lis » (G6b) : 1 prise du corps + la prise du début et de la fin du réseau.
 *
 * Rien n'est propre à un format ni à un réseau : les segments arrivent par leurs identifiants, les réseaux par la
 * commande, la géométrie par le registre des réseaux. Le moteur de format ORCHESTRE ces fonctions ; `studio-rendu`
 * (opération `assemblage`) met les morceaux bout à bout.
 */
import { motsParSecondeMesures } from "@/domaine/debit-voix";
import type { BlocScript, CommandeFabrication, IdReseau, Incrustation, MotHorodate, Ratio } from "@/domaine/types";
import type { PlanProduit } from "@/moteurs/types";
import { zoneProtegeeCombinee, type ZoneProtegee } from "@/reseaux";
import { formatsVoulus } from "@/reseaux/sorties";

export const VERSION_BRIQUE_DECLINAISON = "decl-1";

/* ------------------------------------------------------------------ */
/* Réseaux et zones                                                     */
/* ------------------------------------------------------------------ */

/** Réseaux d'une fabrication : ceux de la commande (cochés par Will), sinon ceux que le format conseille. */
export function reseauxDeCommande(c: Pick<CommandeFabrication, "reseaux">, conseilles: IdReseau[] = []): IdReseau[] {
  return c.reseaux?.length ? c.reseaux : conseilles;
}

/**
 * Réseaux qui règlent l'encadré et l'incrustation d'appel : ceux de LA version (refaits par variante, B.6.17), sinon
 * ceux de la fabrication. Les sous-titres, eux, restent sur l'union de tous les réseaux cochés.
 */
export function reseauxDesCalques(c: Pick<CommandeFabrication, "reseaux" | "variante">, conseilles: IdReseau[] = []): IdReseau[] {
  return c.variante ? [c.variante.reseau] : reseauxDeCommande(c, conseilles);
}

/** Union la plus stricte des zones protégées des réseaux cochés (B.6.17), en % de l'image. */
export function zonesProtegeesUnion(reseaux: IdReseau[], ratio: Ratio = "9:16"): ZoneProtegee | null {
  return zoneProtegeeCombinee(ratio, reseaux);
}

/** Une zone est-elle au moins aussi stricte qu'une autre, sur chaque bord ? */
export function zoneAuMoins(z: ZoneProtegee, minimum: ZoneProtegee): boolean {
  return z.haut >= minimum.haut && z.bas >= minimum.bas && z.gauche >= minimum.gauche && z.droite >= minimum.droite;
}

/* ------------------------------------------------------------------ */
/* Mère                                                                 */
/* ------------------------------------------------------------------ */

/** La mère : la version la plus longue (à égalité, le premier code dans l'ordre alphabétique : choix stable). */
export function choisirMere<T extends { dureeSec: number; code: string }>(versions: T[]): T | undefined {
  return [...versions].sort((a, b) => b.dureeSec - a.dureeSec || a.code.localeCompare(b.code))[0];
}

/**
 * Formats d'image de la mère : 9:16 toujours, plus les options cochées (« 4:5 », « Carré »). Formats par réseau T5 :
 * plus le format préféré des réseaux donnés que le moteur sait faire (`capacites`, `formatsVoulus`) : LinkedIn sort en 9:16 (décision
 * de Will du 19/10) : il n'ajoute plus de 4:5 ; la version d'un réseau, appelée avec SON réseau, sort dans le format de ce réseau (sauf formats exclus de T5 : l'avocat).
 * Jamais de 16:9 (prise verticale, décision 3 du 18/10). Sans réseau : comportement d'avant.
 */
export function ratiosDeLaMere(options: Ratio[] = [], reseaux: readonly IdReseau[] = [], capacites: readonly Ratio[] = []): Ratio[] {
  const voulus = formatsVoulus(options, reseaux, capacites, "9:16");
  return ["9:16", ...(["4:5", "1:1"] as Ratio[]).filter((r) => voulus.includes(r))];
}

/* ------------------------------------------------------------------ */
/* Temps des segments et coupes imposées                                */
/* ------------------------------------------------------------------ */

export interface TempsSegment {
  segmentId: string;
  debutSec: number;
  finSec: number;
}

/** Début et fin de chaque segment, d'après ses mots horodatés, dans l'ordre de parole. */
export function tempsDesSegments(mots: { segmentId: string; debutSec: number; finSec: number }[]): TempsSegment[] {
  const parId = new Map<string, TempsSegment>();
  for (const m of mots) {
    const t = parId.get(m.segmentId);
    if (!t) parId.set(m.segmentId, { segmentId: m.segmentId, debutSec: m.debutSec, finSec: m.finSec });
    else {
      t.debutSec = Math.min(t.debutSec, m.debutSec);
      t.finSec = Math.max(t.finSec, m.finSec);
    }
  }
  return [...parId.values()].sort((a, b) => a.debutSec - b.debutSec);
}

/** Groupe d'un segment pour les coupes : ouverture, fin, chaque segment facultatif à part, le reste = corps. */
function groupeDe(id: string, parties: NonNullable<CommandeFabrication["partiesDeclinaison"]>): string {
  if (parties.ouverture.includes(id)) return "ouverture";
  if (parties.fin.includes(id)) return "fin";
  if (parties.facultatifs.includes(id)) return `facultatif:${id}`;
  return "corps";
}

/**
 * Coupes IMPOSÉES (milieu du blanc) à chaque frontière ouverture | corps | facultatif | fin : toute version s'y
 * raccorde. Absent `parties` : aucune (découpage d'avant G6).
 */
export function coupesImposees(temps: TempsSegment[], parties?: CommandeFabrication["partiesDeclinaison"]): number[] {
  if (!parties) return [];
  const coupes: number[] = [];
  for (let i = 1; i < temps.length; i++) {
    if (groupeDe(temps[i - 1].segmentId, parties) !== groupeDe(temps[i].segmentId, parties)) coupes.push(+((temps[i - 1].finSec + temps[i].debutSec) / 2).toFixed(3));
  }
  return coupes;
}

/* ------------------------------------------------------------------ */
/* Assemblage                                                           */
/* ------------------------------------------------------------------ */

/** Une source de morceaux : l'audio maître de la mère, le son neuf d'une version, une prise filmée. */
export interface SourceAssemblage {
  /** Nom d'entrée (« mere », « partiel », « prise-<id> »). */
  nom: string;
  dureeSec: number;
  segments: TempsSegment[];
  motsPrononces: MotHorodate[];
  /** Plans de la source : le raccord doit tomber sur une de leurs coupes (sinon il se verrait). */
  plans?: PlanProduit[];
}

/** Une étape : des segments CONTIGUS d'une source, dans l'ordre. */
export interface EtapeAssemblage {
  source: string;
  segmentIds: string[];
}

export interface Jointure {
  /** Instant du raccord dans la vidéo assemblée. */
  t: number;
  visible: boolean;
  raison?: string;
  /** Blanc de moins de 40 ms autour du raccord : signalé, jamais bloquant. */
  serre?: boolean;
}

export interface MorceauPlace {
  entree: string;
  deSec: number;
  aSec: number;
  /** Début du morceau dans la vidéo assemblée. */
  versSec: number;
}

export interface ResultatAssemblage {
  morceaux: MorceauPlace[];
  dureeSec: number;
  motsPrononces: MotHorodate[];
  plans: PlanProduit[];
  segments: TempsSegment[];
  jointures: Jointure[];
  /** Un raccord au moins se verrait : bascule en corps distinct (coût affiché). */
  visible: boolean;
}

const TOLERANCE_COUPE_SEC = 0.06;
/** Marge gardée avant le premier mot et après le dernier quand la source n'a pas de plans (prise filmée). */
export const MARGE_PRISE_SEC = { avant: 0.25, apres: 0.5 } as const;
const r3 = (x: number) => +x.toFixed(3);

/** Une coupe de la source entre la fin d'un segment et le début du suivant, la plus proche du milieu du blanc. */
function coupeEntre(plans: PlanProduit[] | undefined, fin: number, debut: number): number | null {
  const milieu = (fin + debut) / 2;
  if (!plans?.length) return r3(milieu);
  const bornes = plans.slice(1).map((p) => p.debutSec);
  const candidates = bornes.filter((b) => b >= fin - TOLERANCE_COUPE_SEC && b <= debut + TOLERANCE_COUPE_SEC);
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (Math.abs(b - milieu) < Math.abs(a - milieu) ? b : a));
}

/** Fenêtre d'une étape dans sa source : début et fin sur des coupes, raccords visibles signalés. */
export function fenetreDansSource(src: SourceAssemblage, ids: string[]): { de: number; a: number; debut: Omit<Jointure, "t">; fin: Omit<Jointure, "t"> } {
  const idx = ids.map((id) => src.segments.findIndex((s) => s.segmentId === id));
  if (idx.some((i) => i < 0)) throw new Error(`Segment absent de la source « ${src.nom} ».`);
  for (let k = 1; k < idx.length; k++) if (idx[k] !== idx[k - 1] + 1) throw new Error(`Segments non contigus dans la source « ${src.nom} ».`);
  const premier = src.segments[idx[0]];
  const dernier = src.segments[idx[idx.length - 1]];
  const avant = src.segments[idx[0] - 1];
  const apres = src.segments[idx[idx.length - 1] + 1];
  const debut: Omit<Jointure, "t"> = { visible: false };
  const fin: Omit<Jointure, "t"> = { visible: false };
  let de: number;
  let a: number;
  if (avant) {
    const c = coupeEntre(src.plans, avant.finSec, premier.debutSec);
    if (c === null) Object.assign(debut, { visible: true, raison: `aucune coupe de « ${src.nom} » avant ce morceau` });
    de = c ?? r3((avant.finSec + premier.debutSec) / 2);
    if (premier.debutSec - avant.finSec < 0.04) debut.serre = true;
  } else de = src.plans?.length ? 0 : r3(Math.max(0, premier.debutSec - MARGE_PRISE_SEC.avant));
  if (apres) {
    const c = coupeEntre(src.plans, dernier.finSec, apres.debutSec);
    if (c === null) Object.assign(fin, { visible: true, raison: `aucune coupe de « ${src.nom} » après ce morceau` });
    a = c ?? r3((dernier.finSec + apres.debutSec) / 2);
    if (apres.debutSec - dernier.finSec < 0.04) fin.serre = true;
  } else a = src.plans?.length ? src.dureeSec : r3(Math.min(src.dureeSec, dernier.finSec + MARGE_PRISE_SEC.apres));
  return { de, a, debut, fin };
}

/**
 * Assemble les étapes, dans l'ordre : morceaux (pour `studio-rendu`), mots prononcés, plans et segments replacés sur
 * la vidéo assemblée, raccords. Aucun morceau n'est modifié : seule sa place change.
 */
export function assembler(sources: SourceAssemblage[], etapes: EtapeAssemblage[]): ResultatAssemblage {
  const parNom = new Map(sources.map((s) => [s.nom, s]));
  const morceaux: MorceauPlace[] = [];
  const motsPrononces: MotHorodate[] = [];
  const plans: PlanProduit[] = [];
  const segments: TempsSegment[] = [];
  const jointures: Jointure[] = [];
  let t = 0;
  etapes.forEach((e, k) => {
    const src = parNom.get(e.source);
    if (!src) throw new Error(`Source « ${e.source} » inconnue.`);
    const f = fenetreDansSource(src, e.segmentIds);
    const decalage = t - f.de;
    const dedans = (x: number) => x >= f.de - 1e-6 && x < f.a - 1e-6;
    // Raccord avec le morceau précédent : visible si l'un des deux bords n'est pas sur une coupe.
    if (k > 0) {
      const precedente = jointures.pop()!;
      jointures.push({ t: r3(t), visible: precedente.visible || f.debut.visible, raison: [precedente.raison, f.debut.raison].filter(Boolean).join(" ; ") || undefined, serre: precedente.serre || f.debut.serre || undefined });
    }
    morceaux.push({ entree: src.nom, deSec: r3(f.de), aSec: r3(f.a), versSec: r3(t) });
    for (const m of src.motsPrononces) if (dedans((m.debutSec + m.finSec) / 2)) motsPrononces.push({ ...m, debutSec: r3(m.debutSec + decalage), finSec: r3(Math.min(m.finSec, f.a) + decalage) });
    for (const s of src.segments) if (e.segmentIds.includes(s.segmentId)) segments.push({ segmentId: s.segmentId, debutSec: r3(s.debutSec + decalage), finSec: r3(s.finSec + decalage) });
    for (const p of src.plans ?? []) {
      const debut = Math.max(p.debutSec, f.de);
      const fin = Math.min(p.finSec, f.a);
      if (fin - debut < 0.05) continue;
      plans.push({ ...p, debutSec: r3(debut + decalage), finSec: r3(fin + decalage) });
    }
    t += f.a - f.de;
    // Bord de fin, complété au prochain tour (le dernier bord n'est pas un raccord).
    if (k < etapes.length - 1) jointures.push({ t: r3(t), ...f.fin });
  });
  plans.forEach((p, i) => (p.ordre = i + 1));
  return { morceaux, dureeSec: r3(t), motsPrononces, plans, segments, jointures, visible: jointures.some((j) => j.visible) };
}

/** Coupe une liste d'identifiants en suites contiguës dans l'ordre d'une source. */
export function suitesContigues(ids: string[], ordre: string[]): string[][] {
  const suites: string[][] = [];
  let courante: string[] = [];
  let derniere = -2;
  for (const id of ids) {
    const i = ordre.indexOf(id);
    if (i !== derniere + 1 && courante.length) {
      suites.push(courante);
      courante = [];
    }
    courante.push(id);
    derniere = i;
  }
  if (courante.length) suites.push(courante);
  return suites;
}

/**
 * Les étapes d'une version par réseau : son début (source neuve), le corps repris de la mère par suites contiguës (un
 * segment facultatif absent de la version ouvre un raccord de plus), puis sa fin (source neuve, ou la fin de la mère
 * quand seule l'ouverture est refaite : « 2e ouverture »).
 */
export function etapesVariante(e: { ordreVersion: string[]; refaits: Set<string>; ordreMere: string[]; sourceNeuve?: string; sourceMere?: string }): EtapeAssemblage[] {
  const neuve = e.sourceNeuve ?? "partiel";
  const mere = e.sourceMere ?? "mere";
  const etapes: EtapeAssemblage[] = [];
  let i = 0;
  while (i < e.ordreVersion.length) {
    const refait = e.refaits.has(e.ordreVersion[i]);
    const groupe: string[] = [];
    while (i < e.ordreVersion.length && e.refaits.has(e.ordreVersion[i]) === refait) groupe.push(e.ordreVersion[i++]);
    if (refait) etapes.push({ source: neuve, segmentIds: groupe });
    else for (const s of suitesContigues(groupe, e.ordreMere)) etapes.push({ source: mere, segmentIds: s });
  }
  return etapes;
}

/** Tranches gardées de la mère (`CommandeFabrication.variante.tranches`) : du premier au dernier morceau repris. */
export function tranchesGardees(r: Pick<ResultatAssemblage, "morceaux">, sourceMere = "mere"): { debutRemplaceSec: number; finRemplaceSec: number } {
  const m = r.morceaux.filter((x) => x.entree === sourceMere);
  return { debutRemplaceSec: m[0]?.deSec ?? 0, finRemplaceSec: m.at(-1)?.aSec ?? 0 };
}

/**
 * Côté mère SEULEMENT (avant la voix neuve) : les morceaux du corps repris, leurs coupes, et si un raccord se verrait.
 * Le service s'en sert pour décider avant de payer : raccord visible → la version est fabriquée en entier (coût affiché).
 */
export function raccordsSurMere(mere: SourceAssemblage, etapes: EtapeAssemblage[]): { tranches: { debutRemplaceSec: number; finRemplaceSec: number }; visible: boolean; raisons: string[] } {
  const fen = etapes.filter((e) => e.source === mere.nom).map((e) => fenetreDansSource(mere, e.segmentIds));
  const raisons = fen.flatMap((f) => [f.debut.raison, f.fin.raison]).filter((x): x is string => !!x);
  return { tranches: { debutRemplaceSec: fen[0]?.de ?? 0, finRemplaceSec: fen.at(-1)?.a ?? 0 }, visible: fen.some((f) => f.debut.visible || f.fin.visible), raisons };
}

/* ------------------------------------------------------------------ */
/* Commande partielle (ce qui est refait, et seulement ça, est payé)    */
/* ------------------------------------------------------------------ */

/** Texte dit de chaque segment non vide (index de `texteDitParSegment` = rang parmi les segments non vides). */
export function textesDitsParId(c: Pick<CommandeFabrication, "script" | "texteDitParSegment">): Map<string, string> {
  const m = new Map<string, string>();
  if (!c.texteDitParSegment) return m;
  let i = 0;
  for (const b of c.script.blocs) for (const s of b.segments) if (s.texte.trim()) m.set(s.id, c.texteDitParSegment[i++] ?? s.texte);
  return m;
}

/**
 * La commande réduite aux segments refaits : texte, texte dit, plans indicatifs, durée (au prorata des caractères).
 * Sert à l'estimation (seuls le début et la fin sont payés) et à la voix d'une version.
 */
export function commandePartielle(c: CommandeFabrication, ids: Set<string>): CommandeFabrication {
  const dits = textesDitsParId(c);
  const blocs = c.script.blocs.map((b) => ({ ...b, segments: b.segments.filter((s) => ids.has(s.id)) })).filter((b) => b.segments.length);
  const texteComplet = blocs.flatMap((b) => b.segments.map((s) => s.texte)).join(" ");
  const total = Math.max(1, c.script.texteComplet.length);
  return {
    ...c,
    script: { ...c.script, blocs, texteComplet },
    plans: c.plans.filter((p) => !p.segmentId || ids.has(p.segmentId)),
    dureeCibleSec: Math.max(1, Math.round((c.dureeCibleSec * texteComplet.length) / total)),
    ...(c.texteDitParSegment ? { texteDitParSegment: blocs.flatMap((b) => b.segments.filter((s) => s.texte.trim()).map((s) => dits.get(s.id) ?? s.texte)) } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Incrustation d'appel, débit réel                                     */
/* ------------------------------------------------------------------ */

/** Pose l'incrustation d'appel (objet : téléphone ou logo) sur le premier segment du bloc d'appel, s'il n'en a pas. */
export function avecIncrustationAppel(blocs: BlocScript[], blocAppel: string, elementId: string): BlocScript[] {
  let posee = false;
  return blocs.map((b) => {
    if (posee || b.blocRecette !== blocAppel) return b;
    return {
      ...b,
      segments: b.segments.map((s, i) => {
        if (i > 0 || posee || !s.texte.trim()) return s;
        posee = true;
        const inc: Incrustation = s.incrustation ?? { type: "objet", elementId };
        return { ...s, incrustation: inc };
      }),
    };
  });
}

/** Relevés de débit gardés (B.4.2) : 50 au plus. */
export const RELEVES_DEBIT_MAX = 50;
/** Relevés exigés avant de remplacer le débit écrit. */
export const RELEVES_DEBIT_MIN = 5;

/**
 * Recalage du débit (B.4.2) : historique plafonné à 50 relevés ; dès 5 relevés, la médiane des 10 derniers remplace
 * la valeur (non bornée à ± 15 %). Avant : `null` (la valeur écrite reste).
 */
export function recalerDebit(releves: number[], nouveau?: number): { releves: number[]; valeur: number | null } {
  const tous = [...releves, ...(nouveau !== undefined && Number.isFinite(nouveau) && nouveau > 0 ? [+nouveau.toFixed(3)] : [])].slice(-RELEVES_DEBIT_MAX);
  if (tous.length < RELEVES_DEBIT_MIN) return { releves: tous, valeur: null };
  const dix = [...tous.slice(-10)].sort((a, b) => a - b);
  const m = dix.length % 2 ? dix[(dix.length - 1) / 2] : (dix[dix.length / 2 - 1] + dix[dix.length / 2]) / 2;
  return { releves: tous, valeur: +m.toFixed(2) };
}

/** Débit réel d'un audio maître (mots prononcés par seconde de parole, du premier au dernier mot). */
export const debitMesure = (mots: MotHorodate[]): number | null => motsParSecondeMesures(mots);

/** Horodatage réel par segment, dans l'ordre des segments donné (segment absent : null). */
export function horodatageDesSegments(ordre: string[], temps: TempsSegment[]): ({ debutSec: number; finSec: number } | null)[] {
  const parId = new Map(temps.map((t) => [t.segmentId, t]));
  return ordre.map((id) => {
    const t = parId.get(id);
    return t ? { debutSec: t.debutSec, finSec: t.finSec } : null;
  });
}
