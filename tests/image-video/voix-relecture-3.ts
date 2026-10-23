/**
 * Voix synthétique de la 3e relecture de #283 (générateur du relecteur, reproduit d'après sa description ; ses fichiers
 * ont été supprimés). Indépendant de `voix-bruitee.ts` et de `voixRealiste` :
 *  - bruit de fond, un type par voix (en rotation) : ronflement tonal de 100 à 200 Hz (5 harmoniques, modulé) avec un
 *    peu de blanc ; souffle haute fréquence (blanc passe-haut 3 kHz) ; rose ; brun avec souffle HF ;
 *  - voix de −32 à −22 dB (RMS des voyelles), ±3 dB par mot ;
 *  - 20 % de mots très courts (60 à 120 ms) : voyelle isolée ouverte (« a ») ou fermée (« y ») ;
 *  - les autres de 1 à 3 syllabes, avec des fricatives « s » (passe-haut 4 kHz) ou « ch » (bande 2,8 kHz) de 70 à
 *    200 ms, de 3 à 12 dB sous la voyelle, en début, au milieu et en fin de mot ; occlusives initiales, internes et
 *    finales : creux de 30 à 110 ms puis explosion ;
 *  - pauses : 30 % enchaînées, 25 % de 40 à 100 ms, le reste de 100 à 350 ms ; 250 à 580 ms entre phrases ;
 *    respirations (bande 1,5 kHz, bruit + 6 à 16 dB) dans 45 % des pauses entre phrases, collées au mot dans 30 % des cas ;
 *  - horodatages décalés par phrase dans ±0,25 s, plus ±0,03 s par mot (bornés à ±0,25 s).
 * Voyelles : synthèse à formants (train d'impulsions à f0, pente glottale, trois résonateurs). Vérité rendue : le niveau
 * du son des mots seuls (voyelles, fricatives, explosions ; sans bruit ni respiration) par pas de 10 ms.
 */
import type { MotHorodate } from "@/domaine/types";
import { REGLES_COUPES_IV, REGLES_SILENCES_IV, couperVoixIV, silencesIV } from "@/moteurs/montage-image-video/assemblage";
import type { Son } from "@/moteurs/montage-image-video/emprunts";
import { hasard } from "./voix-bruitee";

export const F_R3 = 16000;
export const PAS_R3 = 0.01;

export type TypeBruitR3 = "ronflement" | "souffle-hf" | "rose" | "brun-souffle";
export const TYPES_BRUIT_R3: readonly TypeBruitR3[] = ["ronflement", "souffle-hf", "rose", "brun-souffle"];

export type GenreMotR3 = "a" | "y" | "mot";

export interface VraiMotR3 {
  mot: string;
  genre: GenreMotR3;
  debutSec: number;
  finSec: number;
  /** Fricatives du mot : [début, fin, place]. */
  fricatives: [number, number, "debut" | "milieu" | "fin"][];
}

export interface VoixR3 {
  son: Son;
  dureeSec: number;
  bruitDb: number;
  typeBruit: TypeBruitR3;
  voixDb: number;
  vrais: VraiMotR3[];
  mots: MotHorodate[];
  respirations: [number, number][];
  /** Niveau (dB) du son des mots seuls, par pas de 10 ms. */
  verite: Float32Array;
}

export interface OptionsR3 {
  phrases: number;
  decalageMaxSec: number;
  teteSec: [number, number];
  queueSec: [number, number];
  bruitDb: number;
  typeBruit: TypeBruitR3;
  /** Niveau de la voix (dB) ; sinon tiré de −32 à −22 dB. */
  voixDb?: number;
  /** Premier mot imposé (graines-types). */
  premierMot?: GenreMotR3;
}

const rmsDe = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length));

