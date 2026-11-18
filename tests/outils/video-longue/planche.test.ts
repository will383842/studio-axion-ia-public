/** VL-00 : planche 16:9 et mesure de rendu (outil local, 0 €). Parties pures seulement : aucun rendu, aucun réseau. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DUREE_ESSAI_S,
  HAUTEUR_16_9,
  LARGEUR_16_9,
  PIECES_PLANCHE,
  chargerPlanEssai,
  imageDeLaPiece,
  mesureEnMarkdown,
  secondesParSeconde,
} from "../../../outils/video-longue/planche-16-9";

const RACINE = join(__dirname, "..", "..", "..");
const source = readFileSync(join(RACINE, "outils", "video-longue", "planche-16-9.ts"), "utf8");
const jsonBrut = readFileSync(join(RACINE, "outils", "video-longue", "plan-essai-16-9.json"), "utf8");

describe("VL-00 plan d'essai 16:9", () => {
  const { plan, remarques } = chargerPlanEssai();

  it("est valide sans aucune remarque, en 1920×1080 à 25 images par seconde", () => {
    expect(remarques).toEqual([]);
    expect(plan.format).toEqual({ largeur: LARGEUR_16_9, hauteur: HAUTEUR_16_9, fps: 25 });
  });

  it("dure 60 s et chaque scène tient dans cette durée", () => {
    expect(plan.dureeMs).toBe(DUREE_ESSAI_S * 1000);
    for (const s of plan.scenes) expect(s.finMs).toBeLessThanOrEqual(plan.dureeMs);
  });

  it("porte les 3 pièces de la planche : carte chiffrée, schéma de flux, fenêtre d'application", () => {
    expect(PIECES_PLANCHE).toHaveLength(3);
    for (const p of PIECES_PLANCHE) expect(plan.scenes.some((s) => s.piece === p.piece)).toBe(true);
  });

  it("photographie chaque pièce à l'intérieur de sa scène", () => {
    for (const p of PIECES_PLANCHE) {
      const image = imageDeLaPiece(plan, p.piece);
      const scene = plan.scenes.find((s) => s.piece === p.piece)!;
      expect((image / plan.format.fps) * 1000).toBeGreaterThanOrEqual(scene.debutMs);
      expect((image / plan.format.fps) * 1000).toBeLessThan(scene.finMs);
    }
  });

  it("refuse une pièce absente du plan, sans la remplacer en silence", () => {
    expect(() => imageDeLaPiece({ ...plan, scenes: [] }, "carte-kpi")).toThrow();
  });

  it("ne cite ni bleu ni jaune", () => {
    expect(jsonBrut).not.toMatch(/bleu|jaune|blue|yellow/i);
  });
});

describe("VL-00 mesure de vitesse", () => {
  it("divise le temps de rendu par la durée de la vidéo", () => {
    expect(secondesParSeconde({ dureeVideoS: 60, dureeRenduS: 120 })).toBe(2);
  });

  it("rend null, sans lever, si la durée de vidéo est nulle", () => {
    expect(secondesParSeconde({ dureeVideoS: 0, dureeRenduS: 5 })).toBeNull();
    expect(mesureEnMarkdown({ dureeVideoS: 0, dureeRenduS: 5 }, 0, "test")).toContain("n/a");
  });

  it("annonce le coût de 0 € et la vitesse mesurée", () => {
    const texte = mesureEnMarkdown({ dureeVideoS: 60, dureeRenduS: 90 }, 1500, "4 cœurs");
    expect(texte).toContain("1.50");
    expect(texte).toContain("0 €");
  });
});

describe("VL-00 outil local à 0 €", () => {
  it("n'appelle ni réseau ni Claude, et n'écrit rien dans le dépôt", () => {
    expect(source).not.toMatch(/fetch\(|https?:\/\/|anthropic|openai|elevenlabs|Authorization/i);
    expect(source).not.toMatch(/writeFileSync\((?!join\(sortie)/);
  });

  it("n'est importé par aucun générateur : rien ne change tant qu'on ne le lance pas à la main", () => {
    const importeurs = ["src/formats/index.ts", "src/services/boucle.ts", "studio-rendu/compositions/index.ts"];
    for (const f of importeurs) expect(readFileSync(join(RACINE, f), "utf8")).not.toContain("video-longue/planche-16-9");
  });
});
