/**
 * FIX-MINIMAL-FOND-CLAIR-v21s (C10-15) : le style « Minimal » (sans contour) s'écrit en foncé sur un décor clair
 * connu (facteur d'ombre > 1), comme sur un écran clair ; tout le reste est inchangé.
 */
import { describe, expect, it } from "vitest";
import type { SegmentSousTitres } from "@/domaine/types";
import { couleursDepuisMarque, donneesCalque, GABARITS } from "@/briques/sous-titres";
import type { DonneesCalque } from "@/briques/sous-titres";
import { cssElement, sceneAuTemps } from "@/briques/sous-titres/scene";

const COULEURS = { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" };
const mot = (m: string, d: number, f: number) => ({ mot: m, debutSec: d, finSec: f });
const seg = (): SegmentSousTitres =>
  ({ id: "s", debutSec: 0, finSec: 1, mots: [mot("Ton", 0, 0.3), mot("droit", 0.3, 0.6), mot("reste", 0.6, 1)], style: "base", importance: 0, souligne: null, position: "auto", inclinaison: 0 }) as SegmentSousTitres;
const calque = (base: "karaoke" | "minimal", extra: Partial<DonneesCalque> = {}, couleurs = COULEURS): DonneesCalque => ({
  ...donneesCalque({ segments: [seg()], base, couleurs, reseaux: ["tiktok"] }),
  ...extra,
});
const rendu = (d: DonneesCalque, t = 0.9) => {
  const el = sceneAuTemps(d, t)!;
  return { el, css: cssElement(el, d, "Manrope") };
};

describe("FIX-MINIMAL-FOND-CLAIR-v21s", () => {
  it("(a) Minimal sur décor clair = texte foncé, ni ombre ni contour", () => {
    const d = calque("minimal", { facteurOmbre: 2 });
    const { el, css } = rendu(d);
    expect(el.clair).toBe(d.couleurs.contour);
    for (const m of el.mots.filter((x) => !x.accent)) expect(m.couleur).toBe(d.couleurs.contour);
    expect(css.ligne.textShadow).toBeUndefined();
    expect(css.ligne.WebkitTextStroke).toBeUndefined();
  });

  it("(b) fond inconnu ou sombre = inchangé", () => {
    const sans = rendu(calque("minimal"));
    for (const f of [undefined, 1]) {
      const d = calque("minimal", f === undefined ? {} : { facteurOmbre: f });
      const { el, css } = rendu(d);
      expect(el.clair).toBeUndefined();
      expect(el.mots[0].couleur).toBe(d.couleurs.texte);
      expect(css.ligne.textShadow).toContain(`${GABARITS.minimal.ombre.flouPx}px`);
      expect(el).toEqual(sans.el);
      expect(css.ligne).toEqual(sans.css.ligne);
      expect(css.conteneur).toEqual(sans.css.conteneur);
    }
  });

  it("(c) Karaoké et Impact gardent l'ombre renforcée et leur contour", () => {
    const k = rendu(calque("karaoke", { facteurOmbre: 2 }));
    expect(k.el.clair).toBeUndefined();
    expect(k.css.ligne.textShadow).toContain("0 0 20px");
    expect(k.css.ligne.WebkitTextStroke).toBeDefined();
    const d = calque("karaoke", { facteurOmbre: 2 });
    const imp = { ...d, segments: [{ ...seg(), style: "impact" as const }] };
    const i = rendu(imp);
    expect(i.el.clair).toBeUndefined();
    expect(i.css.ligne.textShadow).toBeDefined();
    expect(i.css.ligne.WebkitTextStroke).toBeDefined();
  });

  it("(d) Bandeau et Encre inchangés avec un décor clair", () => {
    const d = calque("minimal", { facteurOmbre: 2 });
    const band = rendu({ ...d, segments: [{ ...seg(), style: "bandeau" as const }] });
    expect(band.el.clair).toBeUndefined();
    const encre = rendu({ ...d, encre: true });
    expect(encre.css.ligne.textShadow).toBeUndefined();
    expect(encre.css.ligne.WebkitTextStroke).toBeUndefined();
  });

  it("(e) un passage clair réel reste prioritaire", () => {
    const d = calque("minimal", { facteurOmbre: 2, passagesClairs: [{ debutSec: 0, finSec: 0.5, texte: "#15100c" }] });
    expect(rendu(d, 0.4).el.clair).toBe("#15100c");
    expect(rendu(d, 0.9).el.clair).toBe(d.couleurs.contour);
  });

  it("(f) la couleur foncée vient du jeton de la marque, jamais d'une valeur écrite dans le moteur", () => {
    const couleurs = couleursDepuisMarque({ couleurs: [{ nom: "Fond", jeton: "--fond", valeur: "#120E0B" }] });
    const d = calque("minimal", { facteurOmbre: 2 }, couleurs);
    const { el } = rendu(d);
    expect(couleurs.contour).toBe("#120E0B");
    expect(el.clair).toBe("#120E0B");
    expect(el.mots[0].couleur).toBe("#120E0B");
  });
});
