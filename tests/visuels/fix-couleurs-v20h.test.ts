import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (chemin: string): string => readFileSync(resolve(process.cwd(), chemin), "utf8");

describe("FIX-TESTS-VISUELS-MASTER-v20h : couleurs de thème", () => {
  it("CartesVideoFacecam n'utilise plus la classe inexistante bg-surface", () => {
    const source = lire("src/components/facecam/CartesVideoFacecam.tsx");
    expect(source).not.toMatch(/\bbg-surface(?![-\w])/);
  });

  it("le bouton « Télécharger la vidéo » de KitGeo utilise le jeton --accent, plus l'orange", () => {
    const source = lire("src/components/formats/video-longue/KitGeo.tsx");
    const bouton = source.split("\n").find((ligne) => ligne.includes("download")) ?? "";
    expect(bouton).toMatch(/\bbg-accent\b/);
    expect(bouton).toMatch(/\btext-sur-accent\b/);
    expect(bouton).not.toMatch(/orange/);
  });
});
