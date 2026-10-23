/**
 * TEMPS DU FACE CAMÉRA : prise d'origine ↔ vidéo montée (plan facecam v4, lot D). PUR.
 *
 * La prise d'origine n'est jamais modifiée : les coupes sont des intervalles DANS LA PRISE. Les passages posés par le
 * monteur gardent leur ancre dans la prise (`ancre`) ; leurs temps dans la vidéo montée se recalculent à chaque coupe
 * rétablie ou ajoutée, sans rien demander à Claude.
 */
import type { CoupeFacecam, EntreesFacecam } from "@/domaine/facecam";
import type { MotHorodate } from "@/domaine/types";

export interface Intervalle {
  debutSec: number;
  finSec: number;
}

/** Coupe demandée par Will (« coupe ce passage »), dans la prise d'origine. */
export interface CoupeDemandee extends Intervalle {
  id: string;
  consigneId?: string;
}

/** Coupes en vigueur (studio, moins les rétablies, plus les demandées), fusionnées et triées, dans la prise. */
export function coupesActives(facecam: Pick<EntreesFacecam, "coupes">, demandees: CoupeDemandee[] = []): Intervalle[] {
  const retablies = new Set(facecam.coupes.retablies);
  const toutes: Intervalle[] = [
    ...facecam.coupes.auto.filter((c) => !retablies.has(c.id)),
    ...demandees,
  ]
    .filter((c) => Number.isFinite(c.debutSec) && Number.isFinite(c.finSec) && c.finSec > c.debutSec)
    .map((c) => ({ debutSec: c.debutSec, finSec: c.finSec }))
    .sort((a, b) => a.debutSec - b.debutSec);
  const fusion: Intervalle[] = [];
  for (const c of toutes) {
    const der = fusion[fusion.length - 1];
    if (der && c.debutSec <= der.finSec) der.finSec = Math.max(der.finSec, c.finSec);
    else fusion.push({ ...c });
  }
  return fusion;
}

/** Instant de la prise → instant de la vidéo montée. Dans une coupe : le raccord (début de la coupe, côté monté). */
export function priseVersMontee(sec: number, coupes: Intervalle[]): number {
  let retire = 0;
  for (const c of coupes) {
    if (c.debutSec >= sec) break;
    if (sec < c.finSec) return Math.max(0, c.debutSec - retire);
    retire += c.finSec - c.debutSec;
  }
  return Math.max(0, sec - retire);
}

/** Instant de la vidéo montée → instant de la prise (côté gauche d'un raccord). */
export function monteeVersPrise(sec: number, coupes: Intervalle[]): number {
  let t = sec;
  for (const c of coupes) {
    if (c.debutSec > t) break;
    t += c.finSec - c.debutSec;
  }
  return t;
}

export function estCoupe(sec: number, coupes: Intervalle[]): boolean {
  return coupes.some((c) => sec >= c.debutSec && sec < c.finSec);
}

export function dureeMontee(dureePriseSec: number, coupes: Intervalle[]): number {
  return Math.max(0, priseVersMontee(dureePriseSec, coupes.filter((c) => c.debutSec < dureePriseSec).map((c) => ({ debutSec: c.debutSec, finSec: Math.min(c.finSec, dureePriseSec) }))));
}

/** « 2:11 » (minutes:secondes, arrondi à la seconde). */
export function horloge(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const LIBELLES_COUPE: Record<CoupeFacecam["type"], [string, string]> = {
  debut: ["début à jeter", "débuts à jeter"],
  fin: ["fin à jeter", "fins à jeter"],
  reprise: ["phrase reprise", "phrases reprises"],
  silence: ["silence", "silences"],
  hesitation: ["hésitation", "hésitations"],
  consigne: ["consigne au monteur", "consignes au monteur"],
};

export interface ResumeCoupes {
  /** Passages retirés (coupes du studio non rétablies + coupes demandées). */
  nombre: number;
  avantSec: number;
  apresSec: number;
  /** « 3 passages retirés · 2:11 → 1:34 ». */
  phrase: string;
  /** Détail par sorte (« 2 phrases reprises », « 1 début à jeter »), dans l'ordre de la prise. */
  details: string[];
}

/** Résumé montré sous le lecteur de « Votre vidéo ». */
export function resumerCoupes(facecam: Pick<EntreesFacecam, "coupes">, dureePriseSec: number, demandees: CoupeDemandee[] = []): ResumeCoupes {
  const retablies = new Set(facecam.coupes.retablies);
  const gardees = facecam.coupes.auto.filter((c) => !retablies.has(c.id));
  const nombre = gardees.length + demandees.length;
  const apresSec = dureeMontee(dureePriseSec, coupesActives(facecam, demandees));
  const parType = new Map<CoupeFacecam["type"], number>();
  for (const c of gardees) parType.set(c.type, (parType.get(c.type) ?? 0) + 1);
  const details = [...parType.entries()].map(([t, n]) => `${n} ${LIBELLES_COUPE[t][n > 1 ? 1 : 0]}`);
  if (demandees.length) details.push(`${demandees.length} ${demandees.length > 1 ? "passages coupés à votre demande" : "passage coupé à votre demande"}`);
  const phrase = nombre === 0 ? `Rien n'a été retiré · ${horloge(dureePriseSec)}` : `${nombre} ${nombre > 1 ? "passages retirés" : "passage retiré"} · ${horloge(dureePriseSec)} → ${horloge(apresSec)}`;
  return { nombre, avantSec: dureePriseSec, apresSec, phrase, details };
}

/** Mot de la transcription (prise d'origine) vu par le monteur : index, temps monté (null si coupé). */
export interface MotMonteur {
  index: number;
  mot: string;
  debutPriseSec: number;
  finPriseSec: number;
  /** Null : le mot est dans un passage retiré. */
  monteeSec: number | null;
}

export function motsPourMonteur(mots: MotHorodate[], coupes: Intervalle[]): MotMonteur[] {
  return mots.map((m, index) => ({
    index,
    mot: m.mot,
    debutPriseSec: m.debutSec,
    finPriseSec: m.finSec,
    monteeSec: estCoupe((m.debutSec + m.finSec) / 2, coupes) ? null : priseVersMontee(m.debutSec, coupes),
  }));
}
