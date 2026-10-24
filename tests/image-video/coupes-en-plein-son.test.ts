/**
 * 16/10 (prod v-dd3049053f88, après #281) : « Voix (tiktok) · la coupe à 3,04 s du son du corps tombe en plein son, hors
 * de tout silence mesuré (8 coupes dans ce cas) ». Le seuil adapté au bruit de fond trouve bien les pauses, mais les
 * coupes sont posées sur les HORODATAGES des mots, et le recalage emprunté au cas concret ne cherche qu'en avant pour une
 * fin de morceau, qu'en arrière pour un début, et bute sur la coupe voisine : un horodatage HeyGen en RETARD sur le son
 * (le silence est avant la coupe) n'est jamais rattrapé. Ici :
 *  - un son synthétique PLUS RÉALISTE que la répétition générale : bruit rose à −40 dB partout, mots harmoniques de −12
 *    à −25 dB avec attaque et fondu, pauses de 80 à 300 ms, respirations à −30 dB avant certaines phrases, occlusives
 *    (creux de 70 ms au bruit de fond dans un mot), horodatages décalés de 50 à 200 ms du son, en avance ou en retard ;
 *  - ancien recalage : des coupes restent en plein son (le refus de la prod est reproduit) ; nouveau : aucune, aucune
 *    coupe dans un vrai mot, assemblage au bout ;
 *  - tolérance bornée (±0,25 s) : au-delà, refus, avec un message DIAGNOSTIQUE (niveau, seuil, silence le plus proche).
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import {
  RECETTE_VOIX_IV,
  REGLES_COUPES_IV,
  assemblerVersionsIV,
  coupesEnPleinSon,
  diagnosticCoupe,
  placerCoupesIV,
  silencesIV,
  type MesureSonIV,
  type OutilsAssemblageIV,
} from "@/moteurs/montage-image-video/assemblage";
import { lireWav, planRaccordVoix, recalerCoupesSurSilences, type Silence, type Son } from "@/moteurs/montage-image-video/emprunts";
import { COUPE_EN_PLEIN_SON_IV } from "@/moteurs/montage-image-video/phrases-assemblage";
import type { EtatVoixIV } from "@/moteurs/montage-image-video/voix";

const F = 24000;

/** WAV PCM 16 bits mono, 24 kHz (comme le MP3 HeyGen converti). */
function wav(e: Float32Array): Uint8Array {
  const b = new Uint8Array(44 + e.length * 2);
  const v = new DataView(b.buffer);
  const ecrire = (i: number, s: string) => [...s].forEach((c, k) => (b[i + k] = c.charCodeAt(0)));
  ecrire(0, "RIFF");
  v.setUint32(4, 36 + e.length * 2, true);
  ecrire(8, "WAVE");
  ecrire(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, F, true);
  v.setUint32(28, F * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ecrire(36, "data");
  v.setUint32(40, e.length * 2, true);
  e.forEach((x, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true));
  return b;
}

/** Hasard à graine fixe. */
function alea(graine: number) {
  let g = graine;
  return () => ((g = (g * 1103515245 + 12345) % 2147483648) / 2147483648);
}

const rms = (x: Float32Array, a = 0, b = x.length) => Math.sqrt(x.subarray(a, b).reduce((s, v) => s + v * v, 0) / Math.max(1, b - a));

interface VraiMot {
  mot: string;
  /** Instants du SON (début de l'attaque, fin du fondu). */
  debutSec: number;
  finSec: number;
}

interface VoixRealiste {
  son: Son;
  octets: Uint8Array;
  dureeSec: number;
  vrais: VraiMot[];
  /** Horodatages rendus par la voix : décalés de 50 à 200 ms du son, phrase par phrase. */
  mots: MotHorodate[];
  respirations: [number, number][];
}

/** Décalage des horodatages par phrase (s) : en retard (+) ou en avance (−), de 50 à 200 ms. */
const DECALAGES = [0.12, -0.08, 0.18, 0.05, -0.15, 0.2, 0.09, -0.05, 0.16, -0.12, 0.07, 0.14];

/**
 * Voix synthétique réaliste : 12 phrases de 5 à 8 mots. Pauses entre mots de 0 à 140 ms (80-140 ms : vraies pauses
 * courtes), 120-200 ms après une virgule, 220-300 ms entre phrases ; une respiration à −30 dB (90 ms) juste avant une
 * phrase sur trois ; une occlusive (creux de 70 ms au bruit de fond) au milieu d'un mot long sur quatre.
 */
function voixRealiste(graine = 7, o: OptionsVoix = {}): VoixRealiste {
  const r = alea(graine);
  // Hasard des options sur un autre tirage : les graines sans option gardent exactement le même son.
  const r2 = alea(graine + 3);
  const decalages = o.decalagesAuHasard ? (o.phrases ?? DECALAGES.length) : 0;
  const listeDec = decalagesAuHasard(r2, decalages) ?? DECALAGES.slice(0, o.phrases ?? DECALAGES.length);
  const vrais: VraiMot[] = [];
  const mots: MotHorodate[] = [];
  const respirations: [number, number][] = [];
  const occlusives: [number, number][] = [];
  const niveaux: number[] = [];
  let t = 0.35;
  let n = 0;
  let finHorodatee = 0;
  listeDec.forEach((dec, p) => {
    const nb = 5 + Math.floor(r() * 4);
    if (p > 0 && p % 3 === 0) respirations.push([+(t - 0.1).toFixed(4), +(t - 0.01).toFixed(4)]);
    for (let k = 0; k < nb; k++) {
      const duree = 0.18 + r() * 0.27;
      const fin = k === nb - 1 ? "." : k === 2 && nb > 6 ? "," : "";
      const mot = `mot${++n}${fin}`;
      vrais.push({ mot, debutSec: +t.toFixed(4), finSec: +(t + duree).toFixed(4) });
      // Décalage tiré au hasard : celui de la phrase ± 0,03 s par mot, borné à ±0,2 s ; horodatages croissants.
      const d = o.decalagesAuHasard ? Math.max(-0.2, Math.min(0.2, dec + (r2() * 2 - 1) * 0.03)) : dec;
      const debutH = Math.max(finHorodatee, +(t + d).toFixed(3));
      finHorodatee = Math.max(debutH + 0.05, +(t + duree + d).toFixed(3));
      mots.push({ mot, debutSec: debutH, finSec: o.decalagesAuHasard ? finHorodatee : +(t + duree + dec).toFixed(3) });
      if (!o.decalagesAuHasard) finHorodatee = 0;
      niveaux.push(-12 - r() * 13);
      if (duree > 0.36 && n % 4 === 0) occlusives.push([+(t + duree / 2 - 0.035).toFixed(4), +(t + duree / 2 + 0.035).toFixed(4)]);
      // Occlusive FINALE (« acte », « texte ») : creux de 80 à 110 ms au bruit de fond, 70 ms avant la fin du mot.
      else if (o.occlusivesFinales && duree > 0.3 && r2() < 0.5) {
        const lg = 0.08 + r2() * 0.03;
        occlusives.push([+(t + duree - 0.07 - lg).toFixed(4), +(t + duree - 0.07).toFixed(4)]);
      }
      t += duree;
      if (fin === ".") t += 0.22 + r() * 0.08;
      else if (fin === ",") t += 0.12 + r() * 0.08;
      else t += r() < 0.5 ? r() * 0.06 : 0.08 + r() * 0.06;
    }
  });
  const dureeSec = +(t + 0.5).toFixed(2);
  const e = new Float32Array(Math.round(dureeSec * F));

  // Bruit rose (filtre de Paul Kellet), ramené à −40 dB RMS.
  const blanc = alea(graine + 1);
  const rose = new Float32Array(e.length);
  let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < e.length; i++) {
    const w = blanc() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    rose[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
  }
  const kBruit = 10 ** (-40 / 20) / rms(rose);
  for (let i = 0; i < e.length; i++) e[i] = rose[i] * kBruit;

  // Mots : trois harmoniques, syllabes (modulation ~4 Hz), attaque 15 ms, fondu de 30 à 60 ms ; niveau RMS visé.
  vrais.forEach((m, k) => {
    const a = Math.round(m.debutSec * F);
    const b = Math.round(m.finSec * F);
    const f0 = 110 + ((k * 37) % 70);
    const fondu = 0.03 + ((k * 13) % 4) * 0.01;
    const x = new Float32Array(b - a);
    for (let i = 0; i < x.length; i++) {
      const s = i / F;
      const env = Math.min(1, s / 0.015) * Math.min(1, (m.finSec - m.debutSec - s) / fondu) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 4 * s));
      x[i] = env * (Math.sin(2 * Math.PI * f0 * s) + 0.5 * Math.sin(2 * Math.PI * 2 * f0 * s) + 0.25 * Math.sin(2 * Math.PI * 3 * f0 * s));
    }
    for (const [oa, ob] of occlusives) if (oa >= m.debutSec && ob <= m.finSec) x.fill(0, Math.round(oa * F) - a, Math.round(ob * F) - a);
    const kMot = 10 ** (niveaux[k] / 20) / rms(x);
    for (let i = 0; i < x.length; i++) e[a + i] += x[i] * kMot;
  });
  // Respirations : bruit blanc filtré, −30 dB, fondu d'entrée et de sortie.
  const souffle = alea(graine + 2);
  for (const [ra, rb] of respirations) {
    const a = Math.round(ra * F);
    const n2 = Math.round((rb - ra) * F);
    let y = 0;
    const x = Float32Array.from({ length: n2 }, (_, i) => ((y = 0.7 * y + 0.3 * (souffle() * 2 - 1)), y * Math.sin((Math.PI * i) / n2)));
    const k2 = 10 ** (-30 / 20) / rms(x);
    for (let i = 0; i < n2; i++) e[a + i] += x[i] * k2;
  }
  const octets = wav(e);
  return { son: lireWav(octets), octets, dureeSec, vrais, mots, respirations };
}

