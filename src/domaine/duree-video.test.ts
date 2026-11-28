import { describe, expect, it } from "vitest";
import { dureeDeLaVideo, libelleDureeVideo } from "./duree-video";

describe("dureeDeLaVideo", () => {
  it("donne la durée du script, estimée, quand dureeSec est absente, nulle ou non finie", () => {
    const attendu = { sec: 113, estimee: true };
    expect(dureeDeLaVideo(113)).toEqual(attendu);
    expect(dureeDeLaVideo(113, null)).toEqual(attendu);
    expect(dureeDeLaVideo(113, {})).toEqual(attendu);
    expect(dureeDeLaVideo(113, { dureeSec: undefined })).toEqual(attendu);
    expect(dureeDeLaVideo(113, { dureeSec: 0 })).toEqual(attendu);
    expect(dureeDeLaVideo(113, { dureeSec: Number.NaN })).toEqual(attendu);
    expect(dureeDeLaVideo(113, { dureeSec: Number.POSITIVE_INFINITY })).toEqual(attendu);
  });

  it("donne aussi l'estimation pour une durée négative", () => {
    expect(dureeDeLaVideo(113, { dureeSec: -5 })).toEqual({ sec: 113, estimee: true });
  });

  it("donne la durée réelle, non estimée, quand dureeSec est mesurée", () => {
    expect(dureeDeLaVideo(113, { dureeSec: 83.4 })).toEqual({ sec: 83.4, estimee: false });
  });
});

describe("libelleDureeVideo", () => {
  it("préfixe le libellé estimé par « environ »", () => {
    expect(libelleDureeVideo({ sec: 113, estimee: true })).toBe("environ 1 min 53");
    expect(libelleDureeVideo({ sec: 45, estimee: true })).toBe("environ 45 s");
  });

  it("n'ajoute rien pour une durée réelle, arrondie à la seconde", () => {
    expect(libelleDureeVideo({ sec: 83.4, estimee: false })).toBe("1 min 23");
    expect(libelleDureeVideo({ sec: 120, estimee: false })).toBe("2 min");
    expect(libelleDureeVideo({ sec: 59.6, estimee: false })).toBe("1 min");
  });

  it("ramène une durée négative à 0 s", () => {
    expect(libelleDureeVideo({ sec: -3, estimee: false })).toBe("0 s");
  });

  it("complète les secondes sur deux chiffres", () => {
    expect(libelleDureeVideo({ sec: 65, estimee: false })).toBe("1 min 05");
  });
});
