/**
 * Brique `ecrans-motion` : cadeau d'une promesse trop long pour une ligne d'affiche (fin « automatisation » de la table
 * des fins). Coupé comme la référence `s20` : « TOUTE LA STRUCTURE » en grand, la suite en ligne dessous. Sans
 * effet sur un cadeau qui tient.
 */
import { describe, expect, it } from "vitest";
import { boitesEcran, controlerProprietes, couperCadeau, disposer, proprietesEcrans, textesEcran, type EcranCale, type ProprietesEcran } from "../../../src/briques/ecrans-motion";
import { zoneProtegeeCombinee } from "../../../src/reseaux";

const QUATRE = zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"])!;
type Promesse = Extract<ProprietesEcran, { type: "promesse" }>;

const promesse = (cadeau: string, bandeSousTitres?: number): Promesse => {
  const e = { id: "f02", fond: "sombre", debutMs: 0, finMs: 3000, evenements: [], type: "promesse", invite: "On vous envoie", cadeau, ligne: "À mettre en place chez vous" } as EcranCale;
  return proprietesEcrans({ ecrans: [e], captures: {}, zoneProtegee: QUATRE, ...(bandeSousTitres ? { bandeSousTitres } : {}) })[0] as Promesse;
};

describe("cadeau d'une promesse", () => {
  it.each([undefined, 0.08])("trop long : « TOUTE LA STRUCTURE » en grand, « de cette automatisation » en ligne (bande %s)", (bande) => {
    const p = promesse("Toute la structure de cette automatisation", bande);
    expect(couperCadeau(p)).toEqual({ tete: "Toute la structure", suite: "de cette automatisation" });
    const t = textesEcran(p);
    expect(t.cadeau).toBe("Toute la structure");
    expect(t["cadeau-suite"]).toBe("de cette automatisation");
    expect(controlerProprietes(p)).toEqual([]);
    // Ordre de haut en bas : invite, cadeau, sa suite, la ligne.
    const y = Object.fromEntries(disposer(p).textes.map((x) => [x.nom, x.boite.y]));
    expect(y.invite).toBeLessThan(y.cadeau);
    expect(y.cadeau).toBeLessThan(y["cadeau-suite"]);
    expect(y["cadeau-suite"]).toBeLessThan(y.ligne);
    // La tête reste une affiche, à 1,5 fois le plancher au moins.
    const tete = disposer(p).textes.find((x) => x.nom === "cadeau")!;
    expect(tete.police).toBe("anton");
    expect(tete.tailleRendue).toBeGreaterThanOrEqual(1.5 * tete.plancher - 0.01);
  });

  it("une affiche ne finit jamais sur un mot-outil, et l'accent ouvert est refermé à la coupe", () => {
    const c = couperCadeau(promesse("*Toute la structure de cette automatisation*"));
    expect(c.tete).toBe("*Toute la structure*");
    expect(c.suite).toBe("de cette automatisation");
  });

  it("un cadeau qui tient n'est pas coupé : mêmes textes et mêmes boîtes qu'avant", () => {
    const p = promesse("*toute la structure*");
    expect(couperCadeau(p)).toEqual({ tete: "*toute la structure*", suite: null });
    expect(textesEcran(p)["cadeau-suite"]).toBeUndefined();
    expect(boitesEcran(p).textes.map((b) => b.nom)).toEqual(["invite", "cadeau", "ligne"]);
  });

  it("sans coupe possible (un seul mot trop long), le cadeau reste entier et le contrôle le refuse", () => {
    const p = promesse("Anticonstitutionnellementissimementextraordinairement");
    expect(couperCadeau(p).suite).toBeNull();
    expect(controlerProprietes(p).join("\n")).toMatch(/cadeau/);
  });
});
