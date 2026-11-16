/** REF-CARR-RESEAUX-2 : le titre mesure l'encre réelle de Manrope 800 et la range dans l'état (même encre à l'ajustement et au dessin). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const titre = readFileSync("studio-rendu/compositions/visuels/commun/Titre.tsx", "utf8");

describe("REF-CARR-RESEAUX-2", () => {
  it("Titre mesure l'encre dans Manrope après le chargement de la police et l'utilise à l'ajustement et au dessin", () => {
    expect(titre).toContain("actualBoundingBoxAscent");
    expect(titre).toContain("actualBoundingBoxDescent");
    expect(titre).toMatch(/hauteur: \(lignes, taille\) => hauteurTitre\(lignes, taille, encre\)/);
    expect(titre).toMatch(/setMise\(\{ \.\.\.choix, interligne, haut: d\.haut, bas: d\.bas \}\)/);
  });
});
