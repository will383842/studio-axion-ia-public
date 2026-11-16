/**
 * N-07 : tout objet visible neuf est essayé dans les 4 formats et reste dans la zone sûre du réseau visé.
 * Chaque fiche d'objet neuf (C9-*, C6-*, G2-*) ajoute sa ligne à OBJETS_NEUFS (règle 7 du plan). Vide aujourd'hui.
 */
import { describe, expect, it } from "vitest";
import { ZONES } from "@/briques/plan-scenes/zones";
import { RATIOS_ESSAI, boiteDansZoneSure, controleZoneSurePourGenerateur, type ObjetEssai } from "@/moteurs/conformite-zone-sure";
import { defautsDeSortie } from "@/moteurs/conformite";
import { listerReseaux } from "@/reseaux";
import type { Ratio } from "@/domaine/types";
import type { SortieProduite } from "@/moteurs/types";

/** Registre des objets neufs : { id, boite(ratio) } en % de l'image. */
const OBJETS_NEUFS: ObjetEssai[] = [];

describe("N-07 : objets neufs dans la zone sûre, 4 formats", () => {
  it("les 4 formats d'essai", () => {
    expect([...RATIOS_ESSAI]).toEqual(["9:16", "4:5", "1:1", "16:9"]);
  });

  for (const objet of OBJETS_NEUFS) {
    for (const ratio of RATIOS_ESSAI) {
      for (const reseau of listerReseaux().filter((r) => r.zonesProtegees[ratio])) {
        it(`${objet.id} · ${ratio} · ${reseau.id}`, () => {
          const r = boiteDansZoneSure(objet.boite(ratio), ratio, [reseau.id]);
          expect(r.ok, r.raison).toBe(true);
        });
      }
    }
  }

  describe("cas témoins", () => {
    it("ZONES.plein est hors zone pour Instagram 9:16", () => {
      const r = boiteDansZoneSure(ZONES.plein, "9:16", ["instagram"]);
      expect(r.ok).toBe(false);
      expect(r.raison).toMatch(/Hors zone sûre/);
    });
    it("ZONES.centre est dans la zone pour LinkedIn 1:1", () => {
      const r = boiteDansZoneSure(ZONES.centre, "1:1", ["linkedin"]);
      expect(r.ok, r.raison).toBe(true);
    });
    it("ratio sans zone connue : non-fait, jamais réussi", () => {
      const r = boiteDansZoneSure(ZONES.centre, "16:9", ["instagram"]);
      expect(r.ok).toBe(false);
      expect(r.raison).toMatch(/Aucune zone sûre/);
    });
  });

  describe("branchement sur controlesEnPlus (G1-02)", () => {
    const sortie = (ratio: Ratio, reseaux: SortieProduite["reseaux"]): SortieProduite => ({
      ratio,
      fichierCle: "f.mp4",
      vignetteCle: "v.jpg",
      resolution: ratio === "9:16" ? "1080x1920" : "1080x1080",
      dureeSec: 10,
      taille: 1,
      rapportQualite: {} as SortieProduite["rapportQualite"],
      reseaux,
    });
    const horsZone: ObjetEssai = { id: "objet-factice-hors", boite: () => ZONES.plein };
    const dansZone: ObjetEssai = { id: "objet-factice-dans", boite: () => ({ x: 10, y: 20, largeur: 60, hauteur: 40 }) };

    it("un objet qui déborde en 9:16 Reels est refusé", () => {
      const defauts = defautsDeSortie(sortie("9:16", ["instagram"]), { simulation: true, controlesEnPlus: [controleZoneSurePourGenerateur([horsZone])] });
      expect(defauts.join(" ")).toMatch(/objet-factice-hors/);
    });
    it("un objet dans la zone est accepté", () => {
      const defauts = defautsDeSortie(sortie("9:16", ["instagram"]), { simulation: true, controlesEnPlus: [controleZoneSurePourGenerateur([dansZone])] });
      expect(defauts).toEqual([]);
    });
    it("sans objet : aucun défaut (éteint = identique)", () => {
      expect(controleZoneSurePourGenerateur([])(sortie("9:16", ["instagram"]))).toEqual([]);
    });
  });
});
