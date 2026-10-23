/**
 * Revue passe 3 du 15/10, priorité 2 : les sous-éléments de carte doivent produire de VRAIS mouvements visibles.
 * - flash d'entrée orange → ligne active sable → posé : trois états francs, deux pics distincts pour la mesure ;
 * - le badge de la frise a sa propre bande et ne recouvre plus aucune étape (« Réflexe » sur « Embauche », 33 s) ;
 * - jamais deux étiquettes à l'écran en même temps (« Du temps » / « Qui vous échappe », 83,85-84,3 s).
 */
import { describe, expect, it } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { boitesFrise, ligneFrise, sansBandeVide, sansEtiquettesSuperposees } from "../../studio-rendu/compositions/interface-claire/Carte";
import { finFlash, FLASH, instantSuivant, phaseFlash } from "../../studio-rendu/compositions/interface-claire/elements";

describe("flash d'entrée des sous-éléments de carte", () => {
  it("orange sur le mot, sable ensuite, posé à l'arrivée du suivant", () => {
    expect(phaseFlash(9.99, 10, 11)).toBe("avant");
    expect(phaseFlash(10, 10, 11)).toBe("flash");
    expect(phaseFlash(10 + FLASH.duree - 0.01, 10, 11)).toBe("flash");
    expect(phaseFlash(10 + FLASH.duree + 0.01, 10, 11)).toBe("actif");
    expect(phaseFlash(11, 10, 11)).toBe("pose");
    // Dernier élément : actif jusqu'à la fin de la carte.
    expect(phaseFlash(30, 10)).toBe("actif");
  });

  it("le flash dure au moins 4 images et finit 3 images avant le suivant (pics séparés pour dynamisme.py)", () => {
    expect(finFlash(10, 10.3)).toBeCloseTo(10.18, 6);
    expect(finFlash(10, 10.2)).toBeCloseTo(10 + FLASH.minimum, 6);
    expect(finFlash(10, 12)).toBeCloseTo(10 + FLASH.duree, 6);
    expect(FLASH.minimum).toBeGreaterThanOrEqual(0.16);
  });

  it("instant suivant : le plus petit instant strictement postérieur", () => {
    expect(instantSuivant(2, [5, 3, 2, 1])).toBe(3);
    expect(instantSuivant(5, [5, 3, 2, 1])).toBeUndefined();
  });
});

describe("frise : le badge ne recouvre aucune étape", () => {
  for (const n of [2, 3, 4, 5, 6]) {
    it(`${n} étapes`, () => {
      const H = 1920;
      const h = H * 0.056 * 1.4;
      const b = boitesFrise(h, n, true);
      expect(b.badge).toBeDefined();
      const derniere = b.etapes[b.etapes.length - 1];
      expect(b.badge!.y0).toBeGreaterThanOrEqual(derniere.y1 - 1e-6);
      // Même hauteur totale que celle prévue par la mise en page.
      expect(b.badge!.y1).toBeLessThanOrEqual(n * h + 1e-6);
      expect(ligneFrise(h, n, true) * n).toBeLessThan(n * h);
    });
  }
  it("sans badge, les lignes gardent leur hauteur", () => {
    expect(ligneFrise(100, 3, false)).toBe(100);
  });
});

describe("jamais deux étiquettes superposées", () => {
  const plan = (calques: { debut: number; fin: number; texte: string }[]) =>
    ({
      cartes: [],
      fenetres: [],
      calques: calques.map((c) => ({ type: "etiquette", ...c })),
      fin: { debut: 100 },
      duree: 100,
    }) as unknown as PlanFacecamAnimee;

  it("« Du temps » (82,3-84,3) est coupée à l'entrée de « Qui vous échappe » (83,85)", () => {
    const p = plan([
      { debut: 82.3, fin: 84.3, texte: "Du temps" },
      { debut: 83.85, fin: 85, texte: "Qui vous échappe" },
    ]);
    const r = sansEtiquettesSuperposees(p);
    expect(r.calques.map((c) => c.fin)).toEqual([83.85, 85]);
    expect(p.calques[0].fin).toBe(84.3);
    // Le rendu applique la même règle.
    expect(sansBandeVide(p).calques[0].fin).toBe(83.85);
  });

  it("des étiquettes qui se suivent sans se chevaucher sont rendues telles quelles (même objet)", () => {
    const p = plan([
      { debut: 1, fin: 2, texte: "A" },
      { debut: 2.5, fin: 3, texte: "B" },
    ]);
    expect(sansEtiquettesSuperposees(p)).toBe(p);
  });
});
