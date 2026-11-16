import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (p: string) => readFileSync(p, "utf8");

describe("REF-CARR-RESEAUX : habillage lu dans le source", () => {
  it("Titre.tsx retire 1 px par ligne de la hauteur offerte", () => {
    const s = lire("studio-rendu/compositions/visuels/commun/Titre.tsx");
    expect(s).toContain("const ARRONDI_PAR_LIGNE_PX = 1;");
    expect(s).toContain("hauteurMax: hauteurMax - maxLignes * ARRONDI_PAR_LIGNE_PX");
    expect(s).toContain("height: hauteurMax }");
  });
  it("T21 : interligne et marge basse de la phrase en grand", () => {
    const s = lire("studio-rendu/compositions/visuels/pages/T21.tsx");
    expect(s).toContain("const INTERLIGNE_PHRASE = 1.1;");
    expect(s).toContain("lineHeight: INTERLIGNE_PHRASE");
    expect(s).toContain("paddingBottom: margeBasTexte(TAILLE_PHRASE, INTERLIGNE_PHRASE)");
  });
});
