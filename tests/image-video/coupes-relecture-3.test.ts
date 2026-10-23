/**
 * 16/10 (relecture #283, 3e passage, À CORRIGER) : sur le générateur du relecteur (`voix-relecture-3.ts` : bruits tonal,
 * souffle HF, rose, brun + souffle ; voyelles isolées de 60 à 120 ms ; fricatives « s » et « ch » ; respirations en bande
 * 1,5 kHz), des mots faibles ENTIERS étaient retirés sans refus : la « parole » (`paroleDans`) n'était que le niveau de
 * la parole (seuil + 14 dB) ou une voix « voisée » (seuil + 6 dB et moins de 2 000 passages par zéro), et le filet
 * utilisait la même définition. Chaque version ACCEPTÉE est ici vérifiée contre la vérité du générateur :
 *  - aucun son audible retiré (mots seuls à 3 dB au moins au-dessus du bruit) de plus de 20 ms par écart retiré,
 *    fricatives comprises ; aucun mot amputé de plus de 20 ms, le premier compris ;
 *  - aucun morceau de moins de 0,05 s, ordre strict, jamais deux morceaux collés ;
 *  - aucune coupe hors d'un silence mesuré, ni dans un son de la vérité (audible des deux côtés) ;
 * et le taux de refus est donné par tranche de bruit (−50 à −35 dB), plus un fond à −60 dB et à −35 dB.
 */
import { describe, expect, it } from "vitest";
import { paroleDans } from "@/moteurs/montage-image-video/assemblage";
import { hasard } from "./voix-bruitee";
import { BORD_SEC, TYPES_BRUIT_R3, corpsR3, couperR3, finR3, verdictR3, voixR3, type OptionsR3 } from "./voix-relecture-3";

const TRANCHES: [number, number][] = [
  [-50, -46],
  [-46, -42],
  [-42, -38],
  [-38, -35],
];

/** Voix `i` d'une tranche : bruit tiré dans la tranche, type de bruit en rotation. */
function voixDeTranche(ti: number, i: number, avecFin: boolean) {
  const g = (avecFin ? 50_000 : 0) + ti * 1000 + i;
  const [lo, hi] = TRANCHES[ti];
  const bruitDb = lo + hasard(g * 3 + 1)() * (hi - lo);
  const type = TYPES_BRUIT_R3[i % 4];
  const c = voixR3(g, corpsR3(bruitDb, type));
  const f = avecFin ? voixR3(g + 500_000, finR3(bruitDb + ((g % 3) - 1), type, c.voixDb)) : undefined;
  return { g, c, f };
}

function serieR3(n: number, avecFin: boolean, tranches = [0, 1, 2, 3]) {
  const lignes: string[] = [];
  const defauts: string[] = [];
  const par: Record<number, { voix: number; refus: number; fautives: number }> = {};
  for (const ti of tranches) {
    const x = (par[ti] = { voix: 0, refus: 0, fautives: 0 });
    for (let i = 0; i < n; i++) {
      const { g, c, f } = voixDeTranche(ti, i, avecFin);
      const v = verdictR3(c, f);
      x.voix++;
      if (v.refusee) x.refus++;
      if (v.defauts.length) x.fautives++;
      for (const d of v.defauts) defauts.push(`graine ${g} (${c.typeBruit}, ${c.bruitDb.toFixed(1)} dB) : ${d}`);
    }
    lignes.push(`${TRANCHES[ti][0]} à ${TRANCHES[ti][1]} dB : ${x.refus}/${x.voix} refus (${((100 * x.refus) / x.voix).toFixed(1)} %), ${x.fautives} acceptées avec défaut`);
  }
  return { par, lignes, defauts };
}

/** Fond fixe (−60 dB : propre ; −35 dB : fort) : `n` voix, types de bruit en rotation. */
function serieFond(bruitDb: number, n: number) {
  let refus = 0;
  const defauts: string[] = [];
  for (let i = 0; i < n; i++) {
    const g = 90_000 + Math.round(-bruitDb) * 1000 + i;
    const c = voixR3(g, corpsR3(bruitDb, TYPES_BRUIT_R3[i % 4]));
    const v = verdictR3(c);
    if (v.refusee) refus++;
    for (const d of v.defauts) defauts.push(`graine ${g} : ${d}`);
  }
  return { refus, defauts };
}

