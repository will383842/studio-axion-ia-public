/**
 * 16/10 (relecture #283, 2e passage, À CORRIGER) : sur des voix bruitées réalistes (générateur indépendant de celui de
 * `coupes-en-plein-son.test.ts`, voir `voix-bruitee.ts`), l'assemblage refusait trop souvent (17,7 % des voix corps seul,
 * 27 à 32 % quand le bruit est entre −42 et −38 dB, 59 % des voix corps + fin) et un premier mot court pouvait
 * disparaître sans refus. Ici, sur 400 voix corps seul et 100 voix corps + fin (horodatages décalés jusqu'à ±0,2 s par
 * phrase, plus ±0,03 s par mot), puis 200 + 50 à ±0,25 s, chaque version ACCEPTÉE est vérifiée contre la vérité du
 * générateur :
 *  - aucun son de parole retiré : dans chaque écart retiré, au plus 20 ms où les mots seuls dépassent le bruit de fond
 *    (le bord d'une attaque ou d'un fondu, sous le seuil mesuré) ;
 *  - aucun vrai mot perdu, le premier compris : au plus 20 ms de chaque mot retirées, au même sens ;
 *  - aucun morceau de moins de 0,05 s, ordre strict, jamais deux morceaux collés (une jonction coupait un mot en deux
 *    dans le creux d'une occlusive : remarque 3 de la relecture) ;
 *  - aucune coupe hors d'un silence mesuré, et aucune coupe dans la parole (mots seuls à plus de 6 dB au-dessus du bruit
 *    des deux côtés de la coupe) ;
 * et le taux de refus reste sous 6 % (corps seul) et 8 % (corps + fin), donné par tranche de bruit.
 */
import { describe, expect, it } from "vitest";
import {
  REGLES_COUPES_IV,
  REGLES_SILENCES_IV,
  couperVoixIV,
  paroleRetireeIV,
  refusParoleRetireeIV,
  seuilSilenceIV,
  silencesIV,
  type MesureSonIV,
} from "@/moteurs/montage-image-video/assemblage";
import { COUPE_EN_PLEIN_SON_IV } from "@/moteurs/montage-image-video/phrases-assemblage";
import { paroleDans, voixBruitee, type OptionsBruitee, type SonBruite } from "./voix-bruitee";

const corpsA = (decalageMaxSec: number): OptionsBruitee => ({ phrases: 4, decalageMaxSec, teteSec: [0.1, 0.4], queueSec: [0.3, 0.7] });
/** Fin : une phrase, fichier court presque tout en parole ; même voix, donc même bruit de fond (±1 dB). */
const finA = (decalageMaxSec: number, bruitDb: number): OptionsBruitee => ({ phrases: 1, decalageMaxSec, teteSec: [0.06, 0.35], queueSec: [0.25, 0.6], bruitDb });

/** Tolérances de la vérité (s) : bord d'attaque ou de fondu au-dessus du bruit mais sous le seuil mesuré. */
const BORD_SEC = 0.02;

interface Verdict {
  refusee: boolean;
  defauts: string[];
}

/** Même chemin que l'assemblage (`assemblerPiste`) : mesures (la fin reprend le plancher du corps), puis `couperVoixIV`. */
function couper(c: SonBruite, f?: SonBruite) {
  const corps = silencesIV(c.son);
  const fin = f ? silencesIV(f.son, REGLES_SILENCES_IV, corps.plancherDb) : undefined;
  const r = couperVoixIV({ mots: c.mots, dureeSec: c.dureeSec }, f ? { mots: f.mots, dureeSec: f.dureeSec } : undefined, { corps, ...(fin ? { fin } : {}) });
  return { refusee: r.hors.length > 0 || r.paroleRetiree.length > 0, plan: r.plan, mesures: { corps, fin } };
}

function verdict(c: SonBruite, f?: SonBruite): Verdict {
  const { refusee, plan, mesures } = couper(c, f);
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
        if (paroleDans(v, t - 0.01, t, 6) > 0 && paroleDans(v, t, t + 0.01, 6) > 0) defauts.push(`${nom} : coupe ${t} dans la parole`);
      }
    });
    const retires: [number, number][] = [[0, ms[0].debutSec], ...ms.slice(1).map((x, i): [number, number] => [ms[i].finSec, x.debutSec]), [ms[ms.length - 1].finSec, v.dureeSec]];
    for (const [a, b] of retires) {
      const p = paroleDans(v, a, b);
      if (p > BORD_SEC + 1e-6) defauts.push(`${nom} : ${a} → ${b} retiré, ${p.toFixed(3)} s de parole`);
    }
    v.vrais.forEach((w, k) => {
      const p = retires.reduce((s, [a, b]) => s + paroleDans(v, Math.max(a, w.debutSec), Math.min(b, w.finSec)), 0);
      if (p > BORD_SEC + 1e-6) defauts.push(`${nom} : ${k === 0 ? "PREMIER " : ""}mot ${w.mot} (${w.debutSec} → ${w.finSec}) perdu (${p.toFixed(3)} s)`);
    });
  }
  return { refusee, defauts };
}

