/**
 * EFFET RÉALISTE PAR IA — LE BON ENDROIT (lot K). PUR.
 *
 * Claude choisit le moment dans son appel unique ; ce module le VÉRIFIE (et le choisit seul en version simple) :
 *  - le passage tient dans un seul morceau gardé (jamais à cheval sur une coupe : il est extrait de la prise) ;
 *  - jamais au milieu d'une phrase clé (accroche, conclusion, chiffre, « retenez ») : l'effet ne la couvre pas ;
 *  - de préférence quand Will parle de l'objet (« mon téléphone »), au début d'une phrase ou après une pause (geste
 *    naturel), sur un plan assez large pour voir la main (mesure injectée : part du plan large, main visible) ;
 *  - jamais sur un autre effet fort déjà posé.
 * Une ancre donnée par Will (« quand je dis X », « à 0:42 ») est respectée : le passage est seulement recalé pour tenir
 * dans le morceau gardé.
 */
import type { MotMonteur } from "@/briques/monteur/ancrage";
import { MOTS_DE_L_OBJET, normaliser } from "./demande";
import { DUREE_EFFET_MAX_SEC, DUREE_EFFET_MIN_SEC, type ObjetConnu, type TypeAncreEffet } from "./types";

export interface Intervalle {
  debutSec: number;
  finSec: number;
}

export interface OptionsMoment {
  dureeSec: number;
  objet: ObjetConnu;
  /** Part de plan large (main visible) autour d'un instant de la PRISE, de 0 à 1 ; absente : non mesurée. */
  largeurPlan?: (priseSec: number) => number;
  /** Effets forts déjà posés (temps de la vidéo livrée) : jamais deux à la fois. */
  occupes?: Intervalle[];
}

export interface MomentChoisi {
  debutMot: number;
  debutPriseSec: number;
  finPriseSec: number;
  debutSec: number;
  finSec: number;
  dureeSec: number;
  /** Phrase dite pendant le passage (aperçu). */
  phrase: string;
  /** Pourquoi ce moment, en mots simples. */
  raison: string;
  /** Vrai si le moment demandé (Claude ou Will) a dû être déplacé ou raccourci. */
  ajuste: boolean;
}

/** Avance du passage sur le mot : l'objet apparaît juste avant d'être nommé (s). */
export const AVANCE_SUR_LE_MOT_SEC = 0.3;
const PAUSE_SEC = 0.25;
const FIN_DE_PHRASE_SEC = 0.6;
const MARQUES_CLES = /\b(important|retenez|surtout|attention|essentiel|secret|cle|gratuit|abonnez|lien)\b/;

const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const bornerDureeEffet = (d: number | null | undefined) => borne(Number.isFinite(d as number) ? (d as number) : 5, DUREE_EFFET_MIN_SEC, DUREE_EFFET_MAX_SEC);

