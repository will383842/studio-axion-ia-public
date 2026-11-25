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

  it("groupes par proposition : 4 à 9 mots, aucun accent après normalisation", () => {
    const s = normaliserSegments(segments());
    expect(s.length).toBeGreaterThan(3);
    for (const g of s) {
      expect(g.mots.length).toBeLessThanOrEqual(9);
      expect(g.position).toBe("auto");
      expect(g.inclinaison).toBe(0);
      expect(g.style).toBe("base");
    }
  });

  it("fondateur : aucune carte < 3 mots sauf la dernière, toutes ≥ 1,5 s, jamais deux cartes à la fois, mots inchangés", () => {
    const brut = segments();
    const s = normaliserSegments(brut);
    for (const g of s.slice(0, -1)) expect(g.mots.length).toBeGreaterThanOrEqual(3);
    for (const g of s.slice(0, -1)) expect(g.finSec - g.debutSec).toBeGreaterThanOrEqual(1.5 - 1e-9);
    s.slice(1).forEach((g, i) => expect(g.debutSec).toBeGreaterThanOrEqual(s[i].finSec - 1e-9));
    expect(s.flatMap((g) => g.mots)).toEqual(brut.flatMap((g) => g.mots));
    // coupe à la ponctuation : « à la main ? » n'est plus seul
    const textes = s.map((g) => g.mots.map((m) => m.mot).join(" "));
    expect(textes.some((t) => t === "à la main\u00A0?")).toBe(false);
    const finsDePhrase = s.filter((g) => /[.?!]$/.test(g.mots.at(-1)!.mot)).length;
    expect(finsDePhrase).toBeGreaterThanOrEqual(4);
  });

  it("aucun trou > 0,6 s sans carte entre le premier et le dernier mot (accroche et question finale sous-titrées aussi)", () => {
    const T2 = "Vous perdez du temps à compter vos stocks à la main\u00A0? Voici un tableau de bord qui le fait pour vous. Vous voulez le même pour votre entreprise\u00A0? Prenez rendez-vous.";
    const mots = T2.split(" ").map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.38 }));
    const s = normaliserSegments([{ id: "x", debutSec: 0, finSec: 12, mots }]);
    expect(s.flatMap((g) => g.mots)).toEqual(mots);
    expect(s.every((g) => g.mots.length > 0)).toBe(true);
    expect(s[0].debutSec).toBe(mots[0].debutSec);
    s.slice(1).forEach((g, i) => expect(g.debutSec - s[i].finSec).toBeLessThanOrEqual(0.6 + 1e-9));
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
  it("sans voix composé : branche retirée, la carte est celle de la voix (durée du plan, voix inchangée)", () => {
    const p = planCarteFin({ ...base, compositionSansVoix: {} as never } as never);
    expect(p).toEqual(planCarteFin(base));
    expect(p.scenes[0].finMs).toBe(2500);
    expect(p.scenes[0].parametres).toMatchObject({ texte: "Prendre rendez-vous" });
  });
});

describe("cartes sans clignotement (tour 7)", () => {
  it("aucun trou < 0,6 s entre deux cartes : la carte reste jusqu'à la suivante", async () => {
    const { normaliserSegments, TROU_COMBLE_SEC } = await import("@/moteurs/montage-tutoriel-outil/sous-titres-sans-voix");
    const mots = "Quand un article passe sous le seuil, une alerte part toute seule. Vous décidez en une minute au lieu d'une heure.".split(" ");
    const horodates = mots.map((mot, i) => ({ mot, debutSec: i * 0.4 + (i >= 7 ? 0.2 : 0), finSec: i * 0.4 + 0.3 + (i >= 7 ? 0.2 : 0) }));
    const cartes = normaliserSegments([{ id: "s", debutSec: 0, finSec: 10, mots: horodates, style: "base", souligne: null, position: "auto", inclinaison: 0, verrouille: false } as never]);
    expect(cartes.length).toBeGreaterThan(1);
    for (let k = 0; k + 1 < cartes.length; k++) {
      const trou = cartes[k + 1].debutSec - cartes[k].finSec;
      expect(trou < 1e-9 || trou >= TROU_COMBLE_SEC).toBe(true);
    }
  });
});
