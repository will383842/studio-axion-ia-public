/**
 * Finitions 4:5 · le repère « k/N » ne recouvre jamais le surtitre d'un écran « chiffres » ; script collé : le seuil de mots
 * d'un écran est cohérent avec le texte d'écran lisible (`signesMax`), sans changer un mot dit.
 */
import { describe, expect, it } from "vitest";
import { REGLES_SCENE_IV } from "@/moteurs/montage-image-video/regles-scene";
import { ecransDuScript, ficheDuScriptColle } from "@/moteurs/montage-image-video/script-colle";
import { carteFixe } from "../doubles-fabrication";
import { boiteRepere45, boiteSurtitreChiffres, decalageRepereSurtitre } from "../../../studio-rendu/compositions/image-video/variete/repere-place";

const CHANGEMENTS = [{ t: 0, numero: 1 }];
const mots = (t: string) => t.split(/\s+/).filter(Boolean);

describe("repère « 1/3 » et surtitre d'un écran « chiffres » en 4:5", () => {
  const repere = boiteRepere45(CHANGEMENTS, 3, 1)!;

  it("le repère centré recouvre un surtitre court posé à gauche (le défaut), à y 94 → contre 96", () => {
    const surtitre = boiteSurtitreChiffres(1350, "Gain de temps", "CHI-B")!;
    expect(repere.y).toBeCloseTo(93.6, 1);
    expect(decalageRepereSurtitre(repere, { ...surtitre, largeur: 400 })).toBeGreaterThan(0);
  });

  it("décalé, le repère reste dans la marge de droite et laisse un écart au surtitre", () => {
    const surtitre = boiteSurtitreChiffres(1350, "Gain de temps", "CHI-B")!;
    const dx = decalageRepereSurtitre(repere, surtitre)!;
    expect(dx).toBeGreaterThan(0);
    expect(repere.x + dx + repere.largeur).toBeLessThanOrEqual(1080 - 72 + 1e-9);
    expect(repere.x + dx).toBeGreaterThanOrEqual(surtitre.x + surtitre.largeur + 24);
  });

  it("un surtitre trop long pour laisser la place : le repère s'efface, jamais posé dessus", () => {
    const surtitre = boiteSurtitreChiffres(1350, "Quatre mots tres longs ici", "CHI-B")!;
    expect(decalageRepereSurtitre(repere, surtitre)).toBeNull();
  });

  it("rien à faire sans surtitre, en 9:16, pour le géant sans étiquette, ou quand ils sont déjà disjoints", () => {
    expect(boiteSurtitreChiffres(1920, "Gain de temps", "CHI-B")).toBeNull();
    expect(boiteSurtitreChiffres(1350, undefined, "CHI-B")).toBeNull();
    expect(boiteSurtitreChiffres(1350, "Gain de temps", "CHI-D")).toBeNull();
    expect(decalageRepereSurtitre(repere, null)).toBe(0);
    expect(decalageRepereSurtitre(repere, { x: 72, y: 300, largeur: 500, hauteur: 32 })).toBe(0);
  });
});

describe("script collé : seuil de mots d'un écran cohérent avec signesMax", () => {
  const phrase = "Chaque lundi matin vous perdez beaucoup trop de temps à relancer vos clients un par un sans jamais savoir lesquels vont répondre vraiment.";
  const script = `Vous relancez. ${phrase} Résultat net. Une heure gagnée. Un client content. Merci.`;

  it("aucun écran ne dépasse 12 mots, et les mots dits restent exactement ceux du script", () => {
    const ecrans = ecransDuScript(script);
    for (const e of ecrans) expect(e.filter((j) => /[\p{L}\p{N}]/u.test(j)).length).toBeLessThanOrEqual(12);
    expect(mots(ecrans.map((e) => e.join(" ")).join(" "))).toEqual(mots(script));
  });

  it("le texte affiché d'un écran tient dans signesMax (Q21), la voix garde tout", () => {
    const fiche = ficheDuScriptColle(script, carteFixe("C"));
    for (const e of fiche.ecrans) for (const t of e.textesEcran) expect(t.length, t).toBeLessThanOrEqual(REGLES_SCENE_IV.signesMax);
    expect(mots(fiche.ecrans.map((e) => e.texteDit).join(" "))).toEqual(mots(script));
  });
});
