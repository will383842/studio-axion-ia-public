/** QUAL-5 : sous-titres du tutoriel sans voix composé (base minimal, sobre, bande de fond gris, couleurs charte). */
import { describe, expect, it } from "vitest";
import { fabriquerSousTitres } from "@/briques/sous-titres";
import { horodaterTexte } from "@/domaine/derivations";
import { planCarteFin } from "@/moteurs/montage-tutoriel-outil/proprietes";
import type { PlanValide } from "@/briques/plan-scenes/schema";
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
    expect(c.couleurs).toEqual({ texte: "#141413", accent: "#B23F16", contour: "#E8E6DC" });
    expect(c.base).toBe("minimal");
    expect(c.largeurMaxPx).toBe(Math.floor(0.9 * 1080));
    expect(c.bandeFond).toMatchObject({ couleur: "#E8E6DC", opacite: 1, xPx: 0, largeurPx: 1080, fonduPx: 0 });
    const b = c.bandeFond!;
    // tour 4 : la bande grise va jusqu'au BAS de l'image (aucune bande ivoire vide dessous)
    expect(b.yPx + b.hauteurPx).toBe(c.hauteur);
    expect(b.hauteurPx).toBeGreaterThanOrEqual(195);
    // la ligne (centre = basPct) est DANS la bande
    const centrePx = (basPct / 100) * c.hauteur;
    expect(centrePx).toBeGreaterThan(b.yPx);
    expect(centrePx).toBeLessThan(b.yPx + b.hauteurPx);
    expect(c.segments.every((x) => x.position === "auto" && x.style === "base")).toBe(true);
  });

  it("4:5 : la bande va jusqu'au bas (≤ 8 % ajoutés) ; 9:16 : elle garde sa hauteur normale (basPct−9 → basPct+6)", () => {
    const c45 = calqueSansVoix({ segments: segments("4:5"), ratio: "4:5" });
    expect(c45.bandeFond!.yPx + c45.bandeFond!.hauteurPx).toBe(c45.hauteur);
    const bas = basPctSansVoix("9:16");
    const c916 = calqueSansVoix({ segments: segments("9:16"), ratio: "9:16" });
    const b = c916.bandeFond!;
    expect(b.yPx + b.hauteurPx).toBeLessThan(c916.hauteur);
    expect(b.yPx).toBe(Math.round(((bas - 9) / 100) * c916.hauteur));
    expect(b.yPx + b.hauteurPx).toBe(Math.round(((bas + 6) / 100) * c916.hauteur));
    expect(b.hauteurPx / c916.hauteur).toBeLessThan(0.2);
  });

  it("police : pas d'`encre` (Inter Bold) donc Manrope ; mots composés intacts", () => {
    const c = calqueSansVoix({ segments: segments(), ratio: "4:5" });
    expect(c.encre).toBeUndefined();
    expect(c.pastille).toBeUndefined();
    const mots = horodaterTexte("Prenez rendez-vous. Peut-être c'est-à-dire.", 2.5);
    const s2 = fabriquerSousTitres({ texte: "Prenez rendez-vous. Peut-être c'est-à-dire.", dureeSec: 5, mots, ratio: "4:5", ...optionsSousTitresSansVoix("4:5") });
    const texte = normaliserSegments(s2).flatMap((g) => g.mots.map((m) => m.mot)).join(" ");
    expect(texte).toBe("Prenez rendez-vous. Peut-être c'est-à-dire.");
  });

  it("16:9 : l'échelle suit le petit côté", () => {
    const c = calqueSansVoix({ segments: segments("16:9"), ratio: "16:9" });
    expect(c.echelleTexte).toBe(1);
    expect(c.bandeFond!.largeurPx).toBe(1920);
  });
});

describe("carte de fin sans voix (tour 4)", () => {
  const plan = { version: "plan-scenes-1", format: { largeur: 1080, hauteur: 1350, fps: 25 }, dureeMs: 1000, habillage: { fond: "ivoire", accent: "terracotta" }, mots: [], scenes: [] } as unknown as PlanValide;
  const base = { plan, fin: { titre: "Prendre rendez-vous", sousTitre: "axion-ia.com" }, finMs: 2500 };
  it("avec voix : identique à avant (sortie en fondu dans la durée)", () => {
    const s = planCarteFin(base).scenes[0];
    expect(s.finMs).toBe(2500);
    expect(s.transition.sortie).toBe("fondu");
  });
  it("sans voix composé : la scène dépasse la durée, la sortie n'est jamais jouée", () => {
    const p = planCarteFin({ ...base, compositionSansVoix: {} as never });
    expect(p.dureeMs).toBe(2500);
    expect(p.scenes[0].finMs - p.scenes[0].transition.dureeMs).toBeGreaterThanOrEqual(2500);
    expect(p.scenes[0].parametres).toMatchObject({ texte: "Prendre rendez-vous" });
  });
});