interface OptionsVoix {
  /** Nombre de phrases (12 par défaut). */
  phrases?: number;
  /** Décalage de chaque phrase tiré dans ±0,05 à 0,2 s (plus ±0,03 s par mot, borné à ±0,2 s). */
  decalagesAuHasard?: boolean;
  /** Une occlusive finale de 80 à 110 ms dans un mot de plus de 0,3 s sur deux. */
  occlusivesFinales?: boolean;
}

function decalagesAuHasard(r: () => number, n: number): number[] | null {
  if (!n) return null;
  return Array.from({ length: n }, () => (r() < 0.5 ? -1 : 1) * (0.05 + r() * 0.15));
}

const dans = (t: number, s: readonly Silence[]) => s.some((x) => t > x.debutSec && t < x.finSec);
const sonDans = (t: number, vrais: readonly VraiMot[]) => vrais.find((w) => t > w.debutSec + 0.01 && t < w.finSec - 0.01);

describe("coupes de l'assemblage sur une voix réaliste (bruit rose −40 dB, horodatages décalés de 50 à 200 ms)", () => {
  const v = voixRealiste();
  const mesure = silencesIV(v.son);
  const brut = planRaccordVoix({ mots: v.mots, dureeSec: v.dureeSec }, undefined, RECETTE_VOIX_IV);
  const silences = { corps: mesure.silences };
  const durees = { corps: v.dureeSec };

  it("le son fabriqué ressemble à la copie HeyGen : jamais de zéro numérique, pauses au bruit de fond, seuil adapté", () => {
    expect(mesure.niveaux.every((d) => d > -60)).toBe(true);
    expect(mesure.seuilDb).toBeGreaterThan(-45);
    expect(mesure.seuilDb).toBeLessThanOrEqual(-35);
    // Les respirations et la parole ne sont jamais des silences ; les pauses entre phrases en contiennent un.
    for (const [a, b] of v.respirations) expect(silences.corps.some((s) => s.debutSec < (a + b) / 2 && s.finSec > (a + b) / 2)).toBe(false);
    // (Au quart et aux trois quarts : le milieu d'un mot long peut être une occlusive, un vrai silence de 40 à 60 ms.)
    for (const w of v.vrais) for (const q of [0.25, 0.75]) expect(dans(w.debutSec + q * (w.finSec - w.debutSec), silences.corps)).toBe(false);
    expect(brut.morceaux.length).toBeGreaterThan(12);
  });

  it("ANCIEN recalage : des coupes restent en plein son (le refus de la prod) ; NOUVEAU : toutes dans un silence, jamais dans un vrai mot", () => {
    const ancien = recalerCoupesSurSilences(brut, { corps: v.mots }, { 0: silences.corps }).plan;
    const horsAncien = coupesEnPleinSon(ancien, silences, durees);
    expect(horsAncien.length).toBeGreaterThanOrEqual(4);

    const { plan, coupesDeplacees } = placerCoupesIV(brut, { corps: v.mots }, silences, durees);
    expect(coupesEnPleinSon(plan, silences, durees)).toEqual([]);
    expect(coupesDeplacees).toBeGreaterThan(horsAncien.length / 2);
    // Aucune coupe dans un vrai mot (le son), aucun mot horodaté hors des morceaux gardés.
    for (const m of plan.morceaux) {
      expect(sonDans(m.debutSec, v.vrais)).toBeUndefined();
      if (m.finSec < v.dureeSec) expect(sonDans(m.finSec, v.vrais)).toBeUndefined();
      expect(m.finSec).toBeGreaterThan(m.debutSec);
    }
    for (const w of v.vrais) expect(plan.morceaux.some((m) => w.debutSec + 0.01 >= m.debutSec && w.finSec - 0.01 <= m.finSec), w.mot).toBe(true);
    // Les morceaux restent dans l'ordre, sans chevauchement ; chaque coupe a bougé de 0,25 s au plus.
    plan.morceaux.forEach((m, i) => {
      if (i) expect(m.debutSec).toBeGreaterThanOrEqual(plan.morceaux[i - 1].finSec);
      expect(Math.abs(m.debutSec - brut.morceaux[i].debutSec)).toBeLessThanOrEqual(REGLES_COUPES_IV.toleranceSec + 1e-6);
      expect(Math.abs(m.finSec - brut.morceaux[i].finSec)).toBeLessThanOrEqual(REGLES_COUPES_IV.toleranceSec + 1e-6);
    });
    // Mots et durée suivent : croissants, la durée change de la somme des morceaux (÷ tempo).
    plan.mots.forEach((w, i) => i && expect(w.debutSec).toBeGreaterThanOrEqual(plan.mots[i - 1].debutSec));
    const somme = (p: typeof plan) => p.morceaux.reduce((a, m) => a + m.finSec - m.debutSec, 0);
    expect(plan.dureeResserreeSec).toBeCloseTo(somme(plan), 3);
    expect(plan.dureeSec - brut.dureeSec).toBeCloseTo((somme(plan) - somme(brut)) / 1.05, 3);
  });

  it("de 5 graines en 5 graines : le nouveau placement n'échoue jamais là où des pauses existent", () => {
    for (const g of [11, 23, 37, 51, 89]) {
      const w = voixRealiste(g);
      const s = { corps: silencesIV(w.son).silences };
      const p = planRaccordVoix({ mots: w.mots, dureeSec: w.dureeSec }, undefined, RECETTE_VOIX_IV);
      expect(coupesEnPleinSon(placerCoupesIV(p, { corps: w.mots }, s, { corps: w.dureeSec }).plan, s, { corps: w.dureeSec })).toEqual([]);
    }
  });

  it("assemblage de bout en bout sur ce son : piste produite, coupes déplacées comptées", async () => {
    const sons = new Map<string, Uint8Array>([["brut-1.wav", v.octets]]);
    const etat = {
      issue: { statut: "faite" },
      voix: { corps: { prise: { etat: { phase: "faite" }, brut: { fichierCle: "brut-1.wav", dureeSec: v.dureeSec, mots: v.mots } } }, fins: [] },
      segments: { versions: [{ id: "corps-seul", reseaux: ["linkedin"] }] },
    } as unknown as EtatVoixIV;
    const o: OutilsAssemblageIV = {
      lireSon: async (cle) => sons.get(cle) ?? null,
      convertirEnWav: async () => {
        throw new Error("déjà un WAV");
      },
      rangerSon: async (cle, x) => void sons.set(cle, x),
      async traiterVoix(d) {
        // Morceaux bout à bout, tempo par décimation, puis 0,8 s de silence (comme la recette).
        const src = lireWav(sons.get(d.recette.corps)!).echantillons;
        const parties = d.morceaux.map((m) => src.subarray(Math.round(m.deSec * F), Math.round(m.aSec * F)));
        const bout = new Float32Array(parties.reduce((a, x) => a + x.length, 0));
        parties.reduce((i, x) => (bout.set(x, i), i + x.length), 0);
        const n = Math.floor(bout.length / d.tempo);
        const sortie = new Float32Array(n + Math.round(0.8 * F));
        for (let k = 0; k < n; k++) sortie[k] = bout[Math.floor(k * d.tempo)];
        sons.set(`${d.id}.wav`, wav(sortie));
        return { cle: `${d.id}.wav`, dureeSec: sortie.length / F };
      },
    };
    const [piste] = await assemblerVersionsIV(etat, o);
    expect(piste.coupesDeplacees).toBeGreaterThan(0);
    expect(piste.mots).toHaveLength(v.mots.length);
  });
});

