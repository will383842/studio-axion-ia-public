import { describe, expect, it } from "vitest";
import { DELAI_DELAYRENDER_MS, DELAI_POLICE_MS, DELAI_TITRES_MS } from "../../studio-rendu/compositions/visuels/commun/attente-police";
import { attendreTitres } from "../../studio-rendu/compositions/visuels/mesure/attente-titres";
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
  });

  it("ajuste AUSSI le corps à la hauteur : deux lignes de mots longs au corps de la largeur (≈ 160 px) débordaient de 19 à 35 px", () => {
    // Deux mots de 12 signes : une seule ligne ne tient pas en largeur au corps minimal, deux lignes donneraient ≈ 164 px, soit 2 × 1,02 × corps > 302 px.
    const largeurs = (lignes: string[], taille: number) => Math.max(...lignes.map((l) => l.length)) * 0.5 * taille;
    const choix = choisirMiseEnLignes("Construisons messageries", largeurs, { maxLignes: 2, hauteurMax: 302 });
    expect(choix.lignes).toHaveLength(2);
    expect(choix.lignes.length * choix.taille * 1.02).toBeLessThanOrEqual(302 + 0.01);
    expect(choix.largeur).toBeLessThanOrEqual(988);
    // le corps ne descend que pour tenir : jamais plus bas que nécessaire
    expect(choix.lignes.length * (choix.taille + 1) * 1.02).toBeGreaterThan(302);
    expect(choix.taille).toBeGreaterThanOrEqual(26);
  });

  it("une hauteur impossible même au plancher de 26 px : corps au plancher, hauteur excédentaire laissée à la mesure existante", () => {
    const serre = choisirMiseEnLignes("Six tâches qui rythment un bureau", mesure, { maxLignes: 4, hauteurMax: 20 });
    expect(serre.taille).toBe(26);
    expect(serre.largeur).toBeLessThanOrEqual(988);
    expect(serre.lignes.length * serre.taille * 1.02).toBeGreaterThan(20);
  });

  it("un titre qui tenait déjà en hauteur ne change pas (couvertures T01, T01B, T01C)", () => {
    const titre = "Six tâches qui rythment un bureau";
    const avant = choisirMiseEnLignes(titre, mesure, { maxLignes: 3, hauteurMax: 100000 });
    expect(choisirMiseEnLignes(titre, mesure, { maxLignes: 3, hauteurMax: 1200 })).toEqual(avant);
  });

  it("ne laisse aucun mot isolé sur une ligne quand une autre mise en lignes tient", () => {
    const choix = choisirMiseEnLignes("Six tâches qui rythment un bureau", mesure, { maxLignes: 4, hauteurMax: 968 });
    if (choix.lignes.length > 1) for (const l of choix.lignes) expect(l).toContain(" ");
  });

  it("lève une erreur claire quand aucune mise en lignes ne tient en largeur", () => {
    expect(() => choisirMiseEnLignes("Anticonstitutionnellement", mesure, { maxLignes: 4, hauteurMax: 968 })).toThrow(/ne tient pas/);
  });

  it("borne nulle dès que le corps est réduit pour tenir en hauteur (même au plancher)", () => {
    const reduit = choisirMiseEnLignes("Six tâches qui rythment un bureau", mesure, { maxLignes: 4, hauteurMax: 20 });
    expect(reduit.borne).toBeNull();
  });
});

describe("attente des titres avant la mesure (MesureVisuelPage)", () => {
  const racine = (attente: () => boolean) => ({ querySelector: () => (attente() ? {} : null) }) as unknown as Element;

  it("rend la main dès que plus aucun titre n'est en attente", async () => {
    let appels = 0;
    await attendreTitres(() => racine(() => appels++ < 3), async () => {});
    // 3 attentes + 1 constat « plus rien » dans la boucle + le contrôle final (qui lève s'il reste un titre) = 5 lectures.
    expect(appels).toBe(5);
  });

  it("lève une erreur si un titre est encore en attente après la boucle, au lieu de mesurer un bloc vide", async () => {
    await expect(attendreTitres(() => racine(() => true), async () => {})).rejects.toThrow(/en attente/);
  });

  it("patiente plus que l'attente de la police (20 s) mais moins que delayRender (30 s) : 25 s au total", async () => {
    let pauses = 0;
    await expect(attendreTitres(() => racine(() => true), async () => void pauses++)).rejects.toThrow(/après 25 s/);
    expect(pauses * 25).toBe(DELAI_TITRES_MS);
    expect(DELAI_TITRES_MS).toBeGreaterThan(DELAI_POLICE_MS);
    expect(DELAI_TITRES_MS).toBeLessThan(DELAI_DELAYRENDER_MS);
  });
});
