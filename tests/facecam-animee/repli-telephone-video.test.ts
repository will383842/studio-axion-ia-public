import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { IDS_PLAQUETTES_A_VIDEO_V4 } from "@/moteurs/montage-facecam-animee/repli-sans-video-v4";
import { erreurRepliTelephone, idsPlaquettesAVideoOuvertes } from "@/moteurs/montage-facecam-animee/repli-telephone-video";

const ID = "telephone-video";

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    return statSync(p).isDirectory() ? fichiers(p) : [p];
  });
}

describe("C4-U4.9b-b : repli du téléphone sans extrait", () => {
  it("éteint : la liste est exactement IDS_PLAQUETTES_A_VIDEO_V4 (même référence)", () => {
    expect(idsPlaquettesAVideoOuvertes()).toBe(IDS_PLAQUETTES_A_VIDEO_V4);
    expect(idsPlaquettesAVideoOuvertes({})).toBe(IDS_PLAQUETTES_A_VIDEO_V4);
    expect(idsPlaquettesAVideoOuvertes({ telephoneVideo: "true" })).toBe(IDS_PLAQUETTES_A_VIDEO_V4);
    expect(idsPlaquettesAVideoOuvertes({ telephoneVideo: 1 })).toBe(IDS_PLAQUETTES_A_VIDEO_V4);
  });

  it("allumé (true exact) : ids d'avant dans le même ordre + telephone-video en dernier, gelé", () => {
    const avant = [...IDS_PLAQUETTES_A_VIDEO_V4];
    const ouverte = idsPlaquettesAVideoOuvertes({ telephoneVideo: true });
    expect(ouverte).not.toBe(IDS_PLAQUETTES_A_VIDEO_V4);
    expect(ouverte).toEqual([...avant, ID]);
    expect(ouverte[ouverte.length - 1]).toBe(ID);
    expect(Object.isFrozen(ouverte)).toBe(true);
    expect([...IDS_PLAQUETTES_A_VIDEO_V4]).toEqual(avant);
  });

  it("erreurRepliTelephone : forme D16, arrondi au dixième, sans « recherches »", () => {
    const t = erreurRepliTelephone(0, 3.25);
    expect(t.startsWith("D16 — élément v4 1 « telephone-video » à 3,3 s")).toBe(true);
    expect(t).not.toContain("recherches[");
    expect(t).toContain("Gardez V6, V7, H1 et H2.");
    expect(t).not.toContain("\n");
    expect(erreurRepliTelephone(4, 12)).toContain("élément v4 5 « telephone-video » à 12,0 s");
  });

  it("l'id local égale ID_TELEPHONE_VIDEO lu dans le texte de rendus-lot6.tsx", () => {
    const texte = readFileSync("studio-rendu/compositions/interface-claire/motion-v4/lot6/rendus-lot6.tsx", "utf8");
    const m = texte.match(/export const ID_TELEPHONE_VIDEO = "([^"]+)"/);
    expect(m?.[1]).toBe(ID);
  });

  it("garde : rien dans src/ n'importe repli-telephone-video ; repli-sans-video-v4.ts non touché", () => {
    const importeurs = fichiers("src").filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("repli-telephone-video.ts") && readFileSync(f, "utf8").includes("repli-telephone-video"));
    expect(importeurs).toEqual([]);
    let diff = "";
    try {
      diff = execSync("git diff origin/master -- src/moteurs/montage-facecam-animee/repli-sans-video-v4.ts", { encoding: "utf8" });
    } catch {
      diff = "";
    }
    expect(diff).toBe("");
  });
});
