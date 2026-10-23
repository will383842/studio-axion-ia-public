/**
 * Voix synthétique BRUITÉE pour les coupes de l'assemblage (relecture #283, 2e passage) : générateur indépendant de
 * `voixRealiste` (coupes-en-plein-son.test.ts), sur le modèle décrit par la relecture :
 *  - bruit de fond brun + blanc + ronflement 50 Hz, tiré entre −46 et −38 dB (RMS) ;
 *  - mots de 0,09 à 0,65 s, de −28 à −10 dB (RMS), harmoniques, syllabes modulées, attaque et fondu ;
 *  - entre deux mots d'une phrase : 35 % enchaînés, 30 % très courts (40 à 80 ms), le reste de 80 à 300 ms ; 200 à
 *    550 ms entre deux phrases ; une respiration (−33 à −26 dB) dans 45 % des pauses entre phrases ;
 *  - occlusives : initiales (fermeture de 30 à 70 ms puis explosion), internes (40 à 90 ms), finales (fermeture de 60 à
 *    130 ms suivie d'une explosion) ; la fermeture est au bruit de fond ;
 *  - horodatages décalés par phrase jusqu'à ±`decalageMaxSec`, plus ±0,03 s par mot (bornés à ±`decalageMaxSec`).
 * Vérité rendue : les instants de chaque mot (fermetures comprises) et le masque « parole audible » (fenêtres de 10 ms
 * où le son du mot seul dépasse le bruit de fond), pour mesurer ce qu'un plan retire.
 */
import type { MotHorodate } from "@/domaine/types";
import type { Son } from "@/moteurs/montage-image-video/emprunts";

export const F_BRUITEE = 16000;
/** Pas du masque de parole (s). */
export const PAS_PAROLE = 0.01;

/** Hasard à graine fixe (Park-Miller). */
export function hasard(graine: number) {
  let g = (Math.abs(Math.floor(graine)) % 2147483646) + 1;
  // Premiers tirages d'une petite graine trop proches de 0 : écartés.
  for (let i = 0; i < 8; i++) g = (g * 48271) % 2147483647;
  return () => ((g = (g * 48271) % 2147483647) - 1) / 2147483646;
}

export interface VraiMotBruite {
  mot: string;
  debutSec: number;
  finSec: number;
  niveauDb: number;
}

export interface SonBruite {
  son: Son;
  dureeSec: number;
  bruitDb: number;
  vrais: VraiMotBruite[];
  mots: MotHorodate[];
  respirations: [number, number][];
  /** Par pas de 10 ms : niveau (dB) du son des mots seuls, sans bruit ni respiration. */
  parole: Float32Array;
}

export interface OptionsBruitee {
  phrases: number;
  decalageMaxSec: number;
  /** Blanc avant le premier mot (s). */
  teteSec: [number, number];
  /** Blanc après le dernier mot (s). */
  queueSec: [number, number];
  /** Niveau du bruit de fond imposé (dB) ; sinon tiré entre −46 et −38 dB. */
  bruitDb?: number;
}

const rmsDe = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length));