/** Biquad RBJ (passe-bas, passe-haut, passe-bande à gain 0 dB au centre), appliqué en place. */
function biquad(x: Float32Array, genre: "pb" | "ph" | "bande", f: number, q: number): Float32Array {
  const w = (2 * Math.PI * f) / F_R3;
  const c = Math.cos(w);
  const al = Math.sin(w) / (2 * q);
  const [b0, b1, b2] = genre === "pb" ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : genre === "ph" ? [(1 + c) / 2, -(1 + c), (1 + c) / 2] : [al, 0, -al];
  const [a0, a1, a2] = [1 + al, -2 * c, 1 - al];
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    [x2, x1, y2, y1] = [x1, x[i], y1, y];
    x[i] = y;
  }
  return x;
}

const blanc = (n: number, r: () => number) => Float32Array.from({ length: n }, () => r() * 2 - 1);
const normer = (x: Float32Array, db: number) => {
  const k = 10 ** (db / 20) / (rmsDe(x) || 1);
  for (let i = 0; i < x.length; i++) x[i] *= k;
  return x;
};

function bruitDeFond(type: TypeBruitR3, n: number, r: () => number): Float32Array {
  if (type === "ronflement") {
    const f = 100 + 100 * r();
    const ph = Array.from({ length: 5 }, () => r() * 2 * Math.PI);
    const fm = 0.3 + 1.7 * r();
    const pm = r() * 2 * Math.PI;
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / F_R3;
      let s = 0;
      for (let h = 1; h <= 5; h++) s += Math.sin(2 * Math.PI * h * f * t + ph[h - 1]) / h;
      x[i] = s * (1 + 0.3 * Math.sin(2 * Math.PI * fm * t + pm));
    }
    normer(x, 0);
    const b = normer(blanc(n, r), -14);
    for (let i = 0; i < n; i++) x[i] += b[i];
    return x;
  }
  if (type === "souffle-hf") return biquad(biquad(blanc(n, r), "ph", 3000, 0.707), "ph", 3000, 0.707);
  if (type === "rose") {
    const x = new Float32Array(n);
    let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      x[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
    return x;
  }
  const x = new Float32Array(n);
  let brun = 0;
  for (let i = 0; i < n; i++) x[i] = brun = 0.997 * brun + 0.05 * (r() * 2 - 1);
  normer(x, 0);
  const hf = normer(biquad(blanc(n, r), "ph", 3000, 0.707), -6);
  for (let i = 0; i < n; i++) x[i] += hf[i];
  return x;
}

/** Formants (Hz) et largeurs de bande : « a » ouvert, « y » fermé, et deux voyelles moyennes. */
const VOYELLES: Record<string, [number, number][]> = {
  a: [
    [750, 90],
    [1200, 110],
    [2600, 160],
  ],
  y: [
    [300, 120],
    [2000, 90],
    [2400, 120],
  ],
  e: [
    [450, 70],
    [1900, 120],
    [2500, 160],
  ],
  o: [
    [480, 70],
    [900, 90],
    [2400, 160],
  ],
};

/** Voyelle de `n` échantillons : impulsions à f0 (vibrato léger), pente glottale, trois résonateurs, enveloppe. */
function voyelle(n: number, nom: string, f0: number, r: () => number): Float32Array {
  const x = new Float32Array(n);
  let ph = r();
  for (let i = 0; i < n; i++) {
    const f = f0 * (1 + 0.015 * Math.sin((2 * Math.PI * 5 * i) / F_R3));
    ph += f / F_R3;
    if (ph >= 1) {
      ph -= 1;
      x[i] = 1;
    }
  }
  // Pente glottale : deux pôles réels.
  for (const p of [0.8]) {
    let y = 0;
    for (let i = 0; i < n; i++) x[i] = y = p * y + x[i];
  }
  for (const [f, bw] of VOYELLES[nom]) {
    const rr = Math.exp((-Math.PI * bw) / F_R3);
    const a1 = 2 * rr * Math.cos((2 * Math.PI * f) / F_R3);
    const a2 = -rr * rr;
    let [y1, y2] = [0, 0];
    for (let i = 0; i < n; i++) {
      const y = (1 - rr) * x[i] + a1 * y1 + a2 * y2;
      [y2, y1] = [y1, y];
      x[i] = y;
    }
  }
  // Légère aspiration (bruit) dans la voyelle.
  const rmsV = rmsDe(x);
  for (let i = 0; i < n; i++) x[i] += 0.03 * rmsV * (r() * 2 - 1);
  return x;
}

