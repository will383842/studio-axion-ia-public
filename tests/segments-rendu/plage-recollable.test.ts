/** T-EXT-52c-e-v20h : les morceaux du mode « plage » sortent recollables SEULEMENT si `parametres.recollable === true`. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Ext = Record<string, unknown> & { ffmpegOverride?: (o: { type: string; args: string[] }) => string[] };
type Module = { optionsRenduPlage: (p: Record<string, unknown>, choisie: { fps: number; durationInFrames: number }) => Ext };

// Chemin CALCULÉ (PIEGE-REMOTION-TSC.md) : le tsc racine ne suit pas le fichier du rendu.
const chemin = ["..", "..", "studio-rendu", "src", "operations", "plage-images.ts"].join("/");
const charger = async () => (await import(/* @vite-ignore */ new URL(chemin, import.meta.url).href.replace(/^file:\/\//, ""))) as Module;

const base = { mode: "plage", composition: "C", debut: 0, fin: 9 };
const choisie = { fps: 30, durationInFrames: 300 };

describe("optionsRenduPlage : éteint = identique à master", () => {
  it("sans recollable ni crf : objet vide (rien de plus passé à renderMedia)", async () => {
    expect((await charger()).optionsRenduPlage(base, choisie)).toEqual({});
  });
  it("crf seul : exactement { crf, colorSpace } comme avant", async () => {
    expect((await charger()).optionsRenduPlage({ ...base, crf: 20 }, choisie)).toEqual({ crf: 20, colorSpace: "bt709" });
  });
  it.each([["oui"], [1], ["true"], [false], [undefined]])("recollable %j : identique à éteint", async (v) => {
    const m = await charger();
    expect(m.optionsRenduPlage({ ...base, recollable: v }, choisie)).toEqual(m.optionsRenduPlage(base, choisie));
    expect(m.optionsRenduPlage({ ...base, crf: 20, recollable: v }, choisie)).toEqual({ crf: 20, colorSpace: "bt709" });
  });
});

describe("optionsRenduPlage : recollable === true", () => {
  it("BT.709 même sans crf, et un ffmpegOverride", async () => {
    const o = (await charger()).optionsRenduPlage({ ...base, recollable: true }, choisie);
    expect(o.colorSpace).toBe("bt709");
    expect(typeof o.ffmpegOverride).toBe("function");
    expect(o.crf).toBeUndefined();
  });
  it("GOP fermé de 2 s (fps*2), profil High 4.1, avant le fichier de sortie ; autres passes intactes", async () => {
    const o = (await charger()).optionsRenduPlage({ ...base, recollable: true }, { fps: 25, durationInFrames: 300 });
    const args = ["-i", "x", "-c:v", "libx264", "sortie.mp4"];
    const r = o.ffmpegOverride!({ type: "stitcher", args });
    expect(r.slice(0, 4)).toEqual(["-i", "x", "-c:v", "libx264"]);
    expect(r.at(-1)).toBe("sortie.mp4");
    const txt = r.join(" ");
    expect(txt).toContain("-g 50");
    expect(txt).toContain("-keyint_min 50");
    expect(txt).toContain("-flags +cgop");
    expect(txt).toContain("-profile:v high");
    expect(txt).toContain("-level:v 4.1");
    expect(args).toEqual(["-i", "x", "-c:v", "libx264", "sortie.mp4"]); // entrée non modifiée
    const pre = ["a", "b"];
    expect(o.ffmpegOverride!({ type: "autre", args: pre })).toEqual(["a", "b"]);
  });
  it("pre-stitcher qui encode : réglages ajoutés avant le fichier de sortie ; stitcher avec -c:v copy : sans ajout", async () => {
    const o = (await charger()).optionsRenduPlage({ ...base, recollable: true }, { fps: 25, durationInFrames: 300 });
    const r = o.ffmpegOverride!({ type: "pre-stitcher", args: ["-i", "x", "-c:v", "libx264", "-y", "sortie.mp4"] });
    expect(r.at(-1)).toBe("sortie.mp4");
    expect(r.slice(0, 6)).toEqual(["-i", "x", "-c:v", "libx264", "-y", "-g"]);
    const txt = r.join(" ");
    for (const t of ["-g 50", "-keyint_min 50", "-flags +cgop", "-profile:v high", "-level:v 4.1"]) expect(txt).toContain(t);
    const copie = ["-i", "x", "-c:v", "copy", "-y", "sortie.mp4"];
    expect(o.ffmpegOverride!({ type: "stitcher", args: copie })).toEqual(copie);
  });
  it("le crf demandé reste honoré", async () => {
    const o = (await charger()).optionsRenduPlage({ ...base, crf: 18, recollable: true }, choisie);
    expect(o.crf).toBe(18);
  });
});

describe("garde statique", () => {
  it("aucun import AWS / lambda ; seul `true` allume", () => {
    const src = readFileSync("studio-rendu/src/operations/plage-images.ts", "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*(aws|lambda)/i);
    expect(src).toMatch(/recollable === true/);
  });
});
