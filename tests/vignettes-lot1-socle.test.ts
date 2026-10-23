/**
 * LOT 1 DES VIGNETTES — socle v2 (17/10). Tests purs : aucun navigateur, aucun réseau.
 * Blocs : socle (étape 1), titre et mises (étape 3), composition (étape 4).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COULEURS_VIDEO } from "../src/briques/habillage/charte-video";
import { COULEURS_MINIATURE } from "../studio-rendu/compositions/commune/miniature-mise-en-page";
import { formatMiniature, unitesCouverture } from "../studio-rendu/compositions/commune/miniature-mise-en-page";
import { boiteTitre, MISES, MISE_INSTAGRAM, placerSujet } from "../studio-rendu/compositions/commune/vignette/mises";
import { mettreTitreVignette } from "../studio-rendu/compositions/commune/vignette/titre";
import { metaVignette, AMBIANCES, ZONES_SURES, dimensionsVignette, proprietesVignette, REPERES } from "../studio-rendu/compositions/commune/vignette/socle";

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("vignettes lot 1 · socle", () => {
  it("dimensions : 16:9 = 1280×720, 9:16 = 1080×1920, tout autre ratio refusé", () => {
    expect(dimensionsVignette("16:9")).toEqual({ largeur: 1280, hauteur: 720 });
    expect(dimensionsVignette("9:16")).toEqual({ largeur: 1080, hauteur: 1920 });
    expect(() => dimensionsVignette("4:5" as never)).toThrow();
    expect(() => dimensionsVignette("1:1" as never)).toThrow();
  });

  it("repères fixes : liseré 16/22 px, carré A (44,36,62) et (84,456,86), signature en 9:16 seulement", () => {
    expect(REPERES["16:9"].lisere).toBe(16);
    expect(REPERES["9:16"].lisere).toBe(22);
    expect(REPERES["16:9"].carre).toEqual({ x: 44, y: 36, taille: 62 });
    expect(REPERES["9:16"].carre).toEqual({ x: 84, y: 456, taille: 86 });
    expect(REPERES["16:9"].signature).toBeNull();
    expect(REPERES["9:16"].signature).toEqual({ x: 190, y: 484 });
  });

  it("zones sûres : 9:16 y 420→1500, x ≤ 940 ; 16:9 coin durée 140×60", () => {
    expect(ZONES_SURES["9:16"]).toEqual({ haut: 420, bas: 1500, droite: 940 });
    expect(ZONES_SURES["16:9"].coinDuree).toEqual({ largeur: 140, hauteur: 60 });
  });

  it("couleurs : celles de la charte vidéo ; pavé encre #E07040, pavé ivoire #B44F29", () => {
    expect(AMBIANCES.encre.fond).toBe(COULEURS_VIDEO.ecriture);
    expect(AMBIANCES.encre.paveTexte).toBe(COULEURS_VIDEO.ecriture);
    expect(AMBIANCES.ivoire.texte).toBe(COULEURS_VIDEO.ecriture);
    expect(AMBIANCES.ivoire.pave).toBe(COULEURS_VIDEO.soulignement);
    expect(AMBIANCES.ivoire.pave).toBe("#B44F29");
    expect(AMBIANCES.encre.pave).toBe(COULEURS_MINIATURE.orangeVif);
    expect(AMBIANCES.encre.pave).toBe("#E07040");
  });

  it("contraste pavé / texte du pavé ≥ 3:1 dans les 2 ambiances", () => {
    for (const a of ["encre", "ivoire"] as const) expect(contraste(AMBIANCES[a].pave, AMBIANCES[a].paveTexte)).toBeGreaterThanOrEqual(3);
  });

  it("le carré A et le liseré sont les mêmes dans les 2 ambiances et toutes les mises", () => {
    const vues = new Set<string>();
    for (const ambiance of ["encre", "ivoire"] as const)
      for (const mise of ["m1", "m2", "m3"] as const)
        for (const ratio of ["16:9", "9:16"] as const) {
          const p = proprietesVignette({ ratio, ambiance, mise });
          vues.add(JSON.stringify([ratio, p.reperes.lisere, p.reperes.carre, p.reperes.signature]));
        }
    expect(vues.size).toBe(2);
  });

  it("Instagram : refus avec un sujet ou une image, refus en 16:9, accepté seul en 9:16", () => {
    expect(() => proprietesVignette({ ratio: "9:16", instagram: true, sujet: "https://x/s.webp" })).toThrow();
    expect(() => proprietesVignette({ ratio: "9:16", instagram: true, image: "https://x/i.png" })).toThrow();
    expect(() => proprietesVignette({ ratio: "16:9", instagram: true })).toThrow();
    const p = proprietesVignette({ ratio: "9:16", instagram: true });
    expect(p.instagram).toBe(true);
    expect(p.image).toBeUndefined();
    expect(p.sujet).toBeUndefined();
  });

  it("valeurs par défaut : ambiance encre, mise m1", () => {
    const p = proprietesVignette({ ratio: "16:9" });
    expect(p.ambiance).toBe("encre");
    expect(p.mise).toBe("m1");
  });
});

/** Mesure approchée de Montserrat ExtraBold en capitales (la vraie mesure vient du navigateur de Remotion). */
const mesure = (texte: string, taille: number) => [...texte].reduce((s, c) => s + (/[IJ.,:;!?'’ \u00a0]/.test(c) ? 0.27 : /[MW]/.test(c) ? 0.85 : 0.64), 0) * taille;

describe("vignettes lot 1 · titre", () => {
  const titre = (couverture: string, motCle: string, ratio: "16:9" | "9:16" = "16:9", mise: "m1" | "m2" | "m3" = "m1") =>
    mettreTitreVignette({ couverture, motCle, ratio, mise, mesurer: mesure });

  it("« OÙ FUIT VOTRE TEMPS » : 2 lignes, le pavé est « TEMPS »", () => {
    const t = titre("Où fuit votre temps", "temps");
    expect(t.lignes.length).toBe(2);
    const paves = t.lignes.flat().filter((u) => u.pave);
    expect(paves.map((u) => u.texte)).toEqual(["TEMPS"]);
    expect(t.lignes.flat().map((u) => u.texte).join(" ")).toBe("OÙ FUIT VOTRE TEMPS");
  });

  it("« UN DEVIS EN 2 MINUTES » : « 2 MINUTES » dans un seul pavé", () => {
    const t = titre("Un devis en 2 minutes", "2 minutes", "9:16", "m2");
    const paves = t.lignes.flat().filter((u) => u.pave);
    expect(paves.map((u) => u.texte)).toEqual(["2 MINUTES"]);
    expect(t.lignes.length).toBeLessThanOrEqual(2);
  });

  it("jamais plus de 2 lignes ; taille ≥ 85 % de la mise, sinon « trop »", () => {
    for (const ratio of ["16:9", "9:16"] as const)
      for (const mise of ["m1", "m2", "m3"] as const)
        for (const c of ["Où fuit votre temps", "Un devis en 2 minutes", "Licencié par SMS ?", "Les cinq erreurs qui coûtent cher à votre entreprise"]) {
          const t = titre(c, c.split(" ").pop() ?? "", ratio, mise);
          expect(t.lignes.length).toBeLessThanOrEqual(2);
          const base = MISES[ratio][mise].titre.taille;
          if (!t.trop) expect(t.taillePx).toBeGreaterThanOrEqual(base * 0.85);
          expect(t.taillePx).toBeLessThanOrEqual(base);
        }
    expect(titre("Les cinq erreurs qui coûtent cher à votre entreprise", "erreurs").trop).toBe(true);
    expect(titre("Où fuit votre temps", "temps").trop).toBe(false);
  });

  it("au plus un pavé, même si le mot clé revient", () => {
    const t = titre("Le temps du temps", "temps");
    expect(t.lignes.flat().filter((u) => u.pave).length).toBe(1);
  });
});

describe("vignettes lot 1 · mises", () => {
  const ratios = ["16:9", "9:16"] as const;
  const mises = ["m1", "m2", "m3"] as const;

  it("le titre tient dans la zone sûre et ne recouvre pas le carré A ni la signature", () => {
    for (const ratio of ratios)
      for (const mise of mises) {
        const t = mettreTitreVignette({ couverture: "Où fuit votre temps", motCle: "temps", ratio, mise, mesurer: mesure });
        const b = boiteTitre(MISES[ratio][mise].titre, t.lignes.length, t.taillePx);
        const sol = `${ratio} ${mise}`;
        const r = REPERES[ratio];
        const dehors = (a: { x: number; y: number; l: number; h: number }) => b.x + b.largeur <= a.x || a.x + a.l <= b.x || b.y + b.hauteur <= a.y || a.y + a.h <= b.y;
        expect(dehors({ x: r.carre.x, y: r.carre.y, l: r.carre.taille, h: r.carre.taille }), `carré ${sol}`).toBe(true);
        if (ratio === "9:16") {
          expect(b.y, sol).toBeGreaterThanOrEqual(ZONES_SURES["9:16"].haut);
          expect(b.y + b.hauteur, sol).toBeLessThanOrEqual(ZONES_SURES["9:16"].bas);
          expect(b.x + b.largeur, sol).toBeLessThanOrEqual(ZONES_SURES["9:16"].droite);
          expect(dehors({ x: r.signature!.x, y: r.signature!.y, l: 330, h: 30 }), `signature ${sol}`).toBe(true);
        } else {
          const c = ZONES_SURES["16:9"].coinDuree;
          expect(dehors({ x: 1280 - c.largeur, y: 720 - c.hauteur, l: c.largeur, h: c.hauteur }), `coin ${sol}`).toBe(true);
        }
      }
  });

  it("la mise Instagram est centrée, dans la zone sûre, sans sujet", () => {
    expect(MISE_INSTAGRAM.sujet).toBeUndefined();
    expect(MISE_INSTAGRAM.titre.align).toBe("centre");
    const b = boiteTitre(MISE_INSTAGRAM.titre, 2, MISE_INSTAGRAM.titre.taille);
    expect(b.y).toBeGreaterThanOrEqual(420);
    expect(b.y + b.hauteur).toBeLessThanOrEqual(1500);
    expect(b.x + b.largeur).toBeLessThanOrEqual(940);
  });

  it("les 3 mises d'un même ratio diffèrent (titre ou sujet)", () => {
    for (const ratio of ratios) {
      const vues = new Set(mises.map((m) => JSON.stringify([MISES[ratio][m].titre, MISES[ratio][m].sujet])));
      expect(vues.size).toBe(3);
    }
  });

  it("placerSujet : facecam en m1 16:9 = visage de 560 px de haut centré en (960, 330), comme g-facecam.js", () => {
    const texte = readFileSync("docs/vignettes/v2/images/cadrages.js", "utf8");
    const cadrages = JSON.parse(texte.slice(texte.indexOf("window.CADRAGES =") + "window.CADRAGES =".length).trim().replace(/;$/, ""));
    const c = cadrages.facecam;
    const p = placerSujet({ l: c.l, h: c.h }, c.visage, "m1", "16:9");
    const [x0, y0, x1, y1] = c.visage as number[];
    expect((y1 - y0) * p.hauteur).toBeCloseTo(560, 0);
    expect(p.gauche + ((x0 + x1) / 2) * p.largeur).toBeCloseTo(960, 0);
    expect(p.haut + ((y0 + y1) / 2) * p.hauteur).toBeCloseTo(330, 0);
  });

  it("placerSujet sans boîte : visage supposé au tiers haut, centré sur le point visé", () => {
    const p = placerSujet({ l: 1000, h: 2000 }, undefined, "m1", "9:16");
    const cx = p.gauche + 0.5 * p.largeur;
    expect(cx).toBeCloseTo(600, 0);
  });

  it("zone titre du format R4 inchangée (garde de non-régression de l'import)", () => {
    expect(formatMiniature("16:9").largeur).toBe(1280);
    expect(unitesCouverture("a b")).toEqual(["A", "B"]);
  });
});

describe("vignettes lot 1 · composition", () => {
  it("Racine.tsx déclare VignetteAxion (1 image) et lit sa taille dans le ratio", () => {
    const racine = readFileSync("studio-rendu/compositions/Racine.tsx", "utf8");
    expect(racine).toMatch(/id="VignetteAxion"/);
    expect(racine).toMatch(/metaVignette\(/);
    expect(racine.indexOf('id="VignetteAxion"')).toBeGreaterThan(racine.indexOf('id="Miniature"'));
    expect(readFileSync("studio-rendu/compositions/commune/index.ts", "utf8")).toMatch(/VignetteAxion/);
  });

  it("calculateMetadata : 1280×720 en 16:9, 1080×1920 en 9:16", () => {
    expect(metaVignette({ ratio: "16:9" })).toEqual({ width: 1280, height: 720 });
    expect(metaVignette({ ratio: "9:16" })).toEqual({ width: 1080, height: 1920 });
  });
});
