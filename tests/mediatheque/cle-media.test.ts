import { describe, expect, it } from "vitest";
import { cleMediaRendu, idFichierDeCle, typeMimeDeCle } from "@/domaine/mediatheque/cle-media";
import { TYPE_ENTITE_VISUEL } from "@/domaine/mediatheque/types-entite";

describe("clé d'un média de rendu", () => {
  it("garde la clé déjà écrite par le rendu, sans la réécrire", () => {
    expect(cleMediaRendu("studio/dev/visuel/vis_1/page-1@1x.png")).toBe("studio/dev/visuel/vis_1/page-1@1x.png");
  });
  it("refuse une clé vide, absolue ou qui remonte", () => {
    for (const c of ["", "/a/b.png", "a/../b.png", "a//b.png", "a\\b.png"]) expect(() => cleMediaRendu(c)).toThrow();
  });
  it("donne le même identifiant de fichier pour la même clé, et un autre pour une autre", () => {
    const a = idFichierDeCle("studio/dev/visuel/v/p1.png");
    expect(a).toBe(idFichierDeCle("studio/dev/visuel/v/p1.png"));
    expect(a).not.toBe(idFichierDeCle("studio/dev/visuel/v/p2.png"));
    expect(a).toMatch(/^f-[A-Za-z0-9_-]{1,40}$/);
  });
  it("devine le type du média d'après l'extension", () => {
    expect(typeMimeDeCle("x/a.png")).toBe("image/png");
    expect(typeMimeDeCle("x/a.PDF")).toBe("application/pdf");
    expect(typeMimeDeCle("x/a.webp")).toBe("image/webp");
    expect(typeMimeDeCle("x/a.bin")).toBe("application/octet-stream");
  });
  it("nomme le type d'entité des rendus", () => {
    expect(TYPE_ENTITE_VISUEL).toBe("visuel");
  });
});
