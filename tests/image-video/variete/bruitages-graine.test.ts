/** Variété IV · lot TIR : le point de départ des variantes de bruitage vient de la graine (doc 72 § 7 point 3). */
import { describe, expect, it } from "vitest";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import { poserBruitagesIV, type BruitageValideIV, type EvenementIV } from "@/moteurs/montage-image-video/bruitages";

const valides: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const evenements: EvenementIV[] = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, genre: "noeud" as const, instantSec: 1 + i * 1.5 }));
const pose = (graine?: string) => {
  const r = poserBruitagesIV({ evenements, dureeSec: 20, valides, graine });
  if (!r.ok) throw new Error(r.motif);
  return r.bruitages;
};
const ids = (graine?: string) => pose(graine).map((b) => b.elementId);

describe("bruitages · point de départ tiré de la graine", () => {
  it("sans graine : identique à l'appel sans le champ", () => {
    const r = poserBruitagesIV({ evenements, dureeSec: 20, valides });
    expect(r.ok && r.bruitages.map((b) => b.elementId)).toEqual(ids(undefined));
  });
  it("même graine, même pose", () => expect(ids("v1")).toEqual(ids("v1")));
  it("des graines différentes ne partent pas toutes de la même variante", () => {
    const departs = new Set(Array.from({ length: 12 }, (_, i) => ids(`video-${i}`)[0]));
    expect(departs.size).toBeGreaterThan(1);
  });
  it("mêmes instants et mêmes durées ; jamais deux fois la même variante de suite", () => {
    const a = pose();
    const b = pose("video-3");
    expect(b.map((x) => x.debutSec)).toEqual(a.map((x) => x.debutSec));
    for (let i = 1; i < b.length; i++) if (b[i].declencheur === b[i - 1].declencheur) expect(b[i].elementId).not.toBe(b[i - 1].elementId);
  });
});
