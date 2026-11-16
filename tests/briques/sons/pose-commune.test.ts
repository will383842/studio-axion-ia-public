import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { poserBruitagesCommuns, type EntreePoseCommune } from "../../../src/briques/sons/pose-commune";
import type { EntreeSon } from "../../../src/briques/sons/types";
import { SONS } from "../../../src/briques/sons/registre";
import { poserBruitages, type EntreeBruitages } from "../../../src/moteurs/montage-cas-concret/bruitages";
import { ficheParGabarit } from "../../../src/moteurs/montage-cas-concret/ecriture";
import { ecransCales, motsOrange } from "../../../src/moteurs/montage-cas-concret/etapes";
import { cleMot, type EcranCorps } from "../../../src/moteurs/montage-cas-concret/fiche";
import { trouverCas } from "../../../src/formats/cas-concret/catalogue";
import type { BruitageValideCasConcret } from "../../../src/moteurs/montage-cas-concret/outils";
import type { DeclencheurBruitage, MotHorodate } from "../../../src/domaine/types";

const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const DECLENCHEURS = ["illustration-forte", "impact", "chiffre"] as const;

/** Sons validés de test (aucun son neuf : des doubles), famille = déclencheur. */
const sonsDe = (ds: readonly string[]): EntreeSon[] =>
  ds.flatMap((d) => [1, 2, 3].map((n) => ({ id: `t/${d}-${n}`, banque: "studio" as const, chemin: `${d}-${n}.wav`, famille: d, dureeSec: 0.3, droitId: "d", ecoute: "valide-par-decision" as const, posablePar: ["*" as const] })));
const valides = (ds: readonly string[]): BruitageValideCasConcret[] =>
  ds.flatMap((d) => [1, 2, 3].map((v) => ({ elementId: `t/${d}-${v}`, declencheur: d as DeclencheurBruitage, variante: v, dureeSec: 0.3, cle: `${d}-${v}.wav`, mime: "audio/wav" })));

/** Traduit une entrée du cas concret en instants génériques (mêmes heures que celles que le modèle calcule). */
function traduire(e: EntreeBruitages, ds: readonly string[]): EntreePoseCommune {
  const motsAppuyesSec: number[] = [];
  const chiffresSec: number[] = [];
  const changementsSec: number[] = [];
  e.cales.forEach((c, i) => {
    const ecran = e.ecrans[i];
    if (i > 0) changementsSec.push(c.debutMs / 1000);
    if (ecran) for (const m of motsOrange(ecran)) {
      const cle = cleMot(m);
      const dit = e.mots.find((x) => x.debutSec * 1000 >= c.debutMs - 1 && x.debutSec * 1000 < c.finMs && cleMot(x.mot) === cle);
      motsAppuyesSec.push(dit ? dit.debutSec : c.debutMs / 1000);
    }
    if (c.type === "chiffre") chiffresSec.push(c.debutMs / 1000);
  });
  return { changementsSec, motsAppuyesSec, chiffresSec, dureeSec: e.dureeSec, sons: sonsDe(ds) };
}

function jeu(duree: number, mots: MotHorodate[] = []): EntreeBruitages {
  const f = ficheParGabarit(trouverCas("recrutement-apporteurs")!, FIXE);
  let debut = 0;
  const corps = f.ecrans.map((x) => ({ ...x, debutMs: debut, finMs: (debut += duree) })) as EcranCorps[];
  const captures = Object.fromEntries(corps.filter((x) => x.type === "etape" && x.visuel.sorte === "ecran").map((x) => [x.id, { cle: `cap-${x.id}.jpg` }]));
  return { ecrans: corps, cales: ecransCales(corps, [], null, captures), mots, dureeSec: debut / 1000 + 2.1, valides: [] };
}

const instants = (l: readonly { declencheur: string; debutSec: number }[]) => l.map((b) => ({ declencheur: b.declencheur, debutSec: b.debutSec }));

