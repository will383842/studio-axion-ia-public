import { describe, expect, it } from "vitest";
import type { EcranCale } from "@/briques/ecrans-motion";
import { RECETTE_COMPOSITION_CAS_CONCRET } from "@/moteurs/montage-cas-concret/fabriquer";
import { decisionBoucleCasConcret, scenesBoucleDeCasConcret, sansFinPropre } from "@/moteurs/montage-cas-concret/boucle-effet";

const ecran = (id: string, debutMs: number, finMs: number, fond: EcranCale["fond"] = "ivoire"): EcranCale =>
  ({ id, fond, debutMs, finMs, evenements: [], type: "titre", lignes: ["Un titre"] }) as EcranCale;

describe("boucle du cas concret (BOUCLE-EFFET-a)", () => {
  it("même fond au premier et au dernier écran (≥ 2 s) : boucle, raccord sur l'état d'entrée du premier", () => {
    const cales = [ecran("e1", 0, 3000), ecran("e2", 3000, 6000, "sombre"), ecran("e3", 6000, 9000)];
    const d = decisionBoucleCasConcret(cales);
    expect(d.boucle).toBe(true);
    if (d.boucle) {
      expect(d.raccord.sceneInitiale).toBe(0);
      expect(d.raccord.sceneFinale).toBe(2);
      expect(d.raccord.etatFinal).toBe(scenesBoucleDeCasConcret(cales)[0].etatEntree);
    }
  });
  it("fond différent aux deux bouts : refus fond-different", () => {
    expect(decisionBoucleCasConcret([ecran("e1", 0, 3000), ecran("e2", 3000, 6000, "sombre")])).toEqual({ boucle: false, raison: "fond-different" });
  });
  it("moins de 2 s : trop-court", () => {
    expect(decisionBoucleCasConcret([ecran("e1", 0, 1500)])).toEqual({ boucle: false, raison: "trop-court" });
  });
  it("liste vide : vide", () => {
    expect(decisionBoucleCasConcret([])).toEqual({ boucle: false, raison: "vide" });
  });
  it("jamais de raison « visage » : tout écran du cas concret est de type motion", () => {
    const scenes = scenesBoucleDeCasConcret([ecran("e1", 0, 3000), ecran("e2", 3000, 6000)]);
    expect(scenes.every((s) => s.type === "motion")).toBe(true);
    for (const cales of [[], [ecran("a", 0, 500)], [ecran("a", 0, 3000), ecran("b", 3000, 6000, "sombre")], [ecran("a", 0, 6000)]]) {
      const d = decisionBoucleCasConcret(cales);
      if (!d.boucle) expect(d.raison).not.toMatch(/^visage/);
    }
  });
  it("scène : début, fin et fond recopiés, état d'entrée sans texte, ordre gardé", () => {
    const scenes = scenesBoucleDeCasConcret([ecran("e1", 0, 3000), ecran("e2", 3000, 6000, "sombre")]);
    expect(scenes).toEqual([
      { type: "motion", debutMs: 0, finMs: 3000, fond: "ivoire", etatEntree: "titre|ivoire" },
      { type: "motion", debutMs: 3000, finMs: 6000, fond: "sombre", etatEntree: "titre|sombre" },
    ]);
    expect(JSON.stringify(scenes)).not.toContain("Un titre");
  });
  it("entrée non modifiée, même entrée = même sortie", () => {
    const cales = [ecran("e1", 0, 3000), ecran("e2", 3000, 6000)];
    const copie = JSON.stringify(cales);
    expect(decisionBoucleCasConcret(cales)).toEqual(decisionBoucleCasConcret(cales));
    expect(scenesBoucleDeCasConcret(cales)).toEqual(scenesBoucleDeCasConcret(cales));
    expect(JSON.stringify(cales)).toBe(copie);
  });
  it("sansFinPropre : retire finPropre, garde le reste, ne modifie pas la constante", () => {
    expect("finPropre" in RECETTE_COMPOSITION_CAS_CONCRET).toBe(true);
    const sans = sansFinPropre(RECETTE_COMPOSITION_CAS_CONCRET);
    expect("finPropre" in sans).toBe(false);
    const { finPropre: _f, ...attendu } = RECETTE_COMPOSITION_CAS_CONCRET;
    void _f;
    expect(sans).toEqual(attendu);
    expect("finPropre" in RECETTE_COMPOSITION_CAS_CONCRET).toBe(true);
  });
});
