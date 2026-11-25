/**
 * CONTOURS-b-v21s : le contour des sous-titres passe à V2 (décision de Williams, 25/11 08:00, point 1).
 * Karaoké 3 px, Impact 8 px, ombre douce (flou × 1,3, opacité − 0,1). Minimal et Bandeau ne bougent pas. Aucun rendu, 0 €.
 */
import { describe, expect, it } from "vitest";
import { donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import { cssElement, sceneAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import { GABARITS } from "@/briques/sous-titres/style";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { GabaritSousTitres, ValeurStyleSousTitres } from "@/domaine/types";

const PHRASE = "Votre patron peut-il lire vos mails ? Oui, mais jamais les mails personnels. Il faut trois jours pour vérifier.";
const MOTS = PHRASE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(0.5 + i * 0.3).toFixed(3), finSec: +(0.5 + i * 0.3 + 0.26).toFixed(3) }));
const DUREE = +(MOTS.at(-1)!.finSec + 0.4).toFixed(3);

function calque(gabarit: GabaritSousTitres, plus: Partial<Parameters<typeof donneesCalque>[0]> = {}): DonneesCalque {
  const style: ValeurStyleSousTitres = { ...STYLE_SOUS_TITRES_AVOCAT, gabarit };
  const segments = fabriquerSousTitres({ texte: PHRASE, dureeSec: DUREE, mots: MOTS, emphase: ["mails"], style, base: gabarit === "karaoke" || gabarit === "minimal" ? gabarit : undefined, intensite: "equilibre" });
  return donneesCalque({ segments, base: gabarit === "minimal" ? "minimal" : gabarit === "karaoke" ? "karaoke" : (gabarit as never), style, ...plus });
}

function css(gabarit: GabaritSousTitres, plus: Partial<Parameters<typeof donneesCalque>[0]> = {}, apres: (d: DonneesCalque) => DonneesCalque = (d) => d): Record<string, unknown> {
  const d = apres(calque(gabarit, plus));
  const t = d.segments[0].debutSec + 0.5;
  const el = sceneAuTemps(d, t);
  expect(el).toBeTruthy();
  return (cssElement(el!, d, "Manrope") as unknown as { ligne: Record<string, unknown> }).ligne;
}

describe("contours V2 (CONTOURS-b-v21s)", () => {
  it("(a) Karaoké V2 : contour 3, ombre 10,4 / 3 / 0,55", () => {
    expect(GABARITS.karaoke.contourPx).toBe(3);
    expect(GABARITS.karaoke.ombre).toEqual({ flouPx: 10.4, decalagePx: 3, opacite: 0.55 });
  });

  it("(b) Impact V2 : contour 8, ombre 13 / 6 / 0,6", () => {
    expect(GABARITS.impact.contourPx).toBe(8);
    expect(GABARITS.impact.ombre).toEqual({ flouPx: 13, decalagePx: 6, opacite: 0.6 });
  });

  it("(c) Minimal et Bandeau inchangés", () => {
    expect(GABARITS.minimal.contourPx).toBe(0);
    expect(GABARITS.minimal.ombre).toEqual({ flouPx: 10, decalagePx: 2, opacite: 0.8 });
    expect(GABARITS.bandeau.contourPx).toBe(0);
    expect(GABARITS.bandeau.ombre).toEqual({ flouPx: 0, decalagePx: 0, opacite: 0 });
  });

  it("(d) 9:16 et 16:9 : le trait suit l'échelle, l'ombre porte les nouvelles valeurs", () => {
    const sortie = (v: Record<string, unknown>) => String(v.WebkitTextStroke);
    const impact916 = css("impact");
    const impact169 = css("impact", { ratio: "16:9" }, (d) => ({ ...d, echelleTexte: 0.9 }));
    expect(sortie(impact916)).toMatch(/^8px /);
    expect(sortie(impact169)).toMatch(/^7\.2px /);
    expect(String(impact916.textShadow)).toContain("13px");
    const karaoke916 = css("karaoke");
    const karaoke169 = css("karaoke", { ratio: "16:9" }, (d) => ({ ...d, echelleTexte: 0.9 }));
    expect(sortie(karaoke916)).toMatch(/^3px /);
    expect(sortie(karaoke169)).toMatch(/^2\.7px /);
    expect(String(karaoke916.textShadow)).toContain("10.4px");
  });

  it("(e) règle V2 = V0 × 1,3 pour le flou et − 0,1 pour l'opacité (V0 écrit ici)", () => {
    const V0 = { karaoke: { flouPx: 8, opacite: 0.65 }, impact: { flouPx: 10, opacite: 0.7 } };
    for (const g of ["karaoke", "impact"] as const) {
      expect(GABARITS[g].ombre.flouPx).toBeCloseTo(V0[g].flouPx * 1.3, 10);
      expect(GABARITS[g].ombre.opacite).toBeCloseTo(V0[g].opacite - 0.1, 10);
    }
    expect(GABARITS.karaoke.ombre.decalagePx).toBe(3);
    expect(GABARITS.impact.ombre.decalagePx).toBe(6);
  });
});
