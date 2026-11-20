// Mode sans voix (CC-SV) : le son du rendu est un silence total, sans ffmpeg réel (outils simulés, 0 €).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appels: string[][] = [];
vi.mock("../../../studio-rendu/src/outils", () => ({
  FFMPEG: "ffmpeg",
  executerAvecErreurs: vi.fn(async (_bin: string, args: string[]) => {
    appels.push(args);
    // Sur un silence, loudnorm rend « -inf » : c'est la panne d'origine.
    return { sortie: "", erreurs: '{ "input_i" : "-inf", "input_tp" : "-inf", "input_lra" : "0.00", "input_thresh" : "-inf" }' };
  }),
}));
vi.mock("../../../studio-rendu/src/audio/pcm", () => ({ FREQUENCE: 48000, decoderPcm: vi.fn(async () => new Float32Array(48000 * 3)) }));

import { argumentsSilence, preparerSilence, preparerSon } from "../../../studio-rendu/src/son/chaine";

beforeEach(() => {
  appels.length = 0;
});

describe("rendu sans voix : silence total", () => {
  it("preparerSilence : un seul anullsrc, aucune mesure loudnorm, aucun volume, aucun ton de pièce", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "sv-"));
    const son = await preparerSilence({ dossier, dureeSec: 3 });
    expect(appels).toHaveLength(1);
    const ligne = appels[0].join(" ");
    expect(ligne).toContain("anullsrc");
    expect(ligne).not.toContain("loudnorm");
    expect(ligne).not.toContain("volume=");
    expect(son.chemin).toBe(join(dossier, "son-final.wav"));
    expect(son).toMatchObject({ gainDb: 0, tonDeSynthese: false, compression: false });
    expect(son.bruitages).toBeUndefined();
    expect(argumentsSilence(3, "x.wav")).toContain("3.000");
  });

  it("garde de secours : une mesure « -inf » ne donne jamais volume=NaNdB", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "sv-"));
    const son = await preparerSon({ voix: join(dossier, "v.wav"), dureeSec: 3, dossier, passeHautHz: 80, seuilLraCompression: 8, ratioCompression: 2, lufs: -14, creteVraieMaxDbtp: -1.5, tonPieceDb: -45, graine: 1 });
    expect(Number.isFinite(son.gainDb)).toBe(true);
    expect(appels.some((a) => a.join(" ").includes("NaN"))).toBe(false);
    expect(appels.some((a) => a.join(" ").includes("volume=0.00dB"))).toBe(true);
  });
});