function enveloppe(x: Float32Array, attSec: number, fonduSec: number) {
  const na = Math.max(1, Math.round(attSec * F_R3));
  const nf = Math.max(1, Math.round(fonduSec * F_R3));
  for (let i = 0; i < x.length; i++) x[i] *= Math.min(1, i / na) * Math.min(1, (x.length - i) / nf);
  return x;
}

export function voixR3(graine: number, o: OptionsR3): VoixR3 {
  const r = hasard(graine);
  const entre = (a: number, b: number) => a + r() * (b - a);
  const voixDb = o.voixDb ?? entre(-32, -22);
  const f0 = entre(95, 220);
  // Segments sonores : [début, fin, genre, niveau (dB), voyelle].
  type Seg = { a: number; b: number; genre: "voyelle" | "s" | "ch" | "explosion"; db: number; v?: string };
  const segs: Seg[] = [];
  const vrais: VraiMotR3[] = [];
  const mots: MotHorodate[] = [];
  const respirations: [number, number][] = [];
  const souffles: { a: number; b: number; db: number }[] = [];
  let t = entre(o.teteSec[0], o.teteSec[1]);
  let n = 0;
  let dernierDebutH = 0;
  for (let p = 0; p < o.phrases; p++) {
    const nb = 4 + Math.floor(r() * 6);
    const decPhrase = entre(-o.decalageMaxSec, o.decalageMaxSec);
    for (let k = 0; k < nb; k++) {
      const db = voixDb + entre(-3, 3);
      const a = t;
      const fricatives: VraiMotR3["fricatives"] = [];
      const imposé = p === 0 && k === 0 ? o.premierMot : undefined;
      const court = imposé ? imposé !== "mot" : r() < 0.2;
      let genre: GenreMotR3 = "mot";
      if (court) {
        genre = imposé && imposé !== "mot" ? imposé : r() < 0.5 ? "a" : "y";
        const d = entre(0.06, 0.12);
        segs.push({ a: t, b: t + d, genre: "voyelle", db, v: genre });
        t += d;
      } else {
        const syll = 1 + Math.floor(r() * 3);
        const fric = (place: "debut" | "milieu" | "fin") => {
          const d = entre(0.07, 0.2);
          segs.push({ a: t, b: t + d, genre: r() < 0.5 ? "s" : "ch", db: db - entre(3, 12) });
          fricatives.push([+t.toFixed(4), +(t + d).toFixed(4), place]);
          t += d;
        };
        const occlusive = () => {
          t += entre(0.03, 0.11);
          const d = entre(0.01, 0.025);
          segs.push({ a: t, b: t + d, genre: "explosion", db: db - entre(0, 6) });
          t += d;
        };
        for (let s = 0; s < syll; s++) {
          const u = r();
          if (u < 0.3) fric(s === 0 ? "debut" : "milieu");
          else if (u < 0.55) occlusive();
          const d = entre(0.08, 0.2);
          segs.push({ a: t, b: t + d, genre: "voyelle", db, v: ["a", "y", "e", "o"][Math.floor(r() * 4)] });
          t += d;
        }
        const u = r();
        if (u < 0.25) fric("fin");
        else if (u < 0.45) occlusive();
      }
      const b = t;
      const fin = k === nb - 1 ? "." : "";
      const mot = `m${++n}${fin}`;
      vrais.push({ mot, genre, debutSec: +a.toFixed(4), finSec: +b.toFixed(4), fricatives });
      const borne = (d: number) => Math.max(-o.decalageMaxSec, Math.min(o.decalageMaxSec, d));
      const debutH = Math.max(dernierDebutH, Math.max(0, +(a + borne(decPhrase + entre(-0.03, 0.03))).toFixed(3)));
      dernierDebutH = debutH;
      mots.push({ mot, debutSec: debutH, finSec: Math.max(debutH + 0.03, +(b + borne(decPhrase + entre(-0.03, 0.03))).toFixed(3)) });
      if (k === nb - 1) {
        if (p === o.phrases - 1) break;
        const pause = entre(0.25, 0.58);
        if (r() < 0.45) {
          const lg = Math.min(entre(0.15, 0.4), pause - 0.06);
          const u = r();
          // Collée au mot dans 30 % des cas (à la fin du mot ou au début du suivant), sinon quelque part dans la pause.
          const ra = u < 0.15 ? t : u < 0.3 ? t + pause - lg : t + 0.03 + r() * (pause - lg - 0.06);
          respirations.push([+ra.toFixed(4), +(ra + lg).toFixed(4)]);
          souffles.push({ a: ra, b: ra + lg, db: o.bruitDb + entre(6, 16) });
        }
        t += pause;
      } else {
        const u = r();
        t += u < 0.3 ? 0 : u < 0.55 ? entre(0.04, 0.1) : entre(0.1, 0.35);
      }
    }
  }
  const dureeSec = +(t + entre(o.queueSec[0], o.queueSec[1])).toFixed(3);
  const N = Math.round(dureeSec * F_R3);
  const rb = hasard(graine * 7 + 3);
  const e = normer(bruitDeFond(o.typeBruit, N, rb), o.bruitDb);

  const mots0 = new Float32Array(N);
  const rv = hasard(graine * 13 + 11);
  for (const s of segs) {
    const a = Math.round(s.a * F_R3);
    const nS = Math.min(N, Math.round(s.b * F_R3)) - a;
    if (nS <= 0) continue;
    let x: Float32Array;
    if (s.genre === "voyelle") x = enveloppe(voyelle(nS, s.v!, f0, rv), 0.008 + 0.007 * rv(), Math.min(0.02 + 0.02 * rv(), (s.b - s.a) / 3));
    else if (s.genre === "s") x = enveloppe(biquad(biquad(blanc(nS, rv), "ph", 4000, 0.707), "ph", 4000, 0.707), 0.015, 0.015);
    else if (s.genre === "ch") x = enveloppe(biquad(blanc(nS, rv), "bande", 2800, 2), 0.015, 0.015);
    else x = Float32Array.from(blanc(nS, rv), (v, i) => v * Math.exp((-i / F_R3) * 120));
    normer(x, s.db);
    for (let i = 0; i < nS; i++) mots0[a + i] += x[i];
  }
  for (let i = 0; i < N; i++) e[i] += mots0[i];
  for (const s of souffles) {
    const a = Math.round(s.a * F_R3);
    const nS = Math.min(N - a, Math.round((s.b - s.a) * F_R3));
    const x = biquad(blanc(nS, rv), "bande", 1500, 1.2);
    // Montée lente, descente plus rapide.
    for (let i = 0; i < nS; i++) x[i] *= Math.sin((Math.PI / 2) * Math.min(1, i / (0.6 * nS))) * Math.min(1, (nS - i) / (0.25 * nS));
    normer(x, s.db);
    for (let i = 0; i < nS; i++) e[a + i] += x[i];
  }
  const pas = Math.round(PAS_R3 * F_R3);
  const verite = new Float32Array(Math.ceil(N / pas));
  for (let w = 0; w < verite.length; w++) verite[w] = 20 * Math.log10(rmsDe(mots0.subarray(w * pas, Math.min(N, (w + 1) * pas))) + 1e-12);
  return { son: { echantillons: e, frequence: F_R3 }, dureeSec, bruitDb: o.bruitDb, typeBruit: o.typeBruit, voixDb, vrais, mots, respirations, verite };
}