describe("placerCoupesIV : sens, tolérance bornée, voisins", () => {
  const mots = (l: [number, number][]) => l.map(([debutSec, finSec], i) => ({ mot: `m${i}`, debutSec, finSec }));
  const plan = (morceaux: { debutSec: number; finSec: number }[], m: MotHorodate[]) => {
    const p = planRaccordVoix({ mots: m, dureeSec: 10 }, undefined, RECETTE_VOIX_IV);
    return { ...p, morceaux: morceaux.map((x) => ({ ...x, source: 0 as const })) };
  };

  it("fin de morceau APRÈS le silence (horodatage en retard) : ramenée en arrière ; début AVANT le silence : avancé", () => {
    const m = mots([
      [0.3, 1.0],
      [1.6, 2.2],
    ]);
    const s: Silence[] = [{ debutSec: 1.02, finSec: 1.2 }];
    // Coupes posées à 1,30 et 1,40 : dans le son du mot suivant, qui commence en vrai à 1,22.
    const p0 = plan([{ debutSec: 0, finSec: 1.3 }, { debutSec: 1.4, finSec: 3 }], m);
    const { plan: p, coupesDeplacees } = placerCoupesIV(p0, { corps: m }, { corps: s }, { corps: 3 });
    expect(coupesDeplacees).toBe(2);
    expect(p.morceaux[0].finSec).toBeCloseTo(1.16, 6);
    expect(p.morceaux[1].debutSec).toBeCloseTo(1.16, 6);
    expect(coupesEnPleinSon(p, { corps: s }, { corps: 3 })).toEqual([]);
    // L'ancien recalage ne bouge ni l'une ni l'autre (la fin ne cherche qu'en avant, le début bute sur elle).
    const ancien = recalerCoupesSurSilences(p0, { corps: m }, { 0: s }).plan;
    expect(coupesEnPleinSon(ancien, { corps: s }, { corps: 3 })).toHaveLength(2);
  });

  it("silence au-delà de ±0,25 s : rien ne bouge (la coupe sera refusée) ; jamais à l'intérieur d'un mot gardé", () => {
    const m = mots([
      [0.3, 1.0],
      [1.6, 2.2],
    ]);
    const loin: Silence[] = [{ debutSec: 1.75, finSec: 1.9 }];
    const p0 = plan([{ debutSec: 0, finSec: 1.3 }, { debutSec: 1.45, finSec: 3 }], m);
    expect(placerCoupesIV(p0, { corps: m }, { corps: loin }, { corps: 3 }).coupesDeplacees).toBe(0);
    // (Relecture #283, 2e passage : une pause de 80 ms au plus sans silence à portée n'est plus refusée : ses deux
    // morceaux sont fusionnés, rien n'est retiré.)
    const fusion = placerCoupesIV(plan([{ debutSec: 0, finSec: 1.3 }, { debutSec: 1.35, finSec: 3 }], m), { corps: m }, { corps: loin }, { corps: 3 }).plan;
    expect(fusion.morceaux).toEqual([{ debutSec: 0, finSec: 3, source: 0 }]);
    // Un creux DANS le dernier mot gardé (occlusive, 0,76-0,82 s, à 0,25 s de la coupe) n'attire jamais la fin du morceau :
    // il est à plus de 0,2 s avant la fin horodatée du mot (1,00 s).
    const creux: Silence[] = [
      { debutSec: 0.76, finSec: 0.82 },
      { debutSec: 1.3, finSec: 1.6 },
    ];
    const r = placerCoupesIV(plan([{ debutSec: 0, finSec: 1.04 }, { debutSec: 1.35, finSec: 3 }], m), { corps: m }, { corps: creux }, { corps: 3 });
    // (Relecture #283, 2e passage : une fin peut AVANCER jusqu'à la portée du début suivant, elle n'ajoute que du son ;
    // elle va donc dans la pause 1,30-1,60 s, et jamais dans le creux.)
    expect(r.plan.morceaux[0].finSec).toBeGreaterThanOrEqual(1.3);
    expect(coupesEnPleinSon(r.plan, { corps: creux }, { corps: 3 })).toEqual([]);
  });

  it("plan déjà juste : rendu tel quel (même objet)", () => {
    const m = mots([
      [0.3, 1.0],
      [1.6, 2.2],
    ]);
    const p0 = plan([{ debutSec: 0.2, finSec: 1.1 }, { debutSec: 1.5, finSec: 3 }], m);
    const r = placerCoupesIV(p0, { corps: m }, { corps: [{ debutSec: 1.02, finSec: 1.58 }] }, { corps: 10 });
    expect(r.coupesDeplacees).toBe(0);
    expect(r.plan).toBe(p0);
  });
});