export function voixBruitee(graine: number, o: OptionsBruitee): SonBruite {
  const r = hasard(graine);
  const entre = (a: number, b: number) => a + r() * (b - a);
  const bruitDb = o.bruitDb ?? entre(-46, -38);
  interface Plan {
    a: number;
    b: number;
    niveau: number;
    fermetures: [number, number][];
    explosions: [number, number][];
  }
  const plans: Plan[] = [];
  const vrais: VraiMotBruite[] = [];
  const mots: MotHorodate[] = [];
  const respirations: [number, number][] = [];
  let t = entre(o.teteSec[0], o.teteSec[1]);
  let n = 0;
  let dernierDebutH = 0;
  for (let p = 0; p < o.phrases; p++) {
    const nb = 4 + Math.floor(r() * 6);
    const decPhrase = entre(-o.decalageMaxSec, o.decalageMaxSec);
    for (let k = 0; k < nb; k++) {
      const duree = 0.09 + 0.56 * r() ** 1.4;
      const a = t;
      const b = t + duree;
      const fermetures: [number, number][] = [];
      const explosions: [number, number][] = [];
      // Occlusive initiale : fermeture (bruit de fond) puis explosion, la voix suit.
      if (duree > 0.14 && r() < 0.25) {
        const lg = entre(0.03, 0.07);
        fermetures.push([a, a + lg]);
        explosions.push([a + lg, a + lg + 0.012]);
      }
      // Occlusive interne.
      if (duree > 0.28 && r() < 0.3) {
        const lg = entre(0.04, 0.09);
        const c = a + duree * entre(0.35, 0.6);
        fermetures.push([c, c + lg]);
        explosions.push([c + lg, c + lg + 0.01]);
      }
      // Occlusive finale : fermeture de 60 à 130 ms, explosion de 15 à 30 ms en fin de mot.
      if (duree > 0.22 && r() < 0.3) {
        const ex = entre(0.015, 0.03);
        const lg = Math.min(entre(0.06, 0.13), duree * 0.4);
        fermetures.push([b - ex - lg, b - ex]);
        explosions.push([b - ex, b]);
      }
      const niveau = entre(-28, -10);
      plans.push({ a, b, niveau, fermetures, explosions });
      const fin = k === nb - 1 ? "." : "";
      const mot = `m${++n}${fin}`;
      vrais.push({ mot, debutSec: +a.toFixed(4), finSec: +b.toFixed(4), niveauDb: niveau });
      const borne = (d: number) => Math.max(-o.decalageMaxSec, Math.min(o.decalageMaxSec, d));
      const d1 = borne(decPhrase + entre(-0.03, 0.03));
      const d2 = borne(decPhrase + entre(-0.03, 0.03));
      const debutH = Math.max(dernierDebutH, Math.max(0, +(a + d1).toFixed(3)));
      dernierDebutH = debutH;
      mots.push({ mot, debutSec: debutH, finSec: Math.max(debutH + 0.03, +(b + d2).toFixed(3)) });
      t = b;
      if (k === nb - 1) {
        if (p === o.phrases - 1) break;
        const pause = entre(0.2, 0.55);
        if (r() < 0.45) {
          const lg = Math.min(entre(0.12, 0.35), pause - 0.06);
          const ra = t + r() * (pause - lg);
          respirations.push([+ra.toFixed(4), +(ra + lg).toFixed(4)]);
        }
        t += pause;
      } else {
        const u = r();
        t += u < 0.35 ? 0 : u < 0.65 ? entre(0.04, 0.08) : entre(0.08, 0.3);
      }
    }
  }
  const dureeSec = +(t + entre(o.queueSec[0], o.queueSec[1])).toFixed(3);
  const N = Math.round(dureeSec * F_BRUITEE);
  const e = new Float32Array(N);

  // Bruit de fond : brun (blanc intégré, fuite pour rester centré) + blanc + 50 Hz, ramené au niveau tiré.
  const rb = hasard(graine * 7 + 1);
  const bruit = new Float32Array(N);
  let brun = 0;
  const phase50 = rb() * 2 * Math.PI;
  for (let i = 0; i < N; i++) {
    const w = rb() * 2 - 1;
    brun = 0.995 * brun + 0.06 * w;
    bruit[i] = brun + 0.35 * (rb() * 2 - 1) + 0.12 * Math.sin(2 * Math.PI * 50 * (i / F_BRUITEE) + phase50);
  }
  const kb = 10 ** (bruitDb / 20) / rmsDe(bruit);
  for (let i = 0; i < N; i++) e[i] = bruit[i] * kb;

  // Mots (seuls, pour le masque de parole).
  const mots0 = new Float32Array(N);
  const rv = hasard(graine * 13 + 5);
  plans.forEach((m) => {
    const a = Math.round(m.a * F_BRUITEE);
    const b = Math.min(N, Math.round(m.b * F_BRUITEE));
    const f0 = 95 + rv() * 120;
    const att = 0.008 + rv() * 0.007;
    const fondu = Math.min(0.025 + rv() * 0.035, (m.b - m.a) / 3);
    const rythme = 3.5 + rv() * 2.5;
    const ph = rv() * 2 * Math.PI;
    const x = new Float32Array(b - a);
    for (let i = 0; i < x.length; i++) {
      const s = i / F_BRUITEE;
      const env = Math.min(1, s / att) * Math.min(1, Math.max(0, (m.b - m.a - s) / fondu)) * (0.72 + 0.28 * Math.sin(2 * Math.PI * rythme * s + ph));
      const w = 2 * Math.PI * f0 * s * (1 + 0.02 * Math.sin(2 * Math.PI * 5 * s));
      x[i] = env * (Math.sin(w) + 0.5 * Math.sin(2 * w) + 0.3 * Math.sin(3 * w) + 0.15 * Math.sin(4 * w) + 0.08 * (rv() * 2 - 1));
    }
    const indices = ([u, v]: [number, number]) => [Math.max(0, Math.round((u - m.a) * F_BRUITEE)), Math.min(x.length, Math.round((v - m.a) * F_BRUITEE))];
    for (const f of m.fermetures) x.fill(0, ...indices(f));
    for (const ex of m.explosions) {
      const [u, v] = indices(ex);
      for (let i = u; i < v; i++) x[i] = 0.9 * (rv() * 2 - 1) * Math.exp(-((i - u) / F_BRUITEE) * 60);
    }
    const k = 10 ** (m.niveau / 20) / rmsDe(x);
    for (let i = 0; i < x.length; i++) mots0[a + i] += x[i] * k;
  });
  for (let i = 0; i < N; i++) e[i] += mots0[i];

  // Respirations : bruit filtré, enveloppe en sinus, −33 à −26 dB.
  for (const [ra, rb2] of respirations) {
    const a = Math.round(ra * F_BRUITEE);
    const n2 = Math.min(N - a, Math.round((rb2 - ra) * F_BRUITEE));
    let y = 0;
    const x = Float32Array.from({ length: n2 }, (_, i) => ((y = 0.6 * y + 0.4 * (rv() * 2 - 1)), y * Math.sin((Math.PI * i) / n2)));
    const k = 10 ** (entre(-33, -26) / 20) / rmsDe(x);
    for (let i = 0; i < n2; i++) e[a + i] += x[i] * k;
  }

  // Niveau des mots seuls par pas de 10 ms (la vérité : ce qui est de la parole, quel que soit le bruit).
  const pas = Math.round(PAS_PAROLE * F_BRUITEE);
  const parole = new Float32Array(Math.ceil(N / pas));
  for (let w = 0; w < parole.length; w++) parole[w] = 20 * Math.log10(rmsDe(mots0.subarray(w * pas, Math.min(N, (w + 1) * pas))) + 1e-12);
  return { son: { echantillons: e, frequence: F_BRUITEE }, dureeSec, bruitDb, vrais, mots, respirations, parole };
}

/** Parole (s) dans `[a, b]` : pas de 10 ms où les mots seuls dépassent le bruit de fond de `surBruitDb` (0 : audible). */
export function paroleDans(v: SonBruite, a: number, b: number, surBruitDb = 0): number {
  let s = 0;
  for (let w = Math.max(0, Math.floor(a / PAS_PAROLE)); w < v.parole.length && w * PAS_PAROLE < b; w++) {
    if (v.parole[w] <= v.bruitDb + surBruitDb) continue;
    s += Math.max(0, Math.min(b, (w + 1) * PAS_PAROLE) - Math.max(a, w * PAS_PAROLE));
  }
  return s;
}