/** Tranche de bruit du corps (2 dB) : « −46 à −44 », …, « −40 à −38 ». */
const tranche = (db: number) => {
  const bas = Math.max(-46, Math.min(-40, -2 * Math.ceil(-db / 2)));
  return `${bas} à ${bas + 2} dB`;
};

function serie(graines: number[], decalageMaxSec: number, avecFin: boolean) {
  const parTranche = new Map<string, { voix: number; refus: number }>();
  const defauts: string[] = [];
  let refus = 0;
  for (const g of graines) {
    const c = voixBruitee(g, corpsA(decalageMaxSec));
    const f = avecFin ? voixBruitee(g + 500_000, finA(decalageMaxSec, c.bruitDb + ((g % 3) - 1))) : undefined;
    const v = verdict(c, f);
    const t = parTranche.get(tranche(c.bruitDb)) ?? { voix: 0, refus: 0 };
    t.voix++;
    if (v.refusee) {
      t.refus++;
      refus++;
    }
    parTranche.set(tranche(c.bruitDb), t);
    for (const d of v.defauts) defauts.push(`graine ${g} : ${d}`);
  }
  const lignes = [...parTranche].sort().map(([k, x]) => `${k} : ${x.refus}/${x.voix} (${((100 * x.refus) / x.voix).toFixed(1).replace(".", ",")} %)`);
  return { refus, voix: graines.length, taux: refus / graines.length, lignes, defauts };
}

const graines = (de: number, n: number) => Array.from({ length: n }, (_, i) => de + i);

describe("coupes de l'assemblage sur des voix bruitées réalistes (relecture #283, 2e passage)", () => {
  for (const [decalage, nCorps, nFin, maxCorps, maxFin] of [
    [0.2, 400, 100, 0.06, 0.08],
    [0.25, 200, 50, 0.06, 0.08],
  ] as const) {
    it(`±${decalage} s : ${nCorps} voix corps seul, ${nFin} corps + fin : aucune parole retirée, aucun mot perdu, aucun morceau court, aucune coupe hors silence ; refus ≤ ${maxCorps * 100} % et ≤ ${maxFin * 100} %`, () => {
      const corps = serie(graines(1, nCorps), decalage, false);
      const fin = serie(graines(20_001, nFin), decalage, true);
      console.log(
        `±${decalage} s, corps seul : ${corps.refus}/${corps.voix} refusées (${(corps.taux * 100).toFixed(1)} %)\n  ${corps.lignes.join("\n  ")}\n` +
          `±${decalage} s, corps + fin : ${fin.refus}/${fin.voix} refusées (${(fin.taux * 100).toFixed(1)} %)\n  ${fin.lignes.join("\n  ")}`,
      );
      expect([...corps.defauts, ...fin.defauts]).toEqual([]);
      expect(corps.taux).toBeLessThanOrEqual(maxCorps);
      expect(fin.taux).toBeLessThanOrEqual(maxFin);
    }, 300_000);
  }
});

describe("mots perdus par le plan brut (horodatage en retard de plus que la durée du mot) : gardés", () => {
  // Graines où 2531254 acceptait la version en perdant un mot entier (le premier, ou un mot intérieur à ±0,25 s).
  for (const [decalage, g, mot] of [
    [0.2, 65, "m1"],
    [0.2, 188, "m1"],
    [0.2, 238, "m1"],
    [0.2, 286, "m1"],
    [0.25, 145, "m1"],
    [0.25, 163, "m1"],
    [0.25, 30, "m9"],
    [0.25, 171, "m7"],
  ] as const) {
    it(`±${decalage} s, graine ${g} : ${mot} est dans un morceau gardé, version acceptée`, () => {
      const c = voixBruitee(g, corpsA(decalage));
      const v = verdict(c);
      expect(v).toEqual({ refusee: false, defauts: [] });
      const w = c.vrais.find((x) => x.mot === mot)!;
      const { plan } = couper(c);
      expect(plan.morceaux.some((m) => m.debutSec <= w.debutSec + BORD_SEC && m.finSec >= w.finSec - BORD_SEC)).toBe(true);
    });
  }
});

