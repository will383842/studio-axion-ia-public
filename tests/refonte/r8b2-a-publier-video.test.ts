/** Refonte R8b2 : « À publier », la carte de vidéo porte le liseré et la tuile de la famille Vidéo (maquette M5, `.ligne.f-video`). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/publication/LignesAPublier.tsx", "utf-8");
const CLASSE_ORANGE = /(?:bg|text|border|shadow|ring|outline)-orange|hover:border-orange|focus:border-orange/;

describe("R8b2 : liseré Vidéo sur « À publier »", () => {
  it("liseré gauche de la famille Vidéo sur la carte", () => {
    expect(src).toContain("border-l-[5px]");
    expect(src).toContain("border-l-fam-video");
  });
  it("tuile d'icône film en jetons Vidéo, avec le mot « Vidéo » écrit", () => {
    expect(src).toContain("bg-fam-video-doux text-fam-video");
    expect(src).toContain('<Icone nom="film"');
    expect(src).toMatch(/>Vidéo<\/span>/);
  });
  it("aucun orange, aucun prix", () => {
    expect(src).not.toMatch(CLASSE_ORANGE);
  });
});
