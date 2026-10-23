/** S2.4 — clients et logos (SITE-05), droits (SITE-06), cases « Avant de publier » (SITE-07). */
import { describe, expect, it } from "vitest";
import { controlerAvantSite, type EntreeControlesSite } from "@/domaine/site-videos/controles";
import { entreeOk } from "./helpers-controles";

const echecs = (e: EntreeControlesSite, code: string) => controlerAvantSite(e).controles.filter((c) => c.code === code && !c.ok);

describe("S2.4 SITE-05 : aucun client nommé, aucun logo", () => {
  it("une entrée « logo client » → échec", () => {
    const e = echecs(entreeOk({ entreeLogoClient: true }), "SITE-05");
    expect(e).toHaveLength(1);
    expect(e[0].message).toContain("Aucun client nommé, aucun logo");
  });
  it("case non cochée → échec ; cochée → vert", () => {
    expect(echecs(entreeOk({ caseAucunClient: false }), "SITE-05")).toHaveLength(1);
    expect(echecs(entreeOk({ caseAucunClient: true }), "SITE-05")).toEqual([]);
  });
});

describe("S2.4 SITE-06 : droits (images, polices, voix)", () => {
  it("une licence en défaut → échec", () => {
    const e = echecs(entreeOk({ licencesABloquer: 1 }), "SITE-06");
    expect(e).toHaveLength(1);
    expect(e[0].message).toContain("licence");
  });
  it("case « Droits » non cochée → échec", () => {
    expect(echecs(entreeOk({ avantDePublier: { image: true, son: true, sousTitres: true, mentionIA: true, droits: false } }), "SITE-06")).toHaveLength(1);
  });
  it("licences en règle et case cochée → vert", () => {
    expect(echecs(entreeOk(), "SITE-06")).toEqual([]);
  });
});

describe("S2.4 SITE-07 : cases « Avant de publier » du kit", () => {
  it("5 cases requises : une manquante → échec qui la nomme", () => {
    const e = echecs(entreeOk({ avantDePublier: { image: false, son: true, sousTitres: true, mentionIA: true, droits: true } }), "SITE-07");
    expect(e).toHaveLength(1);
    expect(e[0].message).toContain("Image");
    expect(e[0].message).not.toContain("Son");
  });
  it("plusieurs manquantes : toutes nommées", () => {
    const e = echecs(entreeOk({ avantDePublier: { image: false, son: false, sousTitres: true, mentionIA: true, droits: true } }), "SITE-07");
    expect(e[0].message).toContain("Image");
    expect(e[0].message).toContain("Son");
  });
  it("mention IA coupée → 4 cases suffisent", () => {
    const quatre = { image: true, son: true, sousTitres: true, mentionIA: false, droits: true };
    expect(echecs(entreeOk({ mentionIAActive: false, avantDePublier: quatre }), "SITE-07")).toEqual([]);
    // Mention IA active : la même coche manquante bloque.
    expect(echecs(entreeOk({ mentionIAActive: true, avantDePublier: quatre }), "SITE-07")).toHaveLength(1);
  });
  it("la vidéo n'est publiable que si les trois contrôles passent", () => {
    expect(controlerAvantSite(entreeOk()).publiable).toBe(true);
    expect(controlerAvantSite(entreeOk({ licencesABloquer: 2 })).publiable).toBe(false);
    expect(controlerAvantSite(entreeOk({ entreeLogoClient: true })).publiable).toBe(false);
  });
});
