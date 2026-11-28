import { describe, expect, it } from "vitest";
import { dureeDeLaVideo, libelleDureeVideo } from "./duree-video";

describe("dureeDeLaVideo", () => {
  it("sans sortie : durée estimée du script, marquée « estimee »", () => {
    expect(dureeDeLaVideo(95)).toEqual({ sec: 95, estimee: true });
  });

  it("sortie sans dureeSec (absente, null, NaN ou infinie) : repli sur l'estimation du script", () => {
    for (const dureeSec of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(dureeDeLaVideo(95, { dureeSec: dureeSec ?? undefined }), `dureeSec=${String(dureeSec)}`).toEqual({ sec: 95, estimee: true });
    }
    expect(dureeDeLaVideo(95, null)).toEqual({ sec: 95, estimee: true });
    expect(dureeDeLaVideo(95, undefined)).toEqual({ sec: 95, estimee: true });
  });

  it("une dureeSec réelle de 83.4 s'impose telle quelle : sec 83.4, estimee false", () => {
    expect(dureeDeLaVideo(95, { dureeSec: 83.4 })).toEqual({ sec: 83.4, estimee: false });
  });

  it("une dureeSec de 0 ne compte pas comme durée réelle", () => {
    expect(dureeDeLaVideo(95, { dureeSec: 0 })).toEqual({ sec: 95, estimee: true });
  });
});

describe("libelleDureeVideo", () => {
  it("durée réelle : le libellé de formats, arrondi à la seconde (« 1 min 23 » pour 83.4)", () => {
    expect(libelleDureeVideo({ sec: 83.4, estimee: false })).toBe("1 min 23");
  });

  it("durée estimée : le libellé commence par « environ »", () => {
    expect(libelleDureeVideo({ sec: 113, estimee: true })).toBe("environ 1 min 53");
  });

  it("moins d'une minute : « 45 s » / « environ 45 s »", () => {
    expect(libelleDureeVideo({ sec: 45, estimee: false })).toBe("45 s");
    expect(libelleDureeVideo({ sec: 45, estimee: true })).toBe("environ 45 s");
  });
});
