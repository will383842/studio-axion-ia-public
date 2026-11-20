/**
 * ICONES-UNIQUES : deux formats masqués déclaraient une icône déjà prise (`baguette`, `ecran-partage`).
 * Ce test fige les deux icônes choisies et l'unicité sur tous les formats, masqués compris. Test pur.
 */
import { describe, expect, it } from "vitest";
import { listerFormats, trouverFormat } from "@/formats";

describe("icônes des formats", () => {
  it("tutoriel-outil porte l'icône « appareils »", () => {
    expect(trouverFormat("tutoriel-outil")?.icone).toBe("appareils");
  });

  it("demo-facecam porte l'icône « visage »", () => {
    expect(trouverFormat("demo-facecam")?.icone).toBe("visage");
  });

  it("toutes les icônes, formats masqués compris, sont uniques", () => {
    const icones = listerFormats({ inclureMasques: true }).map((f) => f.icone);
    const doublons = icones.filter((icone, i) => icones.indexOf(icone) !== i);
    expect(doublons).toEqual([]);
  });
});
