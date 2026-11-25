/** QUAL-5 : sous-titres du tutoriel sans voix composé (base minimal, sobre, bande de fond gris, couleurs charte). */
import { describe, expect, it } from "vitest";
import { fabriquerSousTitres } from "@/briques/sous-titres";
import { basPctSansVoix, calqueSansVoix, normaliserSegments, optionsSousTitresSansVoix } from "@/moteurs/montage-tutoriel-outil/sous-titres-sans-voix";

const TEXTE = "Vous perdez du temps à compter vos stocks à la main ? Voici un tableau de bord qui le fait pour vous. En haut, trois chiffres : les articles en stock, ceux qui passent sous le seuil, et la valeur totale. Vous décidez en une minute au lieu d'une heure.";

function segments(ratio: "4:5" | "9:16" | "16:9" = "4:5") {
  return fabriquerSousTitres({ texte: TEXTE, dureeSec: 20, ratio, ...optionsSousTitresSansVoix(ratio) });
}

describe("sous-titres sans voix", () => {
  it("options : base minimal, intensité sobre, bas, 90 %", () => {
    const o = optionsSousTitresSansVoix("4:5");
    expect(o.base).toBe("minimal");
    expect(o.intensite).toBe("sobre");
    expect(o.style.position).toBe("bas");
    expect(o.style.positionPct).toBe(basPctSansVoix("4:5"));
    expect(o.style.largeurMaxPct).toBe(90);
  });

  it("groupes de 3 à 6 mots, aucun accent après normalisation", () => {
    const s = normaliserSegments(segments());
    expect(s.length).toBeGreaterThan(3);
    for (const g of s.slice(0, -1)) expect(g.mots.length).toBeGreaterThanOrEqual(2);
    for (const g of s) {
      expect(g.mots.length).toBeLessThanOrEqual(6);
      expect(g.position).toBe("auto");
      expect(g.inclinaison).toBe(0);
      expect(g.style).toBe("base");
    }
  });

  it("calque : bande réservée, couleurs charte, taille 60 px", () => {
    const basPct = basPctSansVoix("4:5");
    const c = calqueSansVoix({ segments: segments(), ratio: "4:5" });
    expect(c.positions.milieuPct).toBe(basPct);
    expect(c.couleurs).toEqual({ texte: "#141413", accent: "#B23F16", contour: "#FAF9F5" });
    expect(c.base).toBe("minimal");
    expect(c.largeurMaxPx).toBe(Math.floor(0.9 * 1080));
    expect(c.bandeFond).toMatchObject({ couleur: "#E8E6DC", opacite: 1, xPx: 0, largeurPx: 1080, fonduPx: 0 });
    const b = c.bandeFond!;
    expect(b.hauteurPx).toBeGreaterThanOrEqual(195);
    expect(b.hauteurPx).toBeLessThanOrEqual(210);
    // la ligne (centre = basPct) est DANS la bande
    const centrePx = (basPct / 100) * c.hauteur;
    expect(centrePx).toBeGreaterThan(b.yPx);
    expect(centrePx).toBeLessThan(b.yPx + b.hauteurPx);
    expect(c.segments.every((x) => x.position === "auto" && x.style === "base")).toBe(true);
  });

  it("16:9 : l'échelle suit le petit côté", () => {
    const c = calqueSansVoix({ segments: segments("16:9"), ratio: "16:9" });
    expect(c.echelleTexte).toBe(1);
    expect(c.bandeFond!.largeurPx).toBe(1920);
  });
});
