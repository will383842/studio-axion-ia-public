/** K2-T2-b1 : règle pure des sous-titres sélectifs (mots forts + nombres), sans appelant. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { motsClesSelectif, segmentsSelectifs } from "@/briques/composition/selectif-calque";
import { MOTS_FORTS } from "@/briques/sous-titres/typographie";
import type { SegmentSousTitres } from "@/domaine/types";

const FORT = [...MOTS_FORTS][0]!;
const mots = (phrase: string, debut: number) => phrase.split(" ").map((mot, i) => ({ mot, debutSec: debut + i * 0.3, finSec: debut + i * 0.3 + 0.25 }));
const groupes = (): SegmentSousTitres[] => [
  { id: "g1", debutSec: 0, finSec: 1.5, mots: mots("Vous gagnez 3 heures.", 0), style: "karaoke" as never, importance: 1, souligne: 2, position: "bas", verrouille: true },
  { id: "g2", debutSec: 2, finSec: 3.5, mots: mots("Bonjour à tous.", 2), style: "minimal" as never, importance: 0, souligne: null },
  { id: "g3", debutSec: 4, finSec: 5.5, mots: mots(`C'est ${FORT} pour vous.`, 4), style: "impact" as never, importance: 3, inclinaison: 3, position: "haut" },
];

describe("segmentsSelectifs : éteint = identique", () => {
  it("(a) false, undefined, « true » (texte) : copie égale, objet neuf, entrée intacte", () => {
    for (const actif of [false, undefined, "true" as unknown as boolean]) {
      const entree = groupes();
      const avant = structuredClone(entree);
      const sortie = segmentsSelectifs(entree, actif);
      expect(sortie).toEqual(entree);
      expect(sortie).not.toBe(entree);
      expect(sortie[0]).not.toBe(entree[0]);
      expect(entree).toEqual(avant);
    }
  });
});

describe("segmentsSelectifs : allumé", () => {
  it("(b) garde nombre et mot fort, vide le reste sans toucher au minutage ni au style", () => {
    const entree = groupes();
    const s = segmentsSelectifs(entree, true);
    expect(s[0]).toEqual(entree[0]);
    expect(s[1]!.mots).toEqual([]);
    for (const k of ["id", "debutSec", "finSec", "style", "importance", "souligne"] as const) expect(s[1]![k]).toEqual(entree[1]![k]);
    expect(s[2]).toEqual(entree[2]);
    expect(entree).toEqual(groupes());
  });

  it("(d) champs propres conservés sur les groupes gardés", () => {
    const s = segmentsSelectifs(groupes(), true);
    expect(s[0]).toMatchObject({ souligne: 2, position: "bas", verrouille: true });
    expect(s[2]).toMatchObject({ inclinaison: 3, position: "haut" });
  });

  it("(e) entrée hostile : jamais d'exception, copie égale", () => {
    const hostile = [{ id: "x", debutSec: 0, finSec: 1 }, null] as unknown as SegmentSousTitres[];
    expect(() => segmentsSelectifs(hostile, true)).not.toThrow();
    expect(segmentsSelectifs(hostile, true)).toEqual(hostile);
    expect(motsClesSelectif(hostile as never)).toEqual([]);
  });
});

describe("motsClesSelectif", () => {
  it("(c) uniquement des mots de MOTS_FORTS, sans doublon, ordre d'apparition", () => {
    const g = [{ mots: mots(`${FORT} bonjour ${FORT.toUpperCase()}`, 0) }, { mots: mots(`${FORT}`, 3) }];
    const r = motsClesSelectif(g);
    expect(r).toEqual([FORT]);
    for (const m of motsClesSelectif(groupes())) expect(MOTS_FORTS.has(m.toLowerCase())).toBe(true);
  });
  it("(c) [] sur groupes vides ou sans mot fort", () => {
    expect(motsClesSelectif([])).toEqual([]);
    expect(motsClesSelectif([{ mots: [] }, { mots: mots("Bonjour à tous", 0) }])).toEqual([]);
  });
});

describe("garde statique : pièce en avance", () => {
  const racine = join(__dirname, "../../../src");
  const sources = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
  const propre = join(racine, "briques/composition/selectif-calque.ts");
  it("(f) aucun fichier de src n'importe selectif-calque", () => {
    expect(sources(racine).filter((p) => p !== propre && /selectif-calque/.test(readFileSync(p, "utf8")))).toEqual([]);
  });
  it("(f) ni @/ ni lireParametre dans le module", () => {
    const t = readFileSync(propre, "utf8");
    expect(t).not.toMatch(/from\s+["']@\//);
    expect(t).not.toMatch(/lireParametre/);
  });
});