const taux = (s: ReturnType<typeof serieR3>, tranches: number[]) => {
  const v = tranches.reduce((a, t) => a + s.par[t].voix, 0);
  return tranches.reduce((a, t) => a + s.par[t].refus, 0) / v;
};

describe("relecture #283, 3e passage : générateur du relecteur", () => {
  it("600 voix corps seul (150 par tranche, −50 à −35 dB) : aucune version acceptée ne perd de son ; refus ≤ 6 % de −50 à −38 dB", () => {
    const s = serieR3(150, false);
    console.log(`corps seul :\n  ${s.lignes.join("\n  ")}`);
    expect(s.defauts.slice(0, 20)).toEqual([]);
    expect(taux(s, [0, 1, 2])).toBeLessThanOrEqual(0.06);
  }, 300_000);

  it("160 voix corps + fin (40 par tranche) : aucune version acceptée ne perd de son ; refus ≤ 8 % de −50 à −38 dB", () => {
    const s = serieR3(40, true);
    console.log(`corps + fin :\n  ${s.lignes.join("\n  ")}`);
    expect(s.defauts.slice(0, 20)).toEqual([]);
    expect(taux(s, [0, 1, 2])).toBeLessThanOrEqual(0.08);
  }, 300_000);

  it("fond à −60 dB (80 voix) : 0 refus, 0 défaut ; fond à −35 dB (80 voix) : aucun son perdu", () => {
    const propre = serieFond(-60, 80);
    const fort = serieFond(-35, 80);
    console.log(`fond −60 dB : ${propre.refus}/80 refus ; fond −35 dB : ${fort.refus}/80 refus`);
    expect(propre).toEqual({ refus: 0, defauts: [] });
    expect(fort.defauts).toEqual([]);
  }, 300_000);
});

describe("relecture #283, 3e passage : graines-types (mot faible ENTIER perdu sans refus en 4b29816)", () => {
  const ronflement7 = corpsR3(-41, "ronflement", { voixDb: -34 });
  const souffle19 = corpsR3(-46.4, "souffle-hf", { voixDb: -27.4 });
  const premierA = corpsR3(-38.2, "ronflement", { voixDb: -29.5, premierMot: "a" });
  const cas: [string, number, OptionsR3, string][] = [
    ["voyelle isolée « y » à bruit + 7 dB sous un ronflement", 556, ronflement7, "m14"],
    ["voyelle isolée « y » à bruit + 7 dB sous un ronflement", 581, ronflement7, "m18"],
    ["« y » sous un souffle HF, à bruit + 19 dB", 346, souffle19, "m5"],
    ["« y » sous un souffle HF, à bruit + 19 dB", 414, souffle19, "m19"],
    ["premier mot « a » sous le seuil + 6 dB", 20, premierA, "m1"],
    ["premier mot « a » sous le seuil + 6 dB", 97, premierA, "m1"],
    ["premier mot « a » sous le seuil + 6 dB", 279, premierA, "m1"],
  ];
  for (const [nom, g, o, mot] of cas) {
    it(`${nom} (graine ${g}, ${mot}) : vu comme de la parole, gardé entier, version acceptée`, () => {
      const c = voixR3(g, o);
      const w = c.vrais.find((x) => x.mot.replace(".", "") === mot)!;
      const { plan, mesures } = couperR3(c);
      // Le mot est de la parole (même définition que le filet) sur la moitié de sa durée au moins.
      expect(paroleDans(mesures.corps, w.debutSec, w.finSec)).toBeGreaterThanOrEqual((w.finSec - w.debutSec) / 2);
      expect(plan.morceaux.some((m) => !m.silence && m.debutSec <= w.debutSec + BORD_SEC && m.finSec >= w.finSec - BORD_SEC)).toBe(true);
      expect(verdictR3(c)).toEqual({ refusee: false, defauts: [] });
    });
  }
});
