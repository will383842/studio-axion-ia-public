/** FIX-ARRONDI-CALAGE-v20i : les instants de repli d'avant-après et de deux colonnes sont arrondis au millième. */
import { describe, expect, it } from "vitest";
import { calerCarte } from "../../../src/briques/motion/calage";
import type { CarteModele } from "../../../src/briques/motion/types";

const auMilliemeNet = (v: number) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-9 && Math.abs(v - +v.toFixed(3)) === 0;

const avantApres = (aSecApres?: number): CarteModele => ({
  modele: "avant-apres",
  donnees: { avant: { valeur: 4, unite: "h" }, apres: { valeur: 1, unite: "h" }, aSecApres },
});
const deuxColonnes = (extra: { aSecDroite?: number; aSecCommun?: number } = {}): CarteModele => ({
  modele: "deux-colonnes",
  donnees: { gauche: { titre: "Gauche", points: ["a"] }, droite: { titre: "Droite", points: ["b"] }, commun: { titre: "Commun", points: ["c"] }, ...extra },
});

describe("arrondi du calage (replis)", () => {
  it("avant-après sans mot trouvé : 4.6 * 0.35 donne exactement 1.61", () => {
    const r = calerCarte(avantApres(), [], 0, 4.6);
    expect(r.modele === "avant-apres" && r.donnees.aSecApres).toBe(1.61);
  });
  it("deux colonnes sans mot trouvé : 4.3 * 0.3 donne exactement 1.29, tout au millième", () => {
    const r = calerCarte(deuxColonnes(), [], 0, 4.3);
    if (r.modele !== "deux-colonnes") throw new Error("modèle");
    expect(r.donnees.aSecDroite).toBe(1.29);
    expect(auMilliemeNet(r.donnees.aSecDroite as number)).toBe(true);
    expect(auMilliemeNet(r.donnees.aSecCommun as number)).toBe(true);
  });
  it("les valeurs fournies par l'appelant restent identiques", () => {
    const a = calerCarte(avantApres(2.5), [], 0, 10);
    expect(a.modele === "avant-apres" && a.donnees.aSecApres).toBe(2.5);
    const d = calerCarte(deuxColonnes({ aSecDroite: 1.5, aSecCommun: 3.2 }), [], 0, 10);
    expect(d.modele === "deux-colonnes" && [d.donnees.aSecDroite, d.donnees.aSecCommun]).toEqual([1.5, 3.2]);
  });
  it("chiffre et ligne-de-temps : sortie identique au calcul d'origine", () => {
    const ch: CarteModele = { modele: "chiffre", donnees: { valeur: 3, libelle: "x" } };
    expect(calerCarte(ch, [], 0, 6)).toEqual({ modele: "chiffre", donnees: { valeur: 3, libelle: "x", aSec: 0.3 } });
    const lt: CarteModele = { modele: "ligne-de-temps", donnees: { etapes: [{ titre: "un" }, { titre: "deux" }, { titre: "trois" }] } };
    const r = calerCarte(lt, [], 0, 8);
    expect(r.modele === "ligne-de-temps" && r.donnees.etapes.map((e) => e.aSec)).toEqual([0.25, 1.35, 2.45]);
  });
});