describe("G2-04 · équivalence avec poserBruitages du cas concret", () => {
  const motsTest = (e: EntreeBruitages): MotHorodate[] =>
    e.ecrans.flatMap((x, i) => motsOrange(x).map((m) => ({ mot: m, debutSec: e.cales[i].debutMs / 1000 + 0.7, finSec: e.cales[i].debutMs / 1000 + 1 }) as MotHorodate));
  const cas: [string, EntreeBruitages, readonly string[]][] = [];
  const a = jeu(2000);
  cas.push(["écrans de 2 s, sans mots", a, DECLENCHEURS]);
  const b = jeu(1500);
  cas.push(["écrans de 1,5 s, mots dits", { ...b, mots: motsTest(b) }, DECLENCHEURS]);
  const c = jeu(2500);
  cas.push(["souffle seul (un seul son validé)", c, ["illustration-forte"]]);

  for (const [nom, e, ds] of cas) {
    it(nom, () => {
      const modele = poserBruitages({ ...e, valides: valides(ds) });
      const commun = poserBruitagesCommuns(traduire(e, ds));
      expect(modele.length).toBeGreaterThan(0);
      expect(instants(commun)).toEqual(instants(modele));
    });
  }
});

describe("G2-04 · règles", () => {
  const base = { changementsSec: [3, 6, 9], motsAppuyesSec: [4], chiffresSec: [7], dureeSec: 12 };
  it("aucun son validé : rien ; liste vide : []", () => {
    expect(poserBruitagesCommuns({ ...base, sons: [] })).toEqual([]);
    expect(poserBruitagesCommuns({ ...base, sons: SONS.filter((s) => s.ecoute === "porte-en-base") })).toEqual([]);
    expect(poserBruitagesCommuns({ changementsSec: [], motsAppuyesSec: [], chiffresSec: [], dureeSec: 0.5, sons: sonsDe(DECLENCHEURS) })).toEqual([]);
  });
  it("dernière seconde vide, clôture 1,5 s avant la fin, jamais deux sons au même instant", () => {
    const r = poserBruitagesCommuns({ ...base, changementsSec: [3, 6, 10.5, 11.5], chiffresSec: [3.0], sons: sonsDe(DECLENCHEURS) });
    expect(r.filter((x) => x.debutSec > 11)).toEqual([]);
    expect(r.at(-1)).toMatchObject({ declencheur: "impact", debutSec: 10.5 });
    for (let i = 1; i < r.length; i++) expect(r[i].debutSec - r[i - 1].debutSec).toBeGreaterThanOrEqual(0.1 - 1e-9);
  });
  it("porté en base : seulement s'il est dans validesEnBase (via choisirSon)", () => {
    const porte = sonsDe(["impact"]).map((s) => ({ ...s, ecoute: "porte-en-base" as const }));
    expect(poserBruitagesCommuns({ ...base, sons: porte })).toEqual([]);
    expect(poserBruitagesCommuns({ ...base, sons: porte, validesEnBase: new Set(porte.map((s) => s.id)) }).length).toBeGreaterThan(0);
  });
  it("déterministe ; durée bornée par la règle du déclencheur ; pas de répétition consécutive", () => {
    const e = { ...base, sons: sonsDe(DECLENCHEURS), graine: 4 };
    expect(poserBruitagesCommuns(e)).toEqual(poserBruitagesCommuns(e));
    for (const x of poserBruitagesCommuns(e)) expect(x.dureeSec).toBeLessThanOrEqual(0.3);
    const ids = poserBruitagesCommuns(e).filter((x) => x.declencheur === "illustration-forte").map((x) => x.id);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });
});

describe("G2-04 · garde statique", () => {
  const src = readFileSync("src/briques/sons/pose-commune.ts", "utf8");
  it("pas de @/services, Math.random, Date", () => {
    expect(src).not.toMatch(/@\/services|Math\.random|\bDate\b/);
  });
  it("index.ts des sons non modifié", () => {
    expect(execFileSync("git", ["diff", "--name-only", "origin/master", "--", "src/briques/sons/index.ts"]).toString().trim()).toBe("");
  });
});
