/** G3-03 — dessin des passages : champ `passages` absent = moitié / moitié actuelle ; la composition lit la mise en page du moment. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { miseEnPageDuMoment } from "../../studio-rendu/compositions/demo-facecam/PassagesDemo";
import { miseEnPageDemo, TAILLES_DEMO, type RatioDemo } from "@/moteurs/montage-demo-facecam/mise-en-page";

const RATIOS = Object.keys(TAILLES_DEMO) as RatioDemo[];
const DOSSIER = join(process.cwd(), "studio-rendu/compositions/demo-facecam");

describe("PassagesDemo : éteint = identique", () => {
  it.each(RATIOS)("sans passage, %s rend exactement la mise en page des propriétés", (r) => {
    const miseEnPage = miseEnPageDemo(r);
    expect(miseEnPageDuMoment({ miseEnPage }, 1234)).toBe(miseEnPage);
    expect(miseEnPageDuMoment({ miseEnPage, passages: [] }, 1234)).toBe(miseEnPage);
    expect(miseEnPageDuMoment({ miseEnPage, passages: [{ debutMs: 5000, finMs: 6000, disposition: "ecran-plein" }] }, 10)).toBe(miseEnPage);
  });
  it("les propriétés vides de la composition n'ont pas de passage", () => {
    const bloc = readFileSync(join(DOSSIER, "DemoFacecam.tsx"), "utf8").split("DEMO_FACECAM_VIDE")[1] ?? "";
    expect(bloc).not.toContain("passages");
  });
});

describe("PassagesDemo : passage actif", () => {
  it.each(RATIOS)("écran plein (%s) puis retour à la moitié / moitié", (r) => {
    const miseEnPage = miseEnPageDemo(r);
    const passages = [{ debutMs: 1000, finMs: 2000, disposition: "ecran-plein" as const }];
    const dedans = miseEnPageDuMoment({ miseEnPage, passages }, 1500);
    expect(dedans.ecran).toEqual({ x: 0, y: 0, largeur: miseEnPage.largeur, hauteur: miseEnPage.hauteur });
    expect(miseEnPageDuMoment({ miseEnPage, passages }, 2000)).toBe(miseEnPage);
  });
  it("facecam plein : rien d'autre que le visage", () => {
    const miseEnPage = miseEnPageDemo("4:5");
    const m = miseEnPageDuMoment({ miseEnPage, passages: [{ debutMs: 0, finMs: 500, disposition: "facecam-plein" }] }, 0);
    expect(m.facecam).toEqual({ x: 0, y: 0, largeur: 1080, hauteur: 1350 });
    expect(m.ecran.largeur * m.ecran.hauteur).toBe(0);
  });
});

describe("DemoFacecam : branchement", () => {
  const src = readFileSync(join(DOSSIER, "DemoFacecam.tsx"), "utf8");
  it("lit la mise en page du moment, plus p.miseEnPage en direct", () => {
    expect(src).toContain("miseEnPageDuMoment(p, ms)");
    expect(src).not.toMatch(/=\s*p\.miseEnPage;/);
  });
  it("n'importe aucun .ts neuf (piège Dockerfile) : seuls mise-en-page, proprietes et PassagesDemo", () => {
    const pass = readFileSync(join(DOSSIER, "PassagesDemo.tsx"), "utf8");
    const imports = [...pass.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.every((i) => /montage-demo-facecam\/(mise-en-page|proprietes)$/.test(i))).toBe(true);
  });
});