describe("refus restant : message DIAGNOSTIQUE", () => {
  it("chaque coupe fautive : instant, niveau mesuré, seuil, distance au silence le plus proche et ses bornes", () => {
    const niveaux = Array.from({ length: 200 }, (_, w) => (w >= 172 && w < 180 ? -44 : -22.4));
    const d = diagnosticCoupe({ source: "corps", instantSec: 3.04 }, { silences: [{ debutSec: 1.0, finSec: 1.2 }, { debutSec: 3.45, finSec: 3.6 }], seuilDb: -38.4, niveaux });
    expect(d).toBe("corps 3,04 s : −22,4 dB, seuil −38,4 dB, silence le plus proche à 0,41 s (3,45 s → 3,60 s)");
    expect(diagnosticCoupe({ source: "fin", instantSec: 0.5 }, { silences: [], seuilDb: -35, niveaux })).toBe("fin 0,50 s : −22,4 dB, seuil −35,0 dB, aucun silence mesuré dans ce son");
  });

  it("assemblage refusé : la phrase de Will garde son début (reconnue, « Refaire cette partie ») et détaille les coupes", async () => {
    // Fin de la 5e phrase (pause horodatée de 0,59 s : plus de 0,2 s, donc non gardée entière depuis le 19/10 ; une pause
    // de 0,2 s au plus sans silence à portée est désormais gardée) : son dernier mot, la pause et les
    // deux mots suivants noyés sous un son continu à −15 dB (bruit de machine). Aucun silence à ±0,25 s des deux coupes
    // de cette pause, ni dans leurs bornes de sûreté.
    const v = voixRealiste(3);
    const e = v.son.echantillons.slice();
    const w = v.mots.map((x, k) => (x.mot.endsWith(".") ? k : -1)).filter((k) => k >= 0)[4];
    const [a, b] = [v.vrais[w].debutSec, v.vrais[w + 2].finSec];
    for (let i = Math.round(a * F); i < Math.round(b * F); i++) e[i] += 0.25 * Math.sin(2 * Math.PI * 300 * (i / F));
    const sons = new Map<string, Uint8Array>([["brut-1.wav", wav(e)]]);
    const etat = {
      issue: { statut: "faite" },
      voix: { corps: { prise: { etat: { phase: "faite" }, brut: { fichierCle: "brut-1.wav", dureeSec: v.dureeSec, mots: v.mots } } }, fins: [] },
      segments: { versions: [{ id: "v", reseaux: ["tiktok"] }] },
    } as unknown as EtatVoixIV;
    const o: OutilsAssemblageIV = { lireSon: async (c) => sons.get(c) ?? null, convertirEnWav: async (x) => x, rangerSon: async () => {}, traiterVoix: async () => ({ cle: "x", dureeSec: 1 }) };
    const err = await assemblerVersionsIV(etat, o).then(
      () => null,
      (x: Error & { controle?: string }) => x,
    );
    expect(err?.controle).toBe("coupe");
    expect(err!.message).toMatch(
      /^Voix \(tiktok\) · la coupe à \d+,\d\d s du son du corps tombe en plein son, hors de tout silence mesuré \([2-4] coupes dans ce cas\) : la voix n'est jamais coupée ailleurs que dans un silence\. Détail \(coupe : niveau, seuil, silence le plus proche ; recherche à ±0,25 s\) : corps \d+,\d\d s : −1\d,\d dB, seuil −35,0 dB, silence le plus proche à \d,\d\d s \(\d+,\d\d s → \d+,\d\d s\)( ; corps \d+,\d\d s : −1\d,\d dB, seuil −35,0 dB, silence le plus proche à \d,\d\d s \(\d+,\d\d s → \d+,\d\d s\))+\.$/,
    );
    // Reconnue par l'écran : « Refaire cette partie » reste proposé pour ce refus (même cœur de phrase).
    expect(err!.message).toContain(COUPE_EN_PLEIN_SON_IV);
    // La coupe est bien hors de portée : son silence le plus proche est à plus de 0,25 s.
    for (const d of err!.message.matchAll(/silence le plus proche à (\d),(\d\d) s/g)) expect(Number(`${d[1]}.${d[2]}`)).toBeGreaterThan(REGLES_COUPES_IV.toleranceSec);
  });
});

