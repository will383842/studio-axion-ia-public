/** G3-03 — dessin des passages : champ `passages` absent = moitié / moitié actuelle ; la composition lit la mise en page du moment. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cadrageDuMoment, miseEnPageDuMoment } from "../../studio-rendu/compositions/demo-facecam/PassagesDemo";
import { miseEnPageDemo, recadrage, TAILLES_DEMO, type RatioDemo, type RectPx } from "@/moteurs/montage-demo-facecam/mise-en-page";

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
  it("lit la mise en page ET les recadrages du moment, plus p.miseEnPage en direct", () => {
    expect(src).toContain("cadrageDuMoment(p, ms)");
    expect(src).not.toMatch(/recadrage=\{p\./);
    expect(src).not.toMatch(/=\s*p\.miseEnPage;/);
  });
  it("n'importe aucun .ts neuf (piège Dockerfile) : seuls mise-en-page, proprietes et PassagesDemo", () => {
    const pass = readFileSync(join(DOSSIER, "PassagesDemo.tsx"), "utf8");
    const imports = [...pass.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.every((i) => /montage-demo-facecam\/(mise-en-page|proprietes)$/.test(i))).toBe(true);
  });
});

/* Critère de fini du dessin : pendant un passage, la source remplit la boîte du moment sans étirer ni bande vide. */
const SOURCES = [{ largeur: 1920, hauteur: 1080 }, { largeur: 1080, hauteur: 1920 }, { largeur: 3840, hauteur: 1080 }];
const PARTIES = ["entier", "gauche", "droite", "haut", "bas"] as const;
const DISPOSITIONS = ["ecran-plein", "facecam-plein"] as const;
const dansSource = (r: RectPx, s: { largeur: number; hauteur: number }) => r.x >= 0 && r.y >= 0 && r.x + r.largeur <= s.largeur + 0.01 && r.y + r.hauteur <= s.hauteur + 0.01;

function proprietes(r: RatioDemo, source: { largeur: number; hauteur: number }, partieE: (typeof PARTIES)[number], partieF: (typeof PARTIES)[number], disposition: (typeof DISPOSITIONS)[number]) {
  const miseEnPage = miseEnPageDemo(r);
  return {
    miseEnPage,
    passages: [{ debutMs: 0, finMs: 1000, disposition }],
    sourceEcran: source,
    sourceFacecam: source,
    recadrageEcran: recadrage(source, partieE, miseEnPage.ecran),
    recadrageFacecam: recadrage(source, partieF, miseEnPage.facecam, { x: 0.4, y: 0.3 }),
  };
}

describe("PassagesDemo : recadrage du moment", () => {
  it.each(RATIOS)("%s : le recadrage a les proportions de la boîte, reste dans la source et dans sa partie", (r) => {
    for (const source of SOURCES) for (const partie of PARTIES) for (const disposition of DISPOSITIONS) {
      const p = proprietes(r, source, partie, partie, disposition);
      const { miseEnPage, recadrageEcran, recadrageFacecam } = cadrageDuMoment(p, 500);
      const [boite, rec, avant] = disposition === "ecran-plein" ? [miseEnPage.ecran, recadrageEcran, p.recadrageEcran] : [miseEnPage.facecam, recadrageFacecam, p.recadrageFacecam];
      expect(Math.abs(rec.largeur / rec.hauteur / (boite.largeur / boite.hauteur) - 1)).toBeLessThan(0.01);
      expect(dansSource(rec, source)).toBe(true);
      // Jamais l'autre partie : si l'ancien recadrage tenait dans une moitié, le nouveau aussi.
      if (partie === "gauche") expect(rec.x + rec.largeur).toBeLessThanOrEqual(Math.floor(source.largeur / 2) + 0.01);
      if (partie === "droite") expect(rec.x).toBeGreaterThanOrEqual(Math.ceil(source.largeur / 2) - 0.01);
      if (partie === "haut") expect(rec.y + rec.hauteur).toBeLessThanOrEqual(Math.floor(source.hauteur / 2) + 0.01);
      if (partie === "bas") expect(rec.y).toBeGreaterThanOrEqual(Math.ceil(source.hauteur / 2) - 0.01);
      expect(avant.largeur).toBeGreaterThan(0);
    }
  });
  it("garde le centre du visage du cadrage moitié / moitié quand la place le permet", () => {
    const p = proprietes("4:5", { largeur: 1920, hauteur: 1080 }, "entier", "entier", "facecam-plein");
    const { recadrageFacecam } = cadrageDuMoment(p, 10);
    const cx = (r: RectPx) => r.x + r.largeur / 2;
    expect(Math.abs(cx(recadrageFacecam) - cx(p.recadrageFacecam))).toBeLessThan(1);
    expect(recadrageFacecam.hauteur).toBeCloseTo(1080, 0);
  });
  it.each(RATIOS)("éteint (%s) : mêmes objets de recadrage qu'avant", (r) => {
    const p = proprietes(r, { largeur: 1920, hauteur: 1080 }, "gauche", "droite", "ecran-plein");
    const sans = cadrageDuMoment({ ...p, passages: undefined }, 500);
    expect(sans.miseEnPage).toBe(p.miseEnPage);
    expect(sans.recadrageEcran).toBe(p.recadrageEcran);
    expect(sans.recadrageFacecam).toBe(p.recadrageFacecam);
    const hors = cadrageDuMoment(p, 5000);
    expect(hors.recadrageEcran).toBe(p.recadrageEcran);
    expect(hors.recadrageFacecam).toBe(p.recadrageFacecam);
  });
  it("disposition « moitie » : rien ne change", () => {
    const p = { ...proprietes("4:5", { largeur: 1920, hauteur: 1080 }, "entier", "entier", "ecran-plein"), passages: [{ debutMs: 0, finMs: 1000, disposition: "moitie" as const }] };
    expect(cadrageDuMoment(p, 500).recadrageFacecam).toBe(p.recadrageFacecam);
  });
  it("sous-titres du calque : masqués quand la bande est vide (facecam plein)", () => {
    const src = readFileSync(join(DOSSIER, "DemoFacecam.tsx"), "utf8");
    expect(src).toMatch(/p\.calqueSousTitres && sousTitres\.largeur \* sousTitres\.hauteur > 0/);
  });
});
