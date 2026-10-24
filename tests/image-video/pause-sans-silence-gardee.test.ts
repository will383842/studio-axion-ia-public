/**
 * 19/10 (décision écrite de Will ; prod v-ca92da958325) : HeyGen dit « Votre client, lui, reste » et « Maintenant,
 * regardez » sans pause, mais ses horodatages inventent un petit blanc entre ces mots ; le resserrage coupe donc en plein
 * son (10,53 / 10,63 s et 12,61 / 12,78 s). Quand une pause de 0,2 s au plus n'a AUCUN silence (brut ou retenu) à ±0,25 s,
 * on la GARDE ENTIÈRE (un seul morceau, rien de coupé ni de retiré) au lieu de refuser. Une pause plus longue reste
 * refusée ; un silence derrière un mot n'est jamais utilisé ; sans l'option `garderPausesSansSilence` (les autres
 * générateurs), le comportement est celui d'avant.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { RECETTE_VOIX_IV, REGLES_COUPES_IV, coupesEnPleinSon, placerCoupesIV, type MesureSonIV } from "@/moteurs/montage-image-video/assemblage";
import { planRaccordVoix, type Silence } from "@/moteurs/montage-image-video/emprunts";

const f = 0.02;
const DUREE = 15;
const n = Math.ceil(DUREE / f);

/** Voix à −15 dB partout, −50 dB dans les silences donnés. */
function mesureDe(silences: Silence[], bruts: Silence[] = silences): MesureSonIV {
  const dans = (t: number) => silences.some((z) => t >= z.debutSec - 1e-9 && t < z.finSec - 1e-9);
  const niveaux = Array.from({ length: n }, (_, w) => (dans(w * f + f / 2) ? -50 : -15));
  return { silences, silencesBruts: bruts, seuilDb: -39.3, niveaux, fenetreSec: f, paroles: niveaux.map((x) => x > -39.3) };
}

const mots = [
  { mot: "client,", debutSec: 9.7, finSec: 10.1 },
  { mot: "lui,", debutSec: 10.26, finSec: 10.46 },
  { mot: "reste", debutSec: 10.7, finSec: 11.04 },
  { mot: "Maintenant,", debutSec: 12.1, finSec: 12.54 },
  { mot: "regardez", debutSec: 12.84, finSec: 13.3 },
] as MotHorodate[];

const plan = (coupes: [number, number][]) => {
  const bords = [0, ...coupes.flat(), DUREE];
  return {
    ...planRaccordVoix({ mots, dureeSec: DUREE }, undefined, RECETTE_VOIX_IV),
    morceaux: Array.from({ length: bords.length / 2 }, (_, i) => ({ debutSec: bords[2 * i], finSec: bords[2 * i + 1], source: 0 as const })),
  };
};

const lancer = (coupes: [number, number][], m: MesureSonIV, garder?: boolean) => {
  const s = { corps: m.silences };
  const d = { corps: DUREE };
  const { plan: p } = placerCoupesIV(plan(coupes), { corps: mots }, s, d, REGLES_COUPES_IV, { mesures: { corps: m }, ...(garder === undefined ? {} : { garderPausesSansSilence: garder }) });
  return { ms: p.morceaux.filter((x) => !x.silence), hors: coupesEnPleinSon(p, s, d) };
};

// Les seuls silences proches sont de l'autre côté d'un mot (avant « lui », avant « Maintenant »).
const AUTOUR = [
  { debutSec: 10.12, finSec: 10.24 },
  { debutSec: 11.74, finSec: 12.08 },
];
const CA92: [number, number][] = [
  [10.53, 10.63],
  [12.61, 12.78],
];

describe("pause ≤ 0,2 s sans silence à ±0,25 s : gardée entière (Image → vidéo)", () => {
  it("ca92 : deux pauses sans silence à portée → un seul morceau, aucune coupe hors silence, rien de retiré", () => {
    const { ms, hors } = lancer(CA92, mesureDe(AUTOUR), true);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ debutSec: 0, finSec: DUREE });
    expect(hors).toEqual([]);
  });

  it("garde-fou : une pause de 0,3 s sans silence reste refusée (2 morceaux, coupes hors silence)", () => {
    const { ms, hors } = lancer([[10.53, 10.83]], mesureDe(AUTOUR), true);
    expect(ms).toHaveLength(2);
    expect(hors.length).toBeGreaterThan(0);
  });

  it("un silence derrière un mot n'est jamais utilisé : aucune coupe n'est posée dans 10,12-10,24 ni 11,74-12,08", () => {
    const { ms } = lancer(CA92, mesureDe(AUTOUR), true);
    for (const m of ms) for (const z of AUTOUR) expect(m.debutSec > z.debutSec && m.debutSec < z.finSec).toBe(false);
    expect(ms.at(-1)!.finSec).toBe(DUREE);
  });
});

describe("autres générateurs (option absente) : comportement inchangé", () => {
  it("ca92 sans l'option : mêmes morceaux qu'avec garderPausesSansSilence: false, coupes refusées", () => {
    const m = mesureDe(AUTOUR);
    const sans = lancer(CA92, m);
    expect(sans).toEqual(lancer(CA92, m, false));
    expect(sans.ms).toHaveLength(3);
    expect(sans.ms.map((x) => [x.debutSec, x.finSec])).toEqual([
      [0, 10.53],
      [10.63, 12.61],
      [12.78, DUREE],
    ]);
    expect(sans.hors.length).toBe(4);
  });
});
