/**
 * Lot S (08/11, Williams) — réseau(x) d'une vidéo : fonction pure, première source qui donne un résultat.
 * Générateur → livraison image → vidéo (sans « aucune ») → entrées image → vidéo → sorties → réseaux par défaut (précis = faux).
 */
import { describe, expect, it } from "vitest";
import { aCeReseau, estIdReseau, reseauxDeLaVideo } from "@/domaine/reseaux-video";

const PAR_DEFAUT = ["linkedin", "instagram"] as const;
const base = { sortiesReseaux: [] as unknown[], parDefaut: PAR_DEFAUT };

describe("estIdReseau", () => {
  it("reconnaît les six réseaux et refuse le reste", () => {
    for (const r of ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"]) expect(estIdReseau(r)).toBe(true);
    for (const r of ["", "twitter", "LinkedIn", null, undefined, 3, {}]) expect(estIdReseau(r)).toBe(false);
  });
});

describe("reseauxDeLaVideo", () => {
  it("1. le réseau du générateur passe en premier, précis", () => {
    const r = reseauxDeLaVideo({ ...base, reseau: "tiktok", entreesIV: ["facebook"], sortiesReseaux: [["linkedin"]] });
    expect(r).toEqual({ reseaux: ["tiktok"], precis: true });
  });

  it("2. image → vidéo : la livraison, sans les réseaux « aucune », dans l'ordre du registre", () => {
    const r = reseauxDeLaVideo({
      ...base,
      entreesIV: ["facebook"],
      livraisonIV: [
        { reseau: "facebook", version: "longue" },
        { reseau: "youtube-shorts", version: "aucune" },
        { reseau: "linkedin", version: "courte" },
      ],
    });
    expect(r).toEqual({ reseaux: ["linkedin", "facebook"], precis: true });
  });

  it("2. image → vidéo : rien de livré (ou tout en « aucune »), on lit les entrées", () => {
    expect(reseauxDeLaVideo({ ...base, entreesIV: ["facebook", "linkedin"], livraisonIV: [] })).toEqual({ reseaux: ["linkedin", "facebook"], precis: true });
    expect(reseauxDeLaVideo({ ...base, entreesIV: ["instagram"], livraisonIV: [{ reseau: "linkedin", version: "aucune" }] })).toEqual({ reseaux: ["instagram"], precis: true });
  });

  it("3. l'union des réseaux des sorties, sans doublon", () => {
    const r = reseauxDeLaVideo({ ...base, sortiesReseaux: [["facebook", "linkedin"], undefined, ["facebook"]] });
    expect(r).toEqual({ reseaux: ["linkedin", "facebook"], precis: true });
  });

  it("4. sinon les réseaux par défaut, non précis", () => {
    expect(reseauxDeLaVideo({ ...base })).toEqual({ reseaux: ["linkedin", "instagram"], precis: false });
    expect(reseauxDeLaVideo({ ...base, sortiesReseaux: [undefined, []] })).toEqual({ reseaux: ["linkedin", "instagram"], precis: false });
  });

  it("écarte les valeurs inconnues (et retombe sur la source suivante si rien ne reste)", () => {
    expect(reseauxDeLaVideo({ ...base, reseau: "twitter" as never, entreesIV: ["x", 4, "facebook"] })).toEqual({ reseaux: ["facebook"], precis: true });
    expect(reseauxDeLaVideo({ ...base, entreesIV: ["x"] })).toEqual({ reseaux: ["linkedin", "instagram"], precis: false });
  });

  it("garde YouTube et YouTube Shorts distincts", () => {
    const r = reseauxDeLaVideo({ ...base, entreesIV: ["youtube-shorts", "youtube"] });
    expect(r.reseaux).toHaveLength(2);
    expect(r.reseaux).toContain("youtube");
    expect(r.reseaux).toContain("youtube-shorts");
  });

  it("ne plante pas sur des données abîmées", () => {
    expect(() => reseauxDeLaVideo({ ...base, entreesIV: "linkedin" as never, livraisonIV: [null, 3, { reseau: 4 }] as never })).not.toThrow();
  });
});

describe("aCeReseau", () => {
  it("dit si un réseau est dans la liste", () => {
    expect(aCeReseau(["linkedin", "facebook"], "facebook")).toBe(true);
    expect(aCeReseau(["linkedin"], "facebook")).toBe(false);
    expect(aCeReseau([], "linkedin")).toBe(false);
  });
});
