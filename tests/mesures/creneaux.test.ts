import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEUIL_CASE, classerCreneaux, jourEtTrancheParis, libelleCase, type ContenuPlace } from "@/domaine/mesures-creneaux";

const c = (date: string, position: number | null, reseau = "tiktok", type: "video" | "carrousel" = "video"): ContenuPlace => ({ reseau, type, date, position });

describe("jourEtTrancheParis", () => {
  it("passage à l'heure d'été (29/03/2026)", () => {
    expect(jourEtTrancheParis("2026-03-29T00:30:00Z")).toEqual({ jour: 7, tranche: 0 }); // 01 h 30 à Paris
    expect(jourEtTrancheParis("2026-03-29T01:30:00Z")).toEqual({ jour: 7, tranche: 1 }); // 03 h 30 à Paris
  });
  it("retour à l'heure d'hiver (25/10/2026)", () => {
    expect(jourEtTrancheParis("2026-10-25T00:30:00Z")).toEqual({ jour: 7, tranche: 1 }); // 02 h 30 (été)
    expect(jourEtTrancheParis("2026-10-25T01:30:00Z")).toEqual({ jour: 7, tranche: 1 }); // 02 h 30 (hiver)
  });
  it("22 h 59 et 23 h 00 à Paris : tranche 11", () => {
    expect(jourEtTrancheParis("2026-01-14T21:59:00Z").tranche).toBe(11);
    expect(jourEtTrancheParis("2026-01-14T22:00:00Z").tranche).toBe(11);
    expect(jourEtTrancheParis("2026-01-14T20:59:00Z").tranche).toBe(10);
  });
  it("dimanche 23 h 59 → lundi à minuit (Paris)", () => {
    expect(jourEtTrancheParis("2026-01-18T22:59:00Z")).toEqual({ jour: 7, tranche: 11 });
    expect(jourEtTrancheParis("2026-01-18T23:00:00Z")).toEqual({ jour: 1, tranche: 0 });
  });
});

describe("classerCreneaux", () => {
  const mardi8h = (n: number) => `2026-01-13T0${7}:${10 + n}:00Z`; // mardi 08 h Paris
  it("une case de 2 contenus est « trop tôt », sans médiane", () => {
    const r = classerCreneaux([c(mardi8h(0), 0.9), c(mardi8h(1), 0.5)]);
    expect(r[0].cases[0]).toMatchObject({ jour: 2, tranche: 4, nombre: 2, mediane: null, etat: "trop-tot" });
  });
  it("une case de 3 contenus donne la médiane", () => {
    const r = classerCreneaux([c(mardi8h(0), 0.9), c(mardi8h(1), 0.1), c(mardi8h(2), 0.5)]);
    expect(SEUIL_CASE.valeur).toBe(3);
    expect(r[0].cases[0]).toMatchObject({ nombre: 3, mediane: 0.5, etat: "lu" });
  });
  it("position null : exclue et comptée non mesurée, jamais zéro", () => {
    const r = classerCreneaux([c(mardi8h(0), null), c(mardi8h(1), 0.5), c(mardi8h(2), 0.7), c(mardi8h(3), 0.9)]);
    expect(r[0].nonMesures).toBe(1);
    expect(r[0].cases[0]).toMatchObject({ nombre: 3, mediane: 0.7 });
  });
  it("date absente ou illisible : exclue et comptée non mesurée, sans exception", () => {
    const r = classerCreneaux([c("", 0.5), c("pas une date", 0.5)]);
    expect(r).toEqual([{ reseau: "tiktok", type: "video", cases: [], nonMesures: 2 }]);
  });
  it("vidéo et carrousel sont séparés, réseaux aussi", () => {
    const r = classerCreneaux([c(mardi8h(0), 0.5), c(mardi8h(1), 0.5, "tiktok", "carrousel"), c(mardi8h(2), 0.5, "instagram")]);
    expect(r).toHaveLength(3);
    expect(r.every((g) => g.cases[0].nombre === 1)).toBe(true);
  });
  it("cases triées : lues d'abord, médiane décroissante", () => {
    const lun = (h: string, p: number) => c(`2026-01-12T${h}:00:00Z`, p);
    const r = classerCreneaux([lun("09", 0.2), lun("09", 0.3), lun("09", 0.4), lun("13", 0.8), lun("13", 0.9), lun("13", 0.7), lun("15", 0.9)]);
    expect(r[0].cases.map((x) => [x.tranche, x.etat])).toEqual([[7, "lu"], [5, "lu"], [8, "trop-tot"]]);
  });
  it("groupe ne contenant que des non mesurés : présent, sans case", () => {
    const r = classerCreneaux([c(mardi8h(0), null)]);
    expect(r).toEqual([{ reseau: "tiktok", type: "video", cases: [], nonMesures: 1 }]);
  });
});

describe("libelleCase", () => {
  it("formate en français", () => {
    expect(libelleCase(2, 4)).toBe("mardi, 08 h – 10 h (heure de Paris)");
    expect(libelleCase(7, 11)).toBe("dimanche, 22 h – 24 h (heure de Paris)");
  });
});

describe("pureté", () => {
  it("aucun import de service, fournisseur, réglage ou dépôt", () => {
    const src = readFileSync("src/domaine/mesures-creneaux.ts", "utf8");
    for (const interdit of ["@/services", "@/fournisseurs", "lireParametre", "depots", "server-only"]) expect(src).not.toContain(interdit);
  });
});
