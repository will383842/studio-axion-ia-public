/** BR-PRIX-FA-a : le prix affiché sait compter le téléphone et le calage au mot (options facultatives, défaut identique). */
import { describe, expect, it } from "vitest";
import { estimerOpusV4, messageChiffreV4 } from "@/moteurs/montage-facecam-animee/realisateur/cout-v4";
import { blocTelephoneVideo } from "@/moteurs/montage-facecam-animee/realisateur/consigne-telephone-video";

const base = { dureeSec: 60, plafondUsd: 5 };
const EUR_PAR_USD = 0.92;

describe("cout-v4 : options facultatives", () => {
  it("(a) telephoneVideo: true augmente le prix", () => {
    expect(estimerOpusV4({ ...base, telephoneVideo: true }).unEssaiUsd).toBeGreaterThan(estimerOpusV4(base).unEssaiUsd);
    expect(estimerOpusV4({ ...base, telephoneVideo: true }).pireCasUsd).toBeGreaterThan(estimerOpusV4(base).pireCasUsd);
  });
  it("(a) calageAuMot: true augmente le prix", () => {
    expect(estimerOpusV4({ ...base, calageAuMot: true }).unEssaiUsd).toBeGreaterThan(estimerOpusV4(base).unEssaiUsd);
    expect(estimerOpusV4({ ...base, calageAuMot: true }).pireCasUsd).toBeGreaterThan(estimerOpusV4(base).pireCasUsd);
  });
  it("(b) le message chiffré contient la consigne du téléphone mot pour mot, comme realisateur/index.ts", () => {
    const bloc = blocTelephoneVideo(true);
    expect(bloc.length).toBeGreaterThan(0);
    const avec = messageChiffreV4({ ...base, telephoneVideo: true });
    expect(avec).toContain(bloc);
    expect(avec.endsWith(`\n\n${bloc}`)).toBe(true);
    expect(messageChiffreV4(base)).not.toContain(bloc);
  });
  it("(c) sans option : chiffres identiques à master", () => {
    const e = estimerOpusV4(base);
    expect(e.unEssaiUsd).toBe(VALEURS_MASTER.unEssaiUsd);
    expect(e.pireCasUsd).toBe(VALEURS_MASTER.pireCasUsd);
    expect(e.engageMaxUsd).toBe(VALEURS_MASTER.engageMaxUsd);
    expect(estimerOpusV4({ ...base, telephoneVideo: undefined, calageAuMot: undefined })).toEqual(e);
  });
  it("(d) écart par vidéo en centimes d'euro (affiché au journal)", () => {
    for (const dureeSec of [30, 60, 90]) {
      const b = estimerOpusV4({ dureeSec, plafondUsd: 5 });
      const t = estimerOpusV4({ dureeSec, plafondUsd: 5, telephoneVideo: true });
      const c = estimerOpusV4({ dureeSec, plafondUsd: 5, calageAuMot: true });
      const cent = (x: number) => Math.round(x * EUR_PAR_USD * 100 * 1000) / 1000;
      console.log(`ECART ${dureeSec}s un essai: tel +${cent(t.unEssaiUsd - b.unEssaiUsd)} c, calage +${cent(c.unEssaiUsd - b.unEssaiUsd)} c ; pire cas: tel +${cent(t.pireCasUsd - b.pireCasUsd)} c, calage +${cent(c.pireCasUsd - b.pireCasUsd)} c`);
      expect(t.unEssaiUsd).toBeGreaterThan(b.unEssaiUsd);
    }
  });
});

const VALEURS_MASTER = { unEssaiUsd: 0.789495, pireCasUsd: 4.609695, engageMaxUsd: 4.609695 };
