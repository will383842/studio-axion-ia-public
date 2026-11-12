import { describe, expect, it } from "vitest";
import { classerContenus, NON_PRECISE, entreesDuReseau } from "@/domaine/classement-contenus";
import { reseauxDuVisuel, typeContenuDuVisuel } from "@/domaine/visuels/reseaux-visuel";

describe("reseauxDuVisuel", () => {
  it("lit Visuel.reseaux sans doublon, dans l'ordre", () => {
    expect(reseauxDuVisuel({ reseaux: ["instagram", "linkedin", "instagram"] })).toEqual(["instagram", "linkedin"]);
  });
  it("absent ou vide : liste vide (ancien visuel)", () => {
    expect(reseauxDuVisuel({})).toEqual([]);
    expect(reseauxDuVisuel({ reseaux: [] })).toEqual([]);
  });
  it("famille -> type de contenu", () => {
    expect(typeContenuDuVisuel({ famille: "carrousel" })).toBe("carrousel");
    expect(typeContenuDuVisuel({ famille: "carrousel-continu" })).toBe("carrousel");
    expect(typeContenuDuVisuel({ famille: "infographie" })).toBe("image");
  });
});

describe("classerContenus", () => {
  it("vidéo 9:16 sortie Instagram + TikTok = 2 entrées", () => {
    const idx = classerContenus([{ id: "v1", type: "video", reseaux: ["instagram", "tiktok"] }]);
    expect(idx.entrees).toHaveLength(2);
    expect(idx.entrees.map((e) => e.reseau).sort()).toEqual(["instagram", "tiktok"]);
  });
  it("carrousel LinkedIn = 1 entrée", () => {
    const idx = classerContenus([{ id: "c1", type: "carrousel", reseaux: ["linkedin"] }]);
    expect(idx.entrees).toHaveLength(1);
    expect(idx.entrees[0]).toMatchObject({ id: "c1", type: "carrousel", reseau: "linkedin" });
  });
  it("un visuel sans réseau est rangé dans « non précisé », jamais perdu", () => {
    const idx = classerContenus([{ id: "x", type: "image" }, { id: "y", type: "image", reseaux: [] }]);
    expect(idx.entrees).toHaveLength(2);
    expect(idx.entrees.every((e) => e.reseau === NON_PRECISE)).toBe(true);
    expect(entreesDuReseau(idx, NON_PRECISE).map((e) => e.id)).toEqual(["x", "y"]);
  });
  it("compte par réseau et dérive d'une entrée vide", () => {
    const idx = classerContenus([
      { id: "a", type: "video", reseaux: ["instagram", "tiktok"] },
      { id: "b", type: "carrousel", reseaux: ["instagram"] },
      { id: "c", type: "image" },
    ]);
    expect(idx.parReseau).toEqual({ instagram: 2, tiktok: 1, [NON_PRECISE]: 1 });
    expect(classerContenus([]).entrees).toEqual([]);
  });
  it("ne modifie pas l'entrée et ignore un doublon de réseau", () => {
    const src = [{ id: "d", type: "video" as const, reseaux: ["tiktok", "tiktok"] as ("tiktok")[] }];
    const copie = JSON.stringify(src);
    expect(classerContenus(src).entrees).toHaveLength(1);
    expect(JSON.stringify(src)).toBe(copie);
  });
});
