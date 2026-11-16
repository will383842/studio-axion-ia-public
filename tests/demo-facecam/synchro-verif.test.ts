import { describe, expect, it } from "vitest";
import { ANCRES_MIN_SURE, PART_DECALAGE_MAX, confianceSynchro, type EntreeConfianceSynchro } from "@/moteurs/montage-demo-facecam/synchro-verif";

const audio = (ancres: number | undefined, decalageSec = 1, dureeFacecamSec?: number): EntreeConfianceSynchro => ({ synchro: { mode: "audio", decalageSec }, ancres, dureeFacecamSec });

describe("confianceSynchro", () => {
  it("constantes", () => {
    expect(ANCRES_MIN_SURE).toBe(5);
    expect(PART_DECALAGE_MAX).toBe(0.5);
  });
  it("audio ≥ 5 ancres : sûre, sans réserve", () => {
    const r = confianceSynchro(audio(5, 1, 60));
    expect(r.niveau).toBe("sure");
    expect(r.reserve).toBeUndefined();
    expect(confianceSynchro(audio(12)).niveau).toBe("sure");
  });
  it("frontière 4 / 5 ancres", () => {
    expect(confianceSynchro(audio(4)).niveau).toBe("a-verifier");
    expect(confianceSynchro(audio(2)).niveau).toBe("a-verifier");
    expect(confianceSynchro(audio(5)).niveau).toBe("sure");
  });
  it("réserve en phrase « À vérifier : »", () => {
    expect(confianceSynchro(audio(3)).reserve).toMatch(/^À vérifier : /);
  });
  it("décalage > 50 % de la durée facecam : à vérifier ; frontière exacte : sûre", () => {
    expect(confianceSynchro(audio(8, 31, 60)).niveau).toBe("a-verifier");
    expect(confianceSynchro(audio(8, -31, 60)).niveau).toBe("a-verifier");
    expect(confianceSynchro(audio(8, 30, 60)).niveau).toBe("sure");
  });
  it("début de repli : à vérifier ; début voulu : sûr", () => {
    const repli = confianceSynchro({ synchro: { mode: "debut", decalageSec: 0 }, repli: true });
    expect(repli.niveau).toBe("a-verifier");
    expect(repli.reserve).toMatch(/^À vérifier : /);
    const voulu = confianceSynchro({ synchro: { mode: "debut", decalageSec: 0 } });
    expect(voulu.niveau).toBe("sure");
    expect(voulu.reserve).toBeUndefined();
  });
  it("fourni et aucune : sûres", () => {
    for (const mode of ["fourni", "aucune"] as const) {
      const r = confianceSynchro({ synchro: { mode, decalageSec: 99 }, dureeFacecamSec: 10 });
      expect(r.niveau).toBe("sure");
      expect(r.reserve).toBeUndefined();
    }
  });
  it("déterministe", () => {
    const e = audio(3, 2, 20);
    expect(confianceSynchro(e)).toEqual(confianceSynchro({ ...e }));
  });
  it("ne lève jamais sur entrée incomplète", () => {
    expect(() => confianceSynchro(audio(undefined))).not.toThrow();
    expect(confianceSynchro(audio(undefined)).niveau).toBe("a-verifier");
    expect(() => confianceSynchro({} as EntreeConfianceSynchro)).not.toThrow();
    expect(() => confianceSynchro(undefined as unknown as EntreeConfianceSynchro)).not.toThrow();
    expect(() => confianceSynchro(audio(8, Number.NaN, 0))).not.toThrow();
  });
});
