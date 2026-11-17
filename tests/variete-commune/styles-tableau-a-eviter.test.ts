import { describe, it, expect } from "vitest";
import { stylesAEviter } from "@/services/variete-commune/styles-tableau-a-eviter";
import { STYLES_TABLEAU } from "@/briques/tableau-scene/trois-styles/styles";
import type { EmpreinteVideo, ResultatGarde } from "@/briques/variete-commune/types";

const LE = "2026-11-17T10:00:00.000Z";
const garde = (ok: boolean): ResultatGarde => ({ ok, score: ok ? 0 : 1, axesCommuns: [], phrase: "" });
const refuseHabillage = (...habillages: string[]) => (e: EmpreinteVideo): ResultatGarde =>
  garde(!habillages.some((h) => e.axes.habillage?.includes(h)));

describe("stylesAEviter", () => {
  it("refus absent → []", () => {
    expect(stylesAEviter(undefined, "v1", LE)).toEqual([]);
  });

  it("refus qui rejette l'habillage « ardoise » → [\"ardoise\"]", () => {
    expect(stylesAEviter(refuseHabillage("ardoise"), "v1", LE)).toEqual(["ardoise"]);
  });

  it("refus qui accepte tout → []", () => {
    expect(stylesAEviter(() => garde(true), "v1", LE)).toEqual([]);
  });

  it("ordre = ordre de STYLES_TABLEAU", () => {
    const tous = stylesAEviter(() => garde(false), "v1", LE);
    expect(tous).toEqual([...STYLES_TABLEAU]);
    const deux = stylesAEviter(refuseHabillage("paperboard", "tableau-blanc"), "v1", LE);
    expect(deux).toEqual(STYLES_TABLEAU.filter((s) => s !== "ardoise"));
  });

  it("refus qui lève pour un style → ce style n'est pas évité", () => {
    const refus = (e: EmpreinteVideo): ResultatGarde => {
      if (e.axes.habillage?.includes("ardoise")) throw new Error("boum");
      return garde(false);
    };
    expect(stylesAEviter(refus, "v1", LE)).toEqual(["tableau-blanc", "paperboard"]);
    expect(stylesAEviter(() => { throw new Error("boum"); }, "v1", LE)).toEqual([]);
  });

  it("déterministe", () => {
    const refus = refuseHabillage("ardoise");
    expect(stylesAEviter(refus, "v1", LE)).toEqual(stylesAEviter(refus, "v1", LE));
  });

  it("passe l'identifiant, la date et le format tableau à la garde", () => {
    const vus: EmpreinteVideo[] = [];
    stylesAEviter((e) => { vus.push(e); return garde(true); }, "vX", LE);
    expect(vus.map((e) => [e.videoId, e.le, e.formatId])).toEqual(STYLES_TABLEAU.map(() => ["vX", LE, "tableau"]));
  });
});