/** Son audible de la vérité (mots seuls à `surBruitDb` au moins au-dessus du bruit) dans `[a, b]`, en secondes. */
export function audibleR3(v: VoixR3, a: number, b: number, surBruitDb = 3): number {
  let s = 0;
  for (let w = Math.max(0, Math.floor(a / PAS_R3)); w < v.verite.length && w * PAS_R3 < b; w++) {
    if (v.verite[w] < v.bruitDb + surBruitDb) continue;
    s += Math.max(0, Math.min(b, (w + 1) * PAS_R3) - Math.max(a, w * PAS_R3));
  }
  return s;
}

/* Vérité de la relecture : chaque version ACCEPTÉE est comparée au son des mots seuls. */

/** Bord d'attaque ou de fondu (s) toléré. */
export const BORD_SEC = 0.02;

export const corpsR3 = (bruitDb: number, typeBruit: TypeBruitR3, o: Partial<OptionsR3> = {}): OptionsR3 => ({ phrases: 4, decalageMaxSec: 0.25, teteSec: [0.1, 0.4], queueSec: [0.3, 0.7], bruitDb, typeBruit, ...o });
export const finR3 = (bruitDb: number, typeBruit: TypeBruitR3, voixDb: number): OptionsR3 => ({ phrases: 1, decalageMaxSec: 0.25, teteSec: [0.06, 0.35], queueSec: [0.25, 0.6], bruitDb, typeBruit, voixDb });

