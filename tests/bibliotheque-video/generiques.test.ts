import { describe, it, expect } from "vitest";
import { CATALOGUE_CAPACITES } from "@/briques/bibliotheque-video/catalogue";
import { ID, familleDe } from "@/briques/bibliotheque-video/noms";
import { LIGNES_GENERIQUES, ALIAS_GENERIQUES, generiqueDe, aliasDe } from "@/briques/bibliotheque-video/catalogue/generiques";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const GENERIQUES: IdCapacite[] = [ID.texteSousTitres, ID.planScenesGenerique, ID.sonPose, ID.etalonnageLut];
const dansCatalogue = (id: string) => CATALOGUE_CAPACITES.some((l) => l.id === id);

describe("G2-02 · identifiants génériques", () => {
  it("4 lignes exactes, état prevu, figées", () => {
    expect(LIGNES_GENERIQUES.map((l) => l.id)).toEqual(GENERIQUES);
    for (const l of LIGNES_GENERIQUES) {
      expect(l).toEqual({ id: l.id, etat: "prevu", chantier: "E2 (G2-02, G2-03)", note: "générique : lit ses alias par format" });
      expect(Object.isFrozen(l)).toBe(true);
    }
    expect(Object.isFrozen(LIGNES_GENERIQUES)).toBe(true);
    expect(Object.isFrozen(ALIAS_GENERIQUES)).toBe(true);
  });
  it("chaque générique est dans ID et dans le catalogue", () => {
    for (const g of GENERIQUES) {
      expect(Object.values(ID)).toContain(g);
      expect(dansCatalogue(g), g).toBe(true);
    }
  });
  it("alias : existants, même famille, uniques, jamais le générique lui-même, jamais coulisse", () => {
    expect(Object.keys(ALIAS_GENERIQUES).sort()).toEqual([...GENERIQUES].sort());
    const vus = new Set<string>();
    for (const g of GENERIQUES) {
      for (const a of aliasDe(g)) {
        expect(dansCatalogue(a), a).toBe(true);
        expect(familleDe(a)).toBe(familleDe(g));
        expect(a).not.toBe(g);
        expect(GENERIQUES).not.toContain(a);
        expect(a.startsWith("motion.v4-coulisse.")).toBe(false);
        expect(vus.has(a), a).toBe(false);
        vus.add(a);
      }
    }
  });
  it("alias attendus", () => {
    expect(aliasDe(ID.texteSousTitres)).toEqual([ID.texteSousTitresV4]);
    expect(aliasDe(ID.planScenesGenerique)).toEqual([ID.planScenesCasConcret, ID.planScenesFacecam, ID.planScenesFacecamAnimee]);
    expect(aliasDe(ID.sonPose)).toEqual([ID.sonBanqueStudio, ID.sonV4]);
    expect(aliasDe(ID.etalonnageLut)).toHaveLength(5);
  });
  it("generiqueDe / aliasDe réciproques", () => {
    for (const g of GENERIQUES) for (const a of aliasDe(g)) expect(generiqueDe(a)).toBe(g);
    expect(generiqueDe(ID.textePave)).toBeUndefined();
    expect(generiqueDe(ID.sonPose)).toBeUndefined();
    expect(aliasDe(ID.textePave)).toEqual([]);
  });
});