/**
 * 16/10 (relecture #283, À CORRIGER) : un déplacement de coupe ne RETIRE JAMAIS de son. Le silence le plus proche d'un
 * début pouvait être APRÈS le vrai mot (horodatage en retard : le mot entier disparaissait, accepté) ; une fin pouvait
 * reculer dans le creux d'une occlusive finale ; deux pauses voisines pouvaient vider un morceau.
 */
describe("placerCoupesIV : jamais de son retiré, jamais de morceau vide", () => {
  const mots = (l: [number, number][]) => l.map(([debutSec, finSec], i) => ({ mot: `m${i}`, debutSec, finSec }));
  const plan = (morceaux: { debutSec: number; finSec: number }[], m: MotHorodate[]) => {
    const p = planRaccordVoix({ mots: m, dureeSec: 10 }, undefined, RECETTE_VOIX_IV);
    return { ...p, morceaux: morceaux.map((x) => ({ ...x, source: 0 as const })) };
  };

  it("D2, cas minimal : horodatage en retard de 0,2 s, le silence suivant est APRÈS le vrai mot : le début recule, le mot reste", () => {
    // Vrai son du mot : 1,24 → 1,44 s ; horodaté 1,439 → 1,642 s. Avant : début avancé à 1,46 s, mot perdu, accepté.
    const m = mots([
      [0.3, 0.9],
      [1.439, 1.642],
    ]);
    const s: Silence[] = [
      { debutSec: 0.94, finSec: 1.24 },
      { debutSec: 1.42, finSec: 1.56 },
    ];
    const p0 = plan([{ debutSec: 0, finSec: 1.0 }, { debutSec: 1.339, finSec: 3 }], m);
    const { plan: p } = placerCoupesIV(p0, { corps: m }, { corps: s }, { corps: 3 });
    expect(coupesEnPleinSon(p, { corps: s }, { corps: 3 })).toEqual([]);
    expect(p.morceaux[0]).toMatchObject({ debutSec: 0, finSec: 1.0 });
    expect(p.morceaux[1].debutSec).toBeGreaterThanOrEqual(1.0);
    expect(p.morceaux[1].debutSec).toBeLessThanOrEqual(1.24);
  });

  it("occlusive finale (« acte ») : la fin ne recule pas dans le creux, elle avance dans la vraie pause", () => {
    // Mot : son 0,30 → 0,78 s, creux de l'occlusive 0,62 → 0,70 s (mesuré comme une pause franche), pause 0,78 → 1,05 s.
    const m = mots([
      [0.3, 0.73],
      [1.1, 1.5],
    ]);
    const s: Silence[] = [
      { debutSec: 0.62, finSec: 0.7 },
      { debutSec: 0.78, finSec: 1.05 },
    ];
    const p0 = plan([{ debutSec: 0, finSec: 0.731 }, { debutSec: 0.784, finSec: 3 }], m);
    const { plan: p } = placerCoupesIV(p0, { corps: m }, { corps: s }, { corps: 3 });
    expect(coupesEnPleinSon(p, { corps: s }, { corps: 3 })).toEqual([]);
    expect(p.morceaux[0].finSec).toBeGreaterThanOrEqual(0.78);
    expect(p.morceaux[1].debutSec).toBeGreaterThanOrEqual(p.morceaux[0].finSec);
  });

  /** Parties de `avant` absentes de `apres` (intervalles triés, sans chevauchement). */
  const retire = (avant: { debutSec: number; finSec: number }[], apres: { debutSec: number; finSec: number }[]) => {
    const res: [number, number][] = [];
    for (const a of avant) {
      let t = a.debutSec;
      for (const b of apres) {
        if (b.finSec <= t || b.debutSec >= a.finSec) continue;
        if (b.debutSec > t) res.push([t, b.debutSec]);
        t = Math.max(t, b.finSec);
      }
      if (t < a.finSec) res.push([t, a.finSec]);
    }
    return res.filter(([x, y]) => y - x > 1e-6);
  };

  it("200 voix au hasard (décalages ±0,2 s, occlusives finales de 80 à 110 ms) : version acceptée = aucun son retiré, chaque vrai mot entier, aucun morceau vide", () => {
    let acceptees = 0;
    const refusees: number[] = [];
    for (let g = 1001; g <= 1200; g++) {
      const v = voixRealiste(g, { phrases: 3, decalagesAuHasard: true, occlusivesFinales: true });
      const s = { corps: silencesIV(v.son).silences };
      const d = { corps: v.dureeSec };
      const brut = planRaccordVoix({ mots: v.mots, dureeSec: v.dureeSec }, undefined, RECETTE_VOIX_IV);
      const { plan: p } = placerCoupesIV(brut, { corps: v.mots }, s, d);
      if (coupesEnPleinSon(p, s, d).length) {
        refusees.push(g);
        continue;
      }
      acceptees++;
      const dansUnSilence = ([x, y]: [number, number]) => s.corps.some((z) => x >= z.debutSec - 1e-6 && y <= z.finSec + 1e-6);
      const ms = p.morceaux.filter((m) => !m.silence);
      ms.forEach((m, i) => {
        expect(m.finSec - m.debutSec, `graine ${g}, morceau ${i}`).toBeGreaterThanOrEqual(0.05 - 1e-6);
        if (i) expect(m.debutSec, `graine ${g}, morceau ${i}`).toBeGreaterThanOrEqual(ms[i - 1].finSec - 1e-6);
      });
      // Tout ce que le placement retire du plan d'origine est dans un silence mesuré.
      for (const x of retire(
        brut.morceaux.filter((m) => !m.silence),
        ms,
      ))
        expect(dansUnSilence(x), `graine ${g} : ${x.join(" → ")} retiré`).toBe(true);
      // Chaque vrai mot est gardé en entier : ce qui en manque (le bord de son attaque ou de son fondu, une partie du creux
      // d'une occlusive) n'est que du silence mesuré, jamais de son.
      for (const w of v.vrais) for (const x of retire([w], ms)) expect(dansUnSilence(x), `graine ${g}, ${w.mot} (${w.debutSec} → ${w.finSec}) : ${x.join(" → ")} perdu`).toBe(true);
    }
    console.log(`200 voix au hasard : ${acceptees} acceptées, ${refusees.length} refusées${refusees.length ? ` (graines ${refusees.join(", ")})` : ""}`);
    expect(acceptees).toBeGreaterThanOrEqual(150);
  }, 120_000);
});

