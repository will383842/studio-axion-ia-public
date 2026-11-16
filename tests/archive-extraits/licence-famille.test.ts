import { describe, expect, it } from "vitest";
import { licencePlusRestrictive } from "@/briques/archive-extraits/licence";
import { familleDeVideo } from "@/briques/archive-extraits/famille";
import { etatLicence } from "@/domaine/derivations";
import type { Licence, Video } from "@/domaine/types";

const lic = (p: Partial<Licence>): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [], ...p });
const vid = (id: string, p: Record<string, unknown> = {}) => ({ id, ...p }) as unknown as Video;

describe("licencePlusRestrictive", () => {
  it("liste vide : propriété commerciale, tous réseaux", () => {
    expect(licencePlusRestrictive([])).toEqual({ type: "propriete", usageCommercial: true, reseaux: [] });
  });
  it("propriété + libre limitée à LinkedIn : commerciale, réseaux linkedin", () => {
    const r = licencePlusRestrictive([lic({}), lic({ type: "libre", reseaux: ["linkedin"] })]);
    expect(r.usageCommercial).toBe(true);
    expect(r.reseaux).toEqual(["linkedin"]);
    expect(r.type).toBe("libre");
  });
  it("une a-verifier contamine", () => {
    expect(licencePlusRestrictive([lic({}), lic({ type: "a-verifier" }), lic({ type: "libre" })]).type).toBe("a-verifier");
  });
  it("usage non commercial se propage", () => {
    expect(licencePlusRestrictive([lic({}), lic({ usageCommercial: false })]).usageCommercial).toBe(false);
  });
  it("l'expiration la plus proche se propage", () => {
    const r = licencePlusRestrictive([lic({ expireLe: "2027-06-01" }), lic({ expireLe: "2027-01-01" }), lic({})]);
    expect(r.expireLe).toBe("2027-01-01");
    expect(etatLicence(r, new Date("2027-02-01"))).toBe("expiree");
  });
  it("crédits concaténés sans doublon", () => {
    const r = licencePlusRestrictive([lic({ creditObligatoire: "A" }), lic({ creditObligatoire: "B" }), lic({ creditObligatoire: "A" })]);
    expect(r.creditObligatoire).toBe("A · B");
  });
  it("LinkedIn ∩ TikTok : a-verifier, jamais « tous »", () => {
    const r = licencePlusRestrictive([lic({ reseaux: ["linkedin"] }), lic({ reseaux: ["tiktok"] })]);
    expect(r.type).toBe("a-verifier");
    expect(etatLicence(r)).toBe("a-verifier");
  });
  it("ne modifie pas ses entrées", () => {
    const a = lic({ reseaux: ["linkedin", "tiktok"] });
    licencePlusRestrictive([a, lic({ reseaux: ["tiktok"] })]);
    expect(a.reseaux).toEqual(["linkedin", "tiktok"]);
  });
});

describe("familleDeVideo", () => {
  it("vidéo sans lien : elle seule", () => {
    expect(familleDeVideo(vid("a"), [vid("a"), vid("b")])).toEqual(["a"]);
  });
  it("mère, filles, sœurs (même mère)", () => {
    const toutes = [vid("m"), vid("a", { sourceVideoId: "m" }), vid("f", { sourceVideoId: "a" }), vid("s", { sourceVideoId: "m" }), vid("x")];
    expect(familleDeVideo(toutes[1], toutes)).toEqual(["a", "f", "m", "s"]);
  });
  it("déclinaison via entrees.declinaison.mereVideoId", () => {
    const toutes = [vid("m"), vid("d", { entrees: { declinaison: { mereVideoId: "m" } } })];
    expect(familleDeVideo(toutes[1], toutes)).toEqual(["d", "m"]);
    expect(familleDeVideo(toutes[0], toutes)).toEqual(["d", "m"]);
  });
  it("même variante", () => {
    const toutes = [vid("a", { varianteId: "v" }), vid("b", { varianteId: "v" }), vid("c", { varianteId: "w" })];
    expect(familleDeVideo(toutes[0], toutes)).toEqual(["a", "b"]);
  });
  it("même script, triée et sans doublon", () => {
    const toutes = [vid("z", { scriptId: "s" }), vid("a", { scriptId: "s" }), vid("m", { scriptId: "s", sourceVideoId: "z" })];
    expect(familleDeVideo(toutes[0], toutes)).toEqual(["a", "m", "z"]);
  });
});
