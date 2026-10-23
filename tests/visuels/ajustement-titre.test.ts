import { describe, expect, it } from "vitest";
import { ajusterTailleTitre, choisirMiseEnLignes, decouperTitre } from "../../studio-rendu/compositions/visuels/commun/ajustement";

/** Largeur simulée : 0,62 em par caractère de la ligne la plus longue (monotone en la taille). */
const mesure = (lignes: string[], taille: number) => Math.max(...lignes.map((l) => l.length)) * 0.62 * taille;

describe("ajustement du titre (M1-03) : fonction pure", () => {
  it("la dichotomie amène la ligne la plus large à 984 ± 4 px", () => {
    for (const texte of ["Six tâches de bureau", "Un bureau en ordre", "Ranger, classer, répondre"]) {
      const r = ajusterTailleTitre((t) => mesure([texte], t));
      if (r.borne === null) expect(Math.abs(r.largeur - 984)).toBeLessThanOrEqual(4);
      if (r.borne !== "min") expect(r.largeur).toBeLessThanOrEqual(988);
    }
    const r = ajusterTailleTitre((t) => mesure(["abcdefghijklmnop"], t));
    expect(r.borne).toBeNull();
    expect(r.taille).toBeGreaterThanOrEqual(90);
    expect(r.taille).toBeLessThanOrEqual(170);
    expect(Math.abs(r.largeur - 984)).toBeLessThanOrEqual(4);
  });

  it("borne haute : une ligne très courte reste à 170 px (ligne plus étroite que 984)", () => {
    const r = ajusterTailleTitre((t) => mesure(["Un"], t));
    expect(r).toMatchObject({ taille: 170, borne: "max" });
    expect(r.largeur).toBeLessThan(984);
  });

  it("borne basse : une ligne très longue reste à 90 px", () => {
    const r = ajusterTailleTitre((t) => mesure(["x".repeat(60)], t));
    expect(r).toMatchObject({ taille: 90, borne: "min" });
  });

  it("respecte des bornes passées en option et reste dans [min, max]", () => {
    const r = ajusterTailleTitre((t) => mesure(["abcdefghij"], t), { min: 100, max: 120 });
    expect(r.taille).toBeGreaterThanOrEqual(100);
    expect(r.taille).toBeLessThanOrEqual(120);
  });

  it("découpe en lignes équilibrées, sans casser un mot ni perdre un caractère", () => {
    const titre = "Six tâches qui rythment un bureau ordinaire";
    for (const n of [1, 2, 3, 4]) {
      const lignes = decouperTitre(titre, n);
      expect(lignes.length).toBeLessThanOrEqual(n);
      expect(lignes.join(" ")).toBe(titre);
    }
    const trois = decouperTitre(titre, 3);
    const longueurs = trois.map((l) => l.length);
    expect(Math.max(...longueurs) - Math.min(...longueurs)).toBeLessThanOrEqual(8);
    expect(decouperTitre("Un", 3)).toEqual(["Un"]);
  });

  it("choisit le nombre de lignes : le plus grand corps qui tient en hauteur", () => {
    const titre = "Six tâches qui rythment un bureau";
    const choix = choisirMiseEnLignes(titre, mesure, { maxLignes: 4, hauteurMax: 900 });
    expect(choix.lignes.join(" ")).toBe(titre);
    expect(choix.taille).toBeGreaterThanOrEqual(90);
    expect(choix.lignes.length * choix.taille * 1.02).toBeLessThanOrEqual(900 + 1);
    // une hauteur impossible à tenir : on garde la mise en lignes la moins haute, sans jamais déborder en largeur
    const serre = choisirMiseEnLignes(titre, mesure, { maxLignes: 4, hauteurMax: 100 });
    expect(serre.largeur).toBeLessThanOrEqual(988);
    const hauteurs = [1, 2, 3, 4].map((n) => {
      const l = decouperTitre(titre, n);
      const r = ajusterTailleTitre((t) => mesure(l, t));
      return r.largeur <= 988 ? l.length * r.taille * 1.02 : Infinity;
    });
    expect(serre.lignes.length * serre.taille * 1.02).toBeCloseTo(Math.min(...hauteurs), 5);
  });

  it("ne laisse aucun mot isolé sur une ligne quand une autre mise en lignes tient", () => {
    const choix = choisirMiseEnLignes("Six tâches qui rythment un bureau", mesure, { maxLignes: 4, hauteurMax: 968 });
    if (choix.lignes.length > 1) for (const l of choix.lignes) expect(l).toContain(" ");
  });

  it("lève une erreur claire quand aucune mise en lignes ne tient en largeur", () => {
    expect(() => choisirMiseEnLignes("Anticonstitutionnellement", mesure, { maxLignes: 4, hauteurMax: 968 })).toThrow(/ne tient pas/);
  });
});