export function couperR3(c: VoixR3, f?: VoixR3) {
  const corps = silencesIV(c.son);
  const fin = f ? silencesIV(f.son, REGLES_SILENCES_IV, corps.plancherDb) : undefined;
  const r = couperVoixIV({ mots: c.mots, dureeSec: c.dureeSec }, f ? { mots: f.mots, dureeSec: f.dureeSec } : undefined, { corps, ...(fin ? { fin } : {}) });
  return { refusee: r.hors.length > 0 || r.paroleRetiree.length > 0, plan: r.plan, mesures: { corps, fin } };
}

export function verdictR3(c: VoixR3, f?: VoixR3): { refusee: boolean; defauts: string[] } {
  const { refusee, plan, mesures } = couperR3(c, f);
  const defauts: string[] = [];
  if (refusee) return { refusee, defauts };
  for (const [source, v, m] of [
    [0, c, mesures.corps],
    [1, f, mesures.fin],
  ] as const) {
    if (!v || !m) continue;
    const nom = source ? "fin" : "corps";
    const ms = plan.morceaux.filter((x) => !x.silence && x.source === source);
    ms.forEach((x, i) => {
      if (x.finSec - x.debutSec < REGLES_COUPES_IV.dureeMinMorceauSec - 1e-6) defauts.push(`${nom} : morceau ${x.debutSec} → ${x.finSec} trop court`);
      if (i && x.debutSec < ms[i - 1].finSec + 1e-6) defauts.push(`${nom} : morceaux ${i - 1} et ${i} se chevauchent ou se touchent`);
      for (const t of [x.debutSec, x.finSec]) {
        if (t <= 0.001 || t >= v.dureeSec - 0.001) continue;
        if (!m.silences.some((s) => t >= s.debutSec - 1e-6 && t <= s.finSec + 1e-6)) defauts.push(`${nom} : coupe ${t} hors silence`);
        if (audibleR3(v, t - 0.01, t) > 0 && audibleR3(v, t, t + 0.01) > 0) defauts.push(`${nom} : coupe ${t} dans un son`);
      }
    });
    const retires: [number, number][] = [[0, ms[0].debutSec], ...ms.slice(1).map((x, i): [number, number] => [ms[i].finSec, x.debutSec]), [ms[ms.length - 1].finSec, v.dureeSec]];
    for (const [a, b] of retires) {
      const p = audibleR3(v, a, b);
      if (p > BORD_SEC + 1e-6) defauts.push(`${nom} : ${a} → ${b} retiré, ${p.toFixed(3)} s de son`);
    }
    v.vrais.forEach((w, k) => {
      const p = retires.reduce((s, [a, b]) => s + audibleR3(v, Math.max(a, w.debutSec), Math.min(b, w.finSec)), 0);
      if (p > BORD_SEC + 1e-6) defauts.push(`${nom} : ${k === 0 ? "PREMIER " : ""}mot ${w.mot} « ${w.genre} » (${w.debutSec} → ${w.finSec}) amputé de ${p.toFixed(3)} s`);
    });
  }
  return { refusee, defauts };
}