/** « 0:42 » */
export function formatInstant(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Segment {
  mots: MotMonteur[];
  /** Temps livré − temps de la prise sur ce morceau. */
  decalage: number;
  debut: number;
  fin: number;
}

/** Morceaux gardés : mots gardés consécutifs, sans coupe entre eux (même décalage prise → vidéo). */
export function segmentsGardes(mots: MotMonteur[]): Segment[] {
  const segments: Segment[] = [];
  let courant: Segment | null = null;
  for (const m of mots) {
    if (m.monteeSec === null) {
      courant = null;
      continue;
    }
    const decalage = m.monteeSec - m.debutPriseSec;
    if (courant && Math.abs(decalage - courant.decalage) < 0.05) {
      courant.mots.push(m);
      courant.fin = m.finPriseSec;
    } else {
      courant = { mots: [m], decalage, debut: m.debutPriseSec, fin: m.finPriseSec };
      segments.push(courant);
    }
  }
  return segments;
}

interface Phrase {
  premier: number;
  dernier: number;
  debut: number;
  fin: number;
  cle: boolean;
}

/** Phrases (ponctuation finale ou silence ≥ 0,6 s) ; les clés : accroche, conclusion, chiffres, mots d'insistance. */
export function phrasesDe(mots: MotMonteur[]): Phrase[] {
  const gardes = mots.filter((m) => m.monteeSec !== null);
  const phrases: Phrase[] = [];
  let debutI = 0;
  for (let i = 0; i < gardes.length; i++) {
    const m = gardes[i];
    const suivant = gardes[i + 1];
    const fin = /[.!?…]$/.test(m.mot) || !suivant || suivant.debutPriseSec - m.finPriseSec >= FIN_DE_PHRASE_SEC;
    if (fin) {
      const liste = gardes.slice(debutI, i + 1);
      const texte = normaliser(liste.map((x) => x.mot).join(" "));
      phrases.push({ premier: liste[0].index, dernier: m.index, debut: liste[0].debutPriseSec, fin: m.finPriseSec, cle: /\d/.test(texte) || MARQUES_CLES.test(texte) });
      debutI = i + 1;
    }
  }
  if (phrases.length) {
    phrases[0].cle = true; // l'accroche
    phrases[phrases.length - 1].cle = true; // la conclusion
  }
  return phrases;
}

function phraseDite(mots: MotMonteur[], debut: number, fin: number): string {
  const dits = mots.filter((m) => m.monteeSec !== null && m.finPriseSec > debut && m.debutPriseSec < fin).map((m) => m.mot);
  const texte = dits.slice(0, 24).join(" ");
  return dits.length > 24 ? `${texte} …` : texte;
}

/** Fenêtre de `duree` s qui commence juste avant le mot `m`, recalée dans son morceau gardé (raccourcie au besoin). */
function fenetre(m: MotMonteur, seg: Segment, duree: number): { debut: number; fin: number; duree: number; ajuste: boolean } | null {
  const place = seg.fin - seg.debut;
  if (place < DUREE_EFFET_MIN_SEC - 1e-6) return null;
  const d = Math.min(duree, place);
  let debut = Math.max(seg.debut, m.debutPriseSec - AVANCE_SUR_LE_MOT_SEC);
  let ajuste = d < duree - 1e-6;
  if (debut + d > seg.fin) {
    debut = seg.fin - d;
    ajuste = ajuste || m.debutPriseSec - debut > 1.5;
  }
  return { debut: +debut.toFixed(3), fin: +(debut + d).toFixed(3), duree: +d.toFixed(3), ajuste };
}

const chevauche = (a: Intervalle, b: Intervalle) => a.debutSec < b.finSec - 1e-6 && b.debutSec < a.finSec - 1e-6;

/** Le passage couvre-t-il l'INTÉRIEUR d'une phrase clé (il peut la précéder ou la suivre, pas la couper) ? */
function coupePhraseCle(debut: number, fin: number, phrases: Phrase[]): boolean {
  return phrases.some((p) => p.cle && debut < p.fin - 0.05 && fin > p.debut + 0.05);
}

/** Une phrase clé commence pendant le passage : il s'arrête juste avant elle s'il garde ses 3 s (sinon inchangé). */
function avantPhraseCle(f: NonNullable<ReturnType<typeof fenetre>>, phrases: Phrase[]): NonNullable<ReturnType<typeof fenetre>> {
  const suivante = phrases.find((p) => p.cle && p.debut > f.debut + 0.05 && p.debut < f.fin - 0.05);
  if (!suivante) return f;
  const fin = +(suivante.debut - 0.05).toFixed(3);
  return fin - f.debut >= DUREE_EFFET_MIN_SEC - 1e-6 ? { debut: f.debut, fin, duree: +(fin - f.debut).toFixed(3), ajuste: true } : f;
}

function construire(mots: MotMonteur[], m: MotMonteur, seg: Segment, f: NonNullable<ReturnType<typeof fenetre>>, raison: string, ajuste: boolean): MomentChoisi {
  return {
    debutMot: m.index,
    debutPriseSec: f.debut,
    finPriseSec: f.fin,
    debutSec: +(f.debut + seg.decalage).toFixed(3),
    finSec: +(f.fin + seg.decalage).toFixed(3),
    dureeSec: f.duree,
    phrase: phraseDite(mots, f.debut, f.fin),
    raison,
    ajuste: ajuste || f.ajuste,
  };
}

/** Le « bon endroit », choisi par le code (version simple, ou moment de Claude refusé). Null : vidéo trop courte. */
export function choisirBonEndroit(mots: MotMonteur[], o: OptionsMoment): MomentChoisi | null {
  const duree = bornerDureeEffet(o.dureeSec);
  const segments = segmentsGardes(mots);
  const phrases = phrasesDe(mots);
  const debutsDePhrase = new Set(phrases.map((p) => p.premier));
  const motsObjet = MOTS_DE_L_OBJET[o.objet];
  const nomme = (m: MotMonteur) => motsObjet.some((x) => normaliser(m.mot).replace(/[^a-z0-9]/g, "").startsWith(x.replace(/\s/g, "")));
  const total = Math.max(1, mots.length ? mots[mots.length - 1].finPriseSec : 1);
  type Candidat = { m: MotMonteur; seg: Segment; f: NonNullable<ReturnType<typeof fenetre>>; score: number; raisons: string[]; protege: boolean };
  const candidats: Candidat[] = [];

  for (const seg of segments) {
    seg.mots.forEach((m, i) => {
      const avant = seg.mots[i - 1];
      const apresPause = !avant || m.debutPriseSec - avant.finPriseSec >= PAUSE_SEC;
      const debutPhrase = debutsDePhrase.has(m.index);
      const parle = seg.mots.slice(i, i + 4).some(nomme);
      if (!debutPhrase && !apresPause && !parle) return;
      const brute = fenetre(m, seg, duree);
      if (!brute) return;
      const f = avantPhraseCle(brute, phrases);
      const livre = { debutSec: f.debut + seg.decalage, finSec: f.fin + seg.decalage };
      if ((o.occupes ?? []).some((x) => chevauche(x, livre))) return;
      const raisons: string[] = [];
      let score = 0;
      if (parle) {
        score += 4;
        raisons.push("vous parlez de l'objet à ce moment");
      } else if (seg.mots.some((x) => x.debutPriseSec >= f.debut && x.debutPriseSec < f.fin && nomme(x))) score += 2;
      if (debutPhrase) {
        score += 1.5;
        raisons.push("début de phrase");
      } else if (apresPause) {
        score += 0.5;
        raisons.push("après une pause");
      } else score -= 1;
      if (o.largeurPlan) {
        const echantillons = [0, 0.25, 0.5, 0.75, 1].map((k) => borne(o.largeurPlan!(f.debut + k * f.duree), 0, 1));
        const large = echantillons.reduce((a, b) => a + b, 0) / echantillons.length;
        score += 2 * large;
        if (large < 0.5) score -= 3;
        else raisons.push("plan assez large pour voir la main");
      }
      score -= f.ajuste ? 0.5 : 0;
      score -= (0.2 * (duree - f.duree)) / duree;
      score -= (0.3 * Math.abs((f.debut + f.fin) / 2 - 0.45 * total)) / total;
      candidats.push({ m, seg, f, score, raisons, protege: coupePhraseCle(f.debut, f.fin, phrases) });
    });
  }
  // Jamais au milieu d'une phrase clé, sauf s'il n'y a pas d'autre place.
  const libres = candidats.filter((c) => !c.protege);
  const liste = libres.length ? libres : candidats;
  if (!liste.length) {
    const seg = [...segments].sort((a, b) => b.fin - b.debut - (a.fin - a.debut))[0];
    const f = seg ? fenetre(seg.mots[0], seg, duree) : null;
    return seg && f ? construire(mots, seg.mots[0], seg, f, "le plus long passage sans coupe", true) : null;
  }
  const meilleur = liste.reduce((a, b) => (b.score > a.score + 1e-9 ? b : a));
  const raison = meilleur.raisons.length ? meilleur.raisons.join(", ") : "geste naturel, hors des phrases clés";
  return construire(mots, meilleur.m, meilleur.seg, meilleur.f, raison.charAt(0).toUpperCase() + raison.slice(1), false);
}

function segmentDuMot(segments: Segment[], index: number): { seg: Segment; m: MotMonteur } | null {
  for (const seg of segments) {
    const m = seg.mots.find((x) => x.index === index);
    if (m) return { seg, m };
  }
  return null;
}

/** Mot gardé le plus proche d'un index (le mot cité peut être dans un passage retiré). */
function motGardeProche(mots: MotMonteur[], index: number): MotMonteur | null {
  const gardes = mots.filter((m) => m.monteeSec !== null);
  if (!gardes.length) return null;
  return gardes.find((m) => m.index >= index) ?? gardes[gardes.length - 1];
}

/** Moment imposé par Will (mot ou instant de la vidéo livrée) : respecté, seulement recalé dans son morceau gardé. */
export function momentImpose(mots: MotMonteur[], ancre: { mot?: number; instantSec?: number }, o: OptionsMoment): MomentChoisi | null {
  const duree = bornerDureeEffet(o.dureeSec);
  const segments = segmentsGardes(mots);
  let m: MotMonteur | null = null;
  if (ancre.instantSec !== undefined) {
    const gardes = mots.filter((x) => x.monteeSec !== null);
    m = gardes.find((x) => (x.monteeSec ?? 0) >= ancre.instantSec! - 0.25) ?? gardes[gardes.length - 1] ?? null;
  } else if (ancre.mot !== undefined) m = motGardeProche(mots, ancre.mot);
  if (!m) return null;
  const trouve = segmentDuMot(segments, m.index);
  if (!trouve) return null;
  const f = fenetre(trouve.m, trouve.seg, duree);
  if (!f) return choisirBonEndroit(mots, o);
  return construire(mots, trouve.m, trouve.seg, f, ancre.instantSec !== undefined ? `À ${formatInstant(ancre.instantSec)}, comme demandé` : "Au mot demandé", false);
}

/**
 * Moment final : celui de Will s'il en a donné un ; sinon celui de Claude s'il respecte les règles ; sinon le bon
 * endroit choisi par le code.
 */
export function momentDeLEffet(
  mots: MotMonteur[],
  o: OptionsMoment & { ancre: TypeAncreEffet; motClaude?: number | null; raisonClaude?: string | null; motWill?: number; instantWill?: number },
): MomentChoisi | null {
  if (o.ancre === "instant" && o.instantWill !== undefined) return momentImpose(mots, { instantSec: o.instantWill }, o);
  if (o.ancre === "mot" && o.motWill !== undefined) return momentImpose(mots, { mot: o.motWill }, o);
  const duree = bornerDureeEffet(o.dureeSec);
  if (typeof o.motClaude === "number") {
    const segments = segmentsGardes(mots);
    const trouve = segmentDuMot(segments, Math.round(o.motClaude));
    const phrases = phrasesDe(mots);
    const brute = trouve ? fenetre(trouve.m, trouve.seg, duree) : null;
    const f = brute ? avantPhraseCle(brute, phrases) : null;
    if (trouve && f) {
      const livre = { debutSec: f.debut + trouve.seg.decalage, finSec: f.fin + trouve.seg.decalage };
      const occupe = (o.occupes ?? []).some((x) => chevauche(x, livre));
      const large = o.largeurPlan ? [0, 0.5, 1].map((k) => o.largeurPlan!(f.debut + k * f.duree)).reduce((a, b) => a + b, 0) / 3 : 1;
      // Raccourci pour finir avant une phrase clé : c'est encore le moment de Claude (non signalé comme déplacé).
      if (!occupe && !coupePhraseCle(f.debut, f.fin, phrases) && large >= 0.5) return construire(mots, trouve.m, trouve.seg, { ...f, ajuste: false }, o.raisonClaude?.trim().slice(0, 160) || "Moment choisi par le monteur", false);
    }
    const repli = choisirBonEndroit(mots, o);
    return repli ? { ...repli, ajuste: true } : null;
  }
  return choisirBonEndroit(mots, o);
}
