import { describe, expect, it } from "vitest";
import { listerFormats } from "@/formats";
import { listerCodes, codeDuFormat } from "@/formats/registre-codes";
import { DECLARATIONS } from "@/generateurs/declaration";

/** Codes de format qui ne sont pas un générateur vidéo (`VS` = visuels). */
const HORS_VIDEO = ["visuel"];

describe("codes de format contrôlés contre la déclaration (G1-05d)", () => {
  const actifs = listerCodes().filter((e) => !e.reserve && !e.archiveLe);

  it("chaque générateur déclaré a un code, non réservé, non archivé", () => {
    for (const id of Object.keys(DECLARATIONS)) {
      const entree = listerCodes().find((e) => e.formatId === id);
      expect(entree, `code manquant pour ${id}`).toBeDefined();
      expect(codeDuFormat(id)).toBe(entree?.code);
      expect(entree?.reserve, `${id} : code réservé`).toBeFalsy();
      expect(entree?.archiveLe, `${id} : code archivé`).toBeFalsy();
    }
  });

  it("sens inverse : chaque code actif a une déclaration, sauf les formats hors vidéo", () => {
    const sansDeclaration = actifs.filter((e) => !(e.formatId in DECLARATIONS)).map((e) => e.formatId);
    expect(sansDeclaration.sort()).toEqual([...HORS_VIDEO].sort());
  });

  it("les formats hors vidéo ne sont pas des formats du générateur vidéo", () => {
    const ids = listerFormats({ inclureMasques: true, inclureReservesAWill: true }).map((f) => f.id);
    for (const id of HORS_VIDEO) expect(ids).not.toContain(id);
  });

  it("aucun code ni identifiant de format en double", () => {
    const codes = listerCodes().map((e) => e.code);
    const ids = listerCodes().map((e) => e.formatId);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