/** Mot d'un scénario imposé : voyelles enchaînées à partir de `debutSec`, horodatage décalé de `decalageSec`. */
export interface MotScenarioR3 {
  debutSec: number;
  voyelles: [string, number][];
  decalageSec: number;
  /** Niveau (dB) ; sinon celui de la voix. */
  db?: number;
}

/**
 * Voix à mots imposés (relecture #283, 4e passage) : même bruit, mêmes voyelles et même vérité que `voixR3`, mais les
 * mots, leurs durées et l'erreur de leurs horodatages sont fixés (pas de tirage), pour viser un cas précis.
 */
export function voixScenarioR3(
  graine: number,
  o: { bruitDb: number; typeBruit: TypeBruitR3; voixDb: number; dureeSec: number; f0?: number; mots: MotScenarioR3[]; respirations?: [number, number, number][] },
): VoixR3 {
  const N = Math.round(o.dureeSec * F_R3);
  const e = normer(bruitDeFond(o.typeBruit, N, hasard(graine * 7 + 3)), o.bruitDb);
  const mots0 = new Float32Array(N);
  const rv = hasard(graine * 13 + 11);
  const vrais: VraiMotR3[] = [];
  const mots: MotHorodate[] = [];
  let dernierDebutH = 0;
  o.mots.forEach((m, k) => {
    let t = m.debutSec;
    for (const [v, d] of m.voyelles) {
      const a = Math.round(t * F_R3);
      const nS = Math.min(N, Math.round((t + d) * F_R3)) - a;
      const x = normer(enveloppe(voyelle(nS, v, o.f0 ?? 140, rv), 0.008, Math.min(0.02, d / 3)), m.db ?? o.voixDb);
      for (let i = 0; i < nS; i++) mots0[a + i] += x[i];
      t += d;
    }
    const mot = `m${k + 1}${k === o.mots.length - 1 ? "." : ""}`;
    vrais.push({ mot, genre: m.voyelles.length === 1 ? (m.voyelles[0][0] === "y" ? "y" : "a") : "mot", debutSec: +m.debutSec.toFixed(4), finSec: +t.toFixed(4), fricatives: [] });
    const debutH = Math.max(dernierDebutH, +Math.max(0, m.debutSec + m.decalageSec).toFixed(3));
    dernierDebutH = debutH;
    mots.push({ mot, debutSec: debutH, finSec: Math.max(debutH + 0.03, +(t + m.decalageSec).toFixed(3)) });
  });
  for (let i = 0; i < N; i++) e[i] += mots0[i];
  // Respirations [début, fin, niveau (dB)] : bande 1,5 kHz, montée lente et descente plus rapide (comme `voixR3`).
  for (const [ra, rb, db] of o.respirations ?? []) {
    const a = Math.round(ra * F_R3);
    const nS = Math.min(N - a, Math.round((rb - ra) * F_R3));
    const x = biquad(blanc(nS, rv), "bande", 1500, 1.2);
    for (let i = 0; i < nS; i++) x[i] *= Math.sin((Math.PI / 2) * Math.min(1, i / (0.6 * nS))) * Math.min(1, (nS - i) / (0.25 * nS));
    normer(x, db);
    for (let i = 0; i < nS; i++) e[a + i] += x[i];
  }
  const pas = Math.round(PAS_R3 * F_R3);
  const verite = new Float32Array(Math.ceil(N / pas));
  for (let w = 0; w < verite.length; w++) verite[w] = 20 * Math.log10(rmsDe(mots0.subarray(w * pas, Math.min(N, (w + 1) * pas))) + 1e-12);
  const respirations = (o.respirations ?? []).map(([a, b]): [number, number] => [a, b]);
  return { son: { echantillons: e, frequence: F_R3 }, dureeSec: o.dureeSec, bruitDb: o.bruitDb, typeBruit: o.typeBruit, voixDb: o.voixDb, vrais, mots, respirations, verite };
}
