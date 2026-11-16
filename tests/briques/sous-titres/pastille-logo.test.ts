/** C8-L05 : géométrie pure de la pastille « logo + nom d'outil ». Table locale neutre (un carré), jamais un vrai logo. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PALETTE, autoriserTexte } from "@/briques/charte/axion-2026";
import { hauteurCapitales } from "@/briques/sous-titres/mesure";
import { empreintePastilleLogo, etatPastilleLogo, geometriePastilleLogo, PASTILLE_LOGO, type DemandePastilleLogo } from "@/briques/sous-titres/pastille-logo";
import { DESSINS_LOGOS } from "@/briques/motion/logos-outils/dessins";
import type { DessinLogo } from "@/briques/motion/logos-outils/types";

const TABLE: Record<string, DessinLogo> = { "essai-carre": { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M0 0H24V24H0Z" }]] } };
const TABLE_LARGE: Record<string, DessinLogo> = { "essai-large": { vue: [0, 0, 48, 24], noeuds: [["path", { d: "M0 0H48V24H0Z" }]] } };
const base = (o: Partial<DemandePastilleLogo> = {}): DemandePastilleLogo => ({ variante: "ligne", outilId: "chatgpt", logoId: "essai-carre", largeurImage: 1080, hauteurImage: 1920, tailleTextePx: 64, xCentre: 540, yCentre: 900, ...o });

describe("geometriePastilleLogo", () => {
  it("outil inconnu : null", () => expect(geometriePastilleLogo(base({ outilId: "marque-client" }), TABLE)).toBeNull());

  it("table vide : texte seul, plus étroite, nom centré", () => {
    const sans = geometriePastilleLogo(base(), DESSINS_LOGOS)!;
    const avec = geometriePastilleLogo(base(), TABLE)!;
    expect(sans.avecLogo).toBe(false);
    expect(sans.logo).toBeNull();
    expect(sans.raisonTexteSeul).toBe("logo-absent");
    expect(sans.pastille.w).toBeLessThan(avec.pastille.w);
    expect(sans.texte.x + sans.texte.w / 2).toBeCloseTo(sans.pastille.x + sans.pastille.w / 2, 6);
    expect(sans.nom).toBe("ChatGPT");
  });

  it("logo trouvé : plus bas que 1,2 × capitales, garde dans la pastille, proportions gardées", () => {
    for (const [t, rapport] of [[TABLE, 1], [TABLE_LARGE, 2]] as const) {
      const id = Object.keys(t)[0];
      const g = geometriePastilleLogo(base({ logoId: id }), t)!;
      expect(g.avecLogo).toBe(true);
      const l = g.logo!;
      expect(l.h).toBeLessThanOrEqual(hauteurCapitales("Manrope Bold", 64) * 1.2);
      expect(l.w / l.h).toBeCloseTo(rapport, 6);
      expect(l.y - g.garde).toBeGreaterThanOrEqual(g.pastille.y - 1e-9);
      expect(l.y + l.h + g.garde).toBeLessThanOrEqual(g.pastille.y + g.pastille.h + 1e-9);
      expect(l.x - g.garde).toBeGreaterThanOrEqual(g.pastille.x - 1e-9);
      expect(l.x + l.w + g.garde).toBeLessThanOrEqual(g.pastille.x + g.pastille.w + 1e-9);
      expect(g.garde).toBeCloseTo(PASTILLE_LOGO.zoneGardeRatio * l.h, 6);
    }
  });

  it("taille 20 : trop petit, le logo n'est pas rétréci", () => {
    const g = geometriePastilleLogo(base({ tailleTextePx: 20 }), TABLE)!;
    expect(g.avecLogo).toBe(false);
    expect(g.raisonTexteSeul).toBe("trop-petit");
  });

  it("fonds : imposé, repli sur l'autre, interdit", () => {
    const n = geometriePastilleLogo(base({ fondsPermis: ["noir"], fondVoulu: "ivoire" }), TABLE)!;
    expect(n.fond).toBe("noir");
    expect(n.couleurTexte).toBe(PALETTE.ivoire);
    const i = geometriePastilleLogo(base({ fondsPermis: [] }), TABLE)!;
    expect(i.avecLogo).toBe(false);
    expect(i.raisonTexteSeul).toBe("fond-interdit");
    expect(geometriePastilleLogo(base(), TABLE)!.fond).toBe("ivoire");
  });

  it("chaque paire passe autoriserTexte", () => {
    for (const fond of ["ivoire", "noir"] as const) {
      const g = geometriePastilleLogo(base({ fondVoulu: fond, fondsPermis: ["ivoire", "noir"] }), TABLE)!;
      expect(autoriserTexte(g.couleurTexte, PALETTE[g.fond])).toBe(true);
    }
  });

  it("ligne centrée ; autonome dans le bon tiers, ≥ 6 % des bords, dans l'image", () => {
    const g = geometriePastilleLogo(base(), TABLE)!;
    expect(g.pastille.x + g.pastille.w / 2).toBeCloseTo(540, 6);
    expect(g.pastille.y + g.pastille.h / 2).toBeCloseTo(900, 6);
    for (const [W, H] of [[1080, 1920], [1080, 1080], [1920, 1080]]) {
      for (const zone of ["haut", "bas"] as const) {
        const a = geometriePastilleLogo(base({ variante: "autonome", zone, largeurImage: W, hauteurImage: H, tailleTextePx: 56 }), TABLE)!;
        const p = a.pastille;
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(W);
        expect(p.x + p.w / 2).toBeCloseTo(W / 2, 6);
        if (zone === "haut") {
          expect(p.y).toBeGreaterThanOrEqual(0.06 * H - 1e-9);
          expect(p.y + p.h).toBeLessThanOrEqual(H / 3 + 1e-9);
        } else {
          expect(p.y).toBeGreaterThanOrEqual((2 * H) / 3 - 1e-9);
          expect(p.y + p.h).toBeLessThanOrEqual(0.94 * H + 1e-9);
        }
      }
    }
  });

  it("une ligne décentrée reste dans l'image", () => {
    const g = geometriePastilleLogo(base({ xCentre: 5, yCentre: 1915 }), TABLE)!;
    expect(g.pastille.x).toBeGreaterThanOrEqual(0);
    expect(g.pastille.y + g.pastille.h).toBeLessThanOrEqual(1920);
  });
});

describe("etatPastilleLogo", () => {
  it("entrée 280 ms monotone, sortie 160 ms", () => {
    expect(etatPastilleLogo(0.9, 1, 3)).toMatchObject({ visible: false, opacite: 0 });
    let prec = 0;
    for (let ms = 0; ms <= 280; ms += 20) {
      const e = etatPastilleLogo(1 + ms / 1000, 1, 3);
      expect(e.opacite).toBeGreaterThanOrEqual(prec);
      prec = e.opacite;
    }
    const plein = etatPastilleLogo(1.28, 1, 3);
    expect(plein).toMatchObject({ visible: true, opacite: 1, monteePx: 0, echelle: 1 });
    expect(etatPastilleLogo(1, 1, 3).echelle).toBeCloseTo(0.96, 6);
    expect(etatPastilleLogo(3.08, 1, 3).opacite).toBeLessThan(1);
    expect(etatPastilleLogo(3.17, 1, 3).visible).toBe(false);
  });
});

describe("empreintePastilleLogo", () => {
  const etat = etatPastilleLogo(2, 1, 3);
  it("stable, distincte logo / texte seul, vide hors fenêtre", () => {
    const a = geometriePastilleLogo(base(), TABLE);
    const b = geometriePastilleLogo(base(), TABLE);
    expect(empreintePastilleLogo(a, etat)).toBe(empreintePastilleLogo(b, etat));
    expect(empreintePastilleLogo(a, etat)).not.toBe(empreintePastilleLogo(geometriePastilleLogo(base(), {}), etat));
    expect(empreintePastilleLogo(a, etatPastilleLogo(0, 1, 3))).toBe("");
    expect(empreintePastilleLogo(null, etat)).toBe("");
  });
});

describe("garde du fichier", () => {
  const src = readFileSync("src/briques/sous-titres/pastille-logo.ts", "utf8");
  it("pur et éteint", () => {
    for (const interdit of ["@/", "droits", "logos-outils/index", "logos-outils/manifeste", "cubic-bezier(", "transform", "ACTIF"]) expect(src).not.toContain(interdit);
  });
});