describe("seuil de silence : plancher de bruit + 8 dB, garde-fou sous la parole", () => {
  it("voix bruitée de −46 à −38 dB : le seuil est de 3 à 7 dB au-dessus du bruit (−35 dB au plus), 7 dB au moins sous le mot le plus faible", () => {
    for (let g = 1; g <= 40; g++) {
      const v = voixBruitee(g, corpsA(0.2));
      const m = silencesIV(v.son);
      // p10 du fichier : 2 à 3 dB sous le niveau moyen du bruit (les pauses font 25 à 35 % du temps).
      expect(m.seuilDb - v.bruitDb, `graine ${g}`).toBeGreaterThanOrEqual(Math.min(3, -35 - v.bruitDb) - 1e-6);
      expect(m.seuilDb - v.bruitDb, `graine ${g}`).toBeLessThanOrEqual(7);
      expect(m.seuilDb).toBeLessThanOrEqual(REGLES_SILENCES_IV.plafondDb);
      expect(m.seuilDb).toBeLessThanOrEqual(Math.min(...v.vrais.map((w) => w.niveauDb)) - 7);
    }
  });

  it("fin courte presque tout en parole : le plancher du corps de la même voix est repris (le plus bas des deux)", () => {
    // 90 % de parole (−20 dB), 10 % de bruit (−44 dB) : le p10 propre tombe sur le bord de la parole.
    const niveaux = [...Array(8).fill(-44), ...Array(92).fill(-20)];
    expect(seuilSilenceIV(niveaux)).toBe(-35);
    expect(seuilSilenceIV(niveaux, REGLES_SILENCES_IV, -46)).toBe(-38);
    // Un plancher connu plus haut que le plancher propre ne relève jamais le seuil.
    expect(seuilSilenceIV([...Array(30).fill(-46), ...Array(70).fill(-14)], REGLES_SILENCES_IV, -40)).toBe(-38);
  });
});

describe("filet : un écart retiré qui contient de la parole est refusé", () => {
  /** Mesure fabriquée : fenêtres de 20 ms, parole (−18 dB, voisée) de `parole`, bruit (−44 dB) ailleurs. */
  const mesure = (dureeSec: number, parole: [number, number][]): MesureSonIV => {
    const niveaux = Array.from({ length: Math.round(dureeSec / 0.02) }, (_, w) => (parole.some(([a, b]) => w * 0.02 >= a - 1e-9 && w * 0.02 < b - 1e-9) ? -18 : -44));
    return { silences: [], seuilDb: -38, niveaux, fenetreSec: 0.02, niveauParoleDb: -24, voisees: niveaux.map((d) => d > -30) };
  };

  it("mot de 0,1 s dans la pause retirée : refusé, avec la phrase reconnue par « Refaire cette partie »", () => {
    const m = mesure(3, [
      [0.3, 1.0],
      [1.4, 1.5],
      [2.0, 2.6],
    ]);
    const plan = { morceaux: [{ debutSec: 0.2, finSec: 1.1, source: 0 as const }, { debutSec: 1.9, finSec: 2.7, source: 0 as const }] };
    const liste = paroleRetireeIV(plan, { corps: m }, { corps: 3 });
    expect(liste).toEqual([{ source: "corps", deSec: 1.1, aSec: 1.9, paroleSec: 0.1 }]);
    const e = refusParoleRetireeIV("(tiktok)", liste);
    expect(e.controle).toBe("coupe");
    expect(e.message).toContain(COUPE_EN_PLEIN_SON_IV);
    expect(e.message).toBe(
      "Voix (tiktok) · la coupe à 1,90 s du son du corps tombe en plein son, hors de tout silence mesuré : le son retiré avant elle contient de la parole, un mot serait perdu. Détail (écart retiré : parole mesurée) : corps 1,10 s → 1,90 s : 0,10 s de parole.",
    );
    // Avant le premier morceau, après le dernier : contrôlés aussi.
    expect(paroleRetireeIV({ morceaux: [{ debutSec: 0.5, finSec: 2.7, source: 0 }] }, { corps: m }, { corps: 3 }).map((x) => [x.deSec, x.aSec])).toEqual([[0, 0.5]]);
    // Une respiration (souffle non voisé, sous le niveau de la parole) se retire ; 20 ms de parole (un bord) aussi. 40 ms
    // (deux fenêtres : une voyelle isolée de 45 à 59 ms entière, relecture #283, 4e passage) : refusé.
    const sansMot = mesure(3, [
      [0.3, 1.0],
      [2.0, 2.6],
    ]);
    const souffle: MesureSonIV = { ...sansMot, niveaux: sansMot.niveaux.map((d, w) => (w >= 65 && w < 80 ? -26 : d)) };
    expect(paroleRetireeIV(plan, { corps: souffle }, { corps: 3 })).toEqual([]);
    expect(paroleRetireeIV({ morceaux: [{ debutSec: 0.2, finSec: 1.1, source: 0 }, { debutSec: 1.42, finSec: 2.7, source: 0 }] }, { corps: m }, { corps: 3 })).toEqual([]);
    expect(paroleRetireeIV({ morceaux: [{ debutSec: 0.2, finSec: 1.1, source: 0 }, { debutSec: 1.44, finSec: 2.7, source: 0 }] }, { corps: m }, { corps: 3 })).toEqual([{ source: "corps", deSec: 1.1, aSec: 1.44, paroleSec: 0.04 }]);
  });

  it("chapitres retirés exprès (version courte) : hors du filet", () => {
    const m = mesure(3, [
      [0.3, 1.0],
      [1.4, 1.5],
      [2.0, 2.6],
    ]);
    const plan = { morceaux: [{ debutSec: 0.2, finSec: 1.1, source: 0 as const }, { debutSec: 1.9, finSec: 2.7, source: 0 as const }] };
    expect(paroleRetireeIV(plan, { corps: m }, { corps: 3 }, [[1.4, 1.5]])).toEqual([]);
  });
});