describe("placerCoupesIV : fusion d'une pause sans silence masqué (prod v-dcc902c3f3dd, « fermeture ? » → « Faites »)", () => {
  // Fin TikTok : la pause de 0,18 s (2,35 → 2,53) est faite de parole ; le seul creux (2,54 → 2,66 s, −42 dB) est le « F » de
  // « Faites », effacé du masque de parole : il n'est plus dans `silences`, mais encore dans les silences bruts.
  const f = 0.02;
  const n = Math.ceil(6.687 / f);
  const niveaux = Array.from({ length: n }, (_, w) => {
    const t = w * f;
    return t >= 0.24 && !(t >= 2.52 && t < 2.66) ? -18 : -42;
  });
  const paroles = Array.from({ length: n }, (_, w) => w * f >= 0.24 - 1e-9 && w * f < 4.76 - 1e-9);
  const silences: Silence[] = [
    { debutSec: 0, finSec: 0.24 },
    { debutSec: 4.8, finSec: 4.86 },
  ];
  const mots = [
    { mot: "fermeture", debutSec: 1.76, finSec: 2.3 },
    { mot: "Faites", debutSec: 2.58, finSec: 2.74 },
  ] as MotHorodate[];
  const plan = () => {
    const p = planRaccordVoix({ mots, dureeSec: 6.687 }, undefined, RECETTE_VOIX_IV);
    return {
      ...p,
      morceaux: [
        { debutSec: 0.1, finSec: 2.35, source: 1 as const },
        { debutSec: 2.53, finSec: 6.687, source: 1 as const },
      ],
    };
  };
  const mesure = (bruts?: Silence[]): MesureSonIV => ({ silences, ...(bruts ? { silencesBruts: bruts } : {}), seuilDb: -38.07, niveaux, fenetreSec: f, paroles });
  const lancer = (m: MesureSonIV) => {
    const s = { corps: [] as Silence[], fin: silences };
    const d = { corps: 10, fin: 6.687 };
    const { plan: p } = placerCoupesIV(plan(), { corps: [], fin: mots }, s, d, REGLES_COUPES_IV, { mesures: { fin: m }, garderPausesSansSilence: true });
    return { p, hors: coupesEnPleinSon(p, s, d) };
  };

  it("le creux se lit dans les silences bruts : un seul morceau, rien de retiré, aucune coupe en plein son", () => {
    const { p, hors } = lancer(mesure([{ debutSec: 2.54, finSec: 2.66 }]));
    const ms = p.morceaux.filter((m) => !m.silence);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ debutSec: 0.1, finSec: 6.687 });
    expect(hors).toEqual([]);
  });

  it("sans silences bruts, sans aucun silence à ±0,25 s (décision de Will 19/10) : pause gardée entière, un seul morceau, aucune coupe hors silence", () => {
    const { p, hors } = lancer(mesure());
    const ms = p.morceaux.filter((m) => !m.silence);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ debutSec: 0.1, finSec: 6.687 });
    expect(hors).toEqual([]);
  });
});
