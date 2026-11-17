import { describe, expect, it } from "vitest";
import { STYLES_TABLEAU, type StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { tirerStyleTableau, type EntreeHistoriqueStyle } from "@/moteurs/montage-tableau/tirage-style";

const ids = Array.from({ length: 20 }, (_, i) => `video-${i}`);
const [s0, s1, s2] = STYLES_TABLEAU as readonly StyleTableau[];
const historiques: EntreeHistoriqueStyle[][] = [
  [],
  [{ videoId: "a", style: s0! }],
  [{ videoId: "a", style: s0! }, { videoId: "b", style: s1! }],
];

describe("tirerStyleTableau : paramètre facultatif eviter", () => {
  it("eviter absent ou vide : même style que sans paramètre", () => {
    for (const id of ids) for (const h of historiques) {
      const base = tirerStyleTableau(id, h);
      expect(tirerStyleTableau(id, h, undefined)).toBe(base);
      expect(tirerStyleTableau(id, h, [])).toBe(base);
    }
  });

  it("un style évité n'est jamais tiré s'il en reste un autre", () => {
    for (const id of ids) for (const h of historiques) {
      expect(tirerStyleTableau(id, h, ["ardoise"])).not.toBe("ardoise");
    }
  });

  it("tout évité : règle d'aujourd'hui (récents seuls)", () => {
    for (const id of ids) for (const h of historiques) {
      expect(tirerStyleTableau(id, h, [...STYLES_TABLEAU])).toBe(tirerStyleTableau(id, h));
    }
  });

  it("récents + évités couvrent tout : règle d'aujourd'hui", () => {
    const h = historiques[2]!;
    for (const id of ids) expect(tirerStyleTableau(id, h, [s2!])).toBe(tirerStyleTableau(id, h));
  });

  it("vidéo déjà notée : son style même s'il est dans eviter", () => {
    expect(tirerStyleTableau("a", [{ videoId: "a", style: s0! }], [s0!])).toBe(s0);
  });
});
