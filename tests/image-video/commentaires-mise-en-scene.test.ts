/** Chaque fonction de la mise en scène porte son propre commentaire, juste au-dessus d'elle. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LIGNES = readFileSync("src/moteurs/montage-image-video/mise-en-scene.ts", "utf8").split("\n");
const au_dessus = (fonction: string) => LIGNES[LIGNES.findIndex((l) => l.startsWith(`function ${fonction}(`)) - 1];

describe("commentaires de la mise en scène", () => {
  it("le commentaire de phraseChocDe est au-dessus de phraseChocDe", () => {
    expect(au_dessus("phraseChocDe")).toMatch(/^\/\*\* Phrase-choc/);
  });

  it("le commentaire de tamponDe est au-dessus de tamponDe", () => {
    expect(au_dessus("tamponDe")).toMatch(/^\/\*\* Étapes du tampon/);
  });
});
