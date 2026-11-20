/** FIX-ARRONDI-CALAGE-v20i : les instants de repli (avant-après, deux colonnes) sont arrondis au millième. */
import { describe, expect, it } from "vitest";
import { calerCarte } from "../../../src/briques/motion/calage";
import type { CarteModele } from "../../../src/briques/motion/types";

const auMillieme = (v: number) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-9;
const avantApres = { avant: { valeur: 4, unite: "h" }, apres: { valeur: 1, unite: "h" } };
const colonnes = { gauche: { titre: "A", points: [] }, droite: { titre: "B", points: [] }, commun: { points: [] } };

describe("calerCarte : arrondi au millième", () => {
  it("avant-après sans mot trouvé (4,6 s) : 1,61 exactement", () => {
    const c = calerCarte({ modele: "avant-apres", donnees: avantApres }, [], 0, 4.6);
    expect(c.modele === "avant-apres" && c.donnees.aSecApres).toBe(1.61);
  });

  it("deux colonnes sans mot trouvé (4,3 s) : 1,29 exactement, tout au millième", () => {
    const c = calerCarte({ modele: "deux-colonnes", donnees: colonnes }, [], 0, 4.3);
    expect(c.modele).toBe("deux-colonnes");
    if (c.modele !== "deux-colonnes") return;
    expect(c.donnees.aSecDroite).toBe(1.29);
    expect(auMillieme(c.donnees.aSecDroite as number)).toBe(true);
    expect(auMillieme(c.donnees.aSecCommun as number)).toBe(true);
  });

  it("valeurs fournies déjà au millième : inchangées", () => {
    const a = calerCarte({ modele: "avant-apres", donnees: { ...avantApres, aSecApres: 2.345 } }, [], 0, 10);
    expect(a.modele === "avant-apres" && a.donnees.aSecApres).toBe(2.345);
    const d = calerCarte({ modele: "deux-colonnes", donnees: { ...colonnes, aSecDroite: 3, aSecCommun: 4.125 } }, [], 0, 10);
    expect(d.modele === "deux-colonnes" && [d.donnees.aSecDroite, d.donnees.aSecCommun]).toEqual([3, 4.125]);
  });

  it("chiffre et ligne-de-temps : sortie identique (déterministe, deux appels égaux)", () => {
    const cartes = [
      { modele: "chiffre", donnees: { valeur: 3 } },
      { modele: "chiffre", donnees: { valeur: 12, aSec: 0.9 } },
      { modele: "ligne-de-temps", donnees: { etapes: [{ titre: "un" }, { titre: "deux" }] } },
    ] as unknown as CarteModele[];
    for (const c of cartes) expect(calerCarte(c, [], 0, 7.3)).toEqual(calerCarte(JSON.parse(JSON.stringify(c)) as CarteModele, [], 0, 7.3));
  });
});
