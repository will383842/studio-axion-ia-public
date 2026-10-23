import { describe, expect, it } from "vitest";
import { validerProprietesPage } from "@/visuels/proprietes-page";
import { CONTENU_ESSAI_PDF } from "../../studio-rendu/scripts/contenu-essai-visuel";

describe("contenu inventé du PDF d'essai", () => {
  it("compte 9 pages, toutes valides au schéma Zod, sans chiffre ni adresse", () => {
    expect(CONTENU_ESSAI_PDF.pages).toHaveLength(9);
    for (let index = 0; index < 9; index++) validerProprietesPage({ spec: CONTENU_ESSAI_PDF, index });
    expect(JSON.stringify(CONTENU_ESSAI_PDF).replace(/"mini":"W\d+"/g, "").replace("carrousel/1", "").replace(/"type":"T0\d"/g, "")).not.toMatch(/\d|https?:|www\./);
  });
});
