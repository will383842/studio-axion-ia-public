/**
 * CHAÎNE DE FABRICATION EN STYLE « blocs/2 » (doubles, aucun appel) : mots de la voix passés aux scènes, sous-titres de
 * la composition coupés, bruitages du plan mixés sous la voix, pas de scène de fin ajoutée (l'écran d'appel prend le mot
 * saisi), 30 i/s, chaque sortie avec ses propriétés « blocs/2 », style noté par la traçabilité.
 */
import { describe, expect, it } from "vitest";
import { fabriquerTableau, ID_SCENE_FIN, type EvenementFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { ProprietesTableauScene } from "../../../src/briques/tableau-scene/types";
import { doubles } from "../fabriquer/doubles";
import { contexteFormation, ficheFormation } from "../style-v2/temoin-formation";

describe("fabrication « blocs/2 », deux sorties", async () => {
  const d = doubles(ficheFormation());
  const traces: EvenementFabrication[] = [];
  const r = await fabriquerTableau({
    ...d.outils,
    contexte: contexteFormation(),
    sorties: ["vertical", "carre"],
    choisirFin: () => ({ id: "fin-if-mot-envoi", ecran: "Écrivez GUIDE en commentaire", type: "commentaire", mot: "GUIDE" }),
    tracer: async (e) => {
      traces.push(e);
    },
  });
  const scenes = d.scenesSoumises().map((s) => (s.parametres as { proprietes: ProprietesTableauScene }).proprietes);
  const completes = d.compositionsSoumises();

  it("chaque sortie a ses scènes « blocs/2 », avec les mots de la voix, à 30 i/s, sans scène de fin ajoutée", () => {
    expect(r.sorties.map((s) => s.format)).toEqual(["vertical", "carre"]);
    expect(new Set(scenes.map((p) => `${p.largeur}x${p.hauteur}`))).toEqual(new Set(["1080x1920", "1080x1080"]));
    for (const p of scenes) {
      expect(p.v2?.style).toBe("blocs/2");
      expect(p.v2?.mots?.length).toBeGreaterThan(0);
      expect(p.fps).toBe(30);
      expect(p.scene.id).not.toBe(ID_SCENE_FIN);
    }
  });

  it("l'écran d'appel de la dernière scène tape le mot saisi ; le carré de LinkedIn, jamais (14/10)", () => {
    const appelDe = (hauteur: number) => scenes.filter((p) => p.hauteur === hauteur).at(-1)!.v2!.ecrans.at(-1)!;
    expect(appelDe(1920).textes.some((t) => t.texte === "GUIDE")).toBe(true);
    expect(JSON.stringify(scenes.filter((p) => p.hauteur === 1080))).not.toContain("GUIDE");
  });

  it("la composition coupe ses sous-titres, mixe les bruitages sous la voix et exporte à 30 i/s ; durée = dernier mot + tenue", () => {
    expect(completes.length).toBe(2);
    for (const c of completes) {
      const p = c.parametres as { texte: { sousTitres?: unknown; fps: number }; son: { bruitages?: { gainDb: number; entree: string }[] }; export: { fps: number; mesurerBords?: boolean; instantsBords?: number[] } };
      // Bords mesurés sur des écrans clairs (le fond encre passerait pour une bande noire).
      expect(p.export.mesurerBords).toBe(true);
      expect(p.export.instantsBords?.length).toBe(3);
      expect(p.texte.sousTitres).toBeUndefined();
      expect(p.export.fps).toBe(30);
      expect(p.texte.fps).toBe(30);
      expect(p.son.bruitages?.length).toBeGreaterThan(3);
      for (const b of p.son.bruitages!) {
        expect(b.gainDb).toBeLessThanOrEqual(-18);
        expect(c.entrees[b.entree]).toMatch(/tableau-(trait|toc|validation)\.wav/);
      }
    }
    expect(r.dureeSec).toBeGreaterThan(30);
  });

  it("la traçabilité note le style", () => {
    expect(traces.find((t) => t.type === "code")?.donnees).toMatchObject({ style: "blocs/2" });
  });
});
