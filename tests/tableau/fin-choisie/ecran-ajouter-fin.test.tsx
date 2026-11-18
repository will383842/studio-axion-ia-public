/** FIX-TABLEAU-FIN-CHOISIE-b : l'écran de création propose « Ajouter cette fin à mon texte », sur clic seulement. Lecture du .tsx. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(process.cwd(), "src", "components", "formats", "tableau-anime", "NouvelleVideoTableau.tsx"), "utf8");

describe("écran de création : ajouter la fin choisie", () => {
  it("(b) la phrase d'avertissement et le bouton existent, sous le choix de la fin", () => {
    expect(src).toContain("Cette fin n'est pas dans votre texte : elle ne sera ni dite ni écrite.");
    expect(src).toContain("Ajouter cette fin à mon texte");
    expect(src.indexOf("valeur={saisie.finId}")).toBeLessThan(src.indexOf("Ajouter cette fin à mon texte"));
  });
  it("(b) mot vide : bouton désactivé avec le message", () => {
    expect(src).toContain("disabled={!finAAjouter.phrase}");
    expect(src).toContain("Écrivez d'abord le mot à commenter.");
  });
  it("(b) affiché seulement si une fin est choisie et absente du texte (fin « Aucune » : rien)", () => {
    expect(src).toMatch(/if \(!fin \|\| !saisie\.texte\.trim\(\)\) return null;/);
    expect(src).toMatch(/texteAvecFin\(saisie\.texte, phrase\) === saisie\.texte \? null/);
  });
  it("rien n'est ajouté sans clic : le texte ne change que dans le onClick du bouton, par texteAvecFin", () => {
    const occ = src.split("texteAvecFin(").length - 1;
    expect(occ).toBe(2); // le calcul de l'affichage (lecture) et le clic
    expect(src).toMatch(/onClick=\{\(\) => finAAjouter\.phrase && changer\(\{ texte: texteAvecFin\(saisie\.texte, finAAjouter\.phrase\) \}\)\}/);
  });
});
