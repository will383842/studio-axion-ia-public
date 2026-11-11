import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PALETTE, contrasteWcag } from "../../src/briques/charte/axion-2026";
import { BLOC_SUR, COULEURS_V2, CONTOUR_SUR, TEXTE_SECOND_SUR, TEXTE_SUR, TEXTES_SUR_ORANGE, TRAIT_SUR } from "../../src/briques/tableau-scene/v2/charte";
import { CHARTES_TABLEAU, STYLES_TABLEAU } from "../../src/briques/tableau-scene/trois-styles/styles";

// V7-04 : les chartes vidéo (2) ne portent que la palette 2026. reference/charte.ts est HORS fiche (décision en attente).
const FICHIERS = [
  "studio-rendu/compositions/interface-claire/charte.ts",
  "src/briques/motion/jetons.ts",
  "src/briques/tableau-scene/v2/charte.ts",
  "src/briques/tableau-scene/trois-styles/styles.ts",
];
const PALETTE_HEX = ["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5", "#FFFFFF", "#5E5D59", "#5E7050"];
const lire = (f: string) => readFileSync(fileURLToPath(new URL(`../../${f}`, import.meta.url)), "utf8");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

describe("palette 2026 des chartes vidéo (2)", () => {
  it.each(FICHIERS)("%s : aucun hex hors palette", (f) => {
    const src = lire(f).replace(/\(critique #\d+[^)]*\)/g, "");
    for (const h of src.match(/#[0-9a-fA-F]{6}\b/g) ?? []) expect(PALETTE_HEX, `${f} ${h}`).toContain(h.toUpperCase());
  });

  it.each(["src/briques/tableau-scene/v2/charte.ts", "src/briques/tableau-scene/trois-styles/styles.ts"])("%s : aucun hex en dur dans le code", (f) => {
    expect(sansCommentaires(lire(f)).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});

describe("trois styles du tableau : rôles distincts et contrastes", () => {
  for (const s of STYLES_TABLEAU) {
    const c = CHARTES_TABLEAU[s];
    it(`${s} : doux n'est pas l'encre, clair n'est pas moyen`, () => {
      expect(c.doux).not.toBe(c.encre);
      expect(c.clair).not.toBe(c.moyen);
    });
    it(`${s} : bouton terracotta et texte blanc`, () => {
      expect(c.fondBouton).toBe(PALETTE.terracotta);
      expect(c.encreBouton).toBe(PALETTE.blanc);
      expect(contrasteWcag(c.encreBouton, c.fondBouton)).toBeGreaterThanOrEqual(5.8);
    });
    it(`${s} : aucun texte (encre, doux, texte accent) en gris chaud #E8E6DC`, () => {
      for (const t of [c.encre, c.doux, c.accentTexte]) expect(t).not.toBe(PALETTE.gris);
    });
    it(`${s} : texte doux et encre lisibles (4,5) sur le fond`, () => {
      expect(contrasteWcag(c.doux, c.fond)).toBeGreaterThanOrEqual(4.5);
      expect(contrasteWcag(c.encre, c.fond)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("tableau blanc et paperboard : doux = texte secondaire #5E5D59 (6,26 sur l'ivoire)", () => {
    for (const s of ["tableau-blanc", "paperboard"] as const) expect(CHARTES_TABLEAU[s].doux).toBe(PALETTE.texteSecondaire);
  });
  it("paperboard : rubans clairs sous le texte noir (7), passé et à venir distincts (écart de contraste mini 1,1), actif distinct des deux", () => {
    const c = CHARTES_TABLEAU.paperboard;
    const r = c.rubans!;
    for (const v of Object.values(r)) expect(contrasteWcag(c.encre, v)).toBeGreaterThanOrEqual(7);
    expect(r.passe).toBe(PALETTE.gris);
    expect(new Set([r.actif, r.passe, r.avenir]).size).toBe(3);
    expect(contrasteWcag(r.passe, r.avenir)).toBeGreaterThanOrEqual(1.1);
    expect(contrasteWcag(r.passe, r.actif)).toBeGreaterThanOrEqual(1.2);
  });
  // ESCALADE (Williams) : actif/fond >= 1,5 est impossible avec ivoire, gris et blanc seuls (blanc/ivoire = 1,05, gris/ivoire = 1,19).
  it.todo("paperboard : ruban actif d'un écart de contraste >= 1,5 avec le fond (en attente de décision de Williams)");
  it("paperboard : carte blanche, post-it gris, surligneur terracotta, tous différents", () => {
    const c = CHARTES_TABLEAU.paperboard;
    expect(c.fondCarte).toBe(PALETTE.blanc);
    expect(c.fondPostit).toBe(PALETTE.gris);
    expect(c.surligneur).toBe(PALETTE.terracotta);
    expect(new Set([c.fondCarte, c.fondPostit, c.surligneur]).size).toBe(3);
  });
});

describe("blocs/2 : texte blanc sur terracotta, jamais de gris chaud en texte", () => {
  it("texte clair sur l'orange = blanc, 5,81 sur la terracotta", () => {
    expect(COULEURS_V2.ivoireFranc).toBe(PALETTE.blanc);
    expect(TEXTE_SUR.orange).toBe(PALETTE.blanc);
    expect(contrasteWcag(COULEURS_V2.ivoireFranc, COULEURS_V2.orange)).toBeGreaterThanOrEqual(5.8);
    expect(TEXTES_SUR_ORANGE).toContain(PALETTE.blanc);
  });
  it("le sable (#E8E6DC) n'est la couleur d'aucun texte courant", () => {
    expect(Object.values(TEXTE_SUR)).not.toContain(COULEURS_V2.sable);
  });
  it("sur l'encre, aucune valeur de *_SUR ne vaut la terracotta, et chaque trait/fond atteint 3 avec l'encre", () => {
    expect(COULEURS_V2.orangeSurEncre).toBe(PALETTE.orange);
    const surEncre = [TEXTE_SUR.encre, TEXTE_SECOND_SUR.encre, TRAIT_SUR.encre, CONTOUR_SUR.encre, BLOC_SUR.encre.fond, BLOC_SUR.encre.texte];
    for (const v of surEncre) expect(v).not.toBe(PALETTE.terracotta);
    for (const v of [TRAIT_SUR.encre, BLOC_SUR.encre.fond]) expect(contrasteWcag(v, COULEURS_V2.encre)).toBeGreaterThanOrEqual(3);
    expect(contrasteWcag(BLOC_SUR.encre.texte, BLOC_SUR.encre.fond)).toBeGreaterThanOrEqual(4.5);
  });
  it("texte secondaire sur l'orange = blanc franc (5,81), plus l'encre (3,17)", () => {
    expect(TEXTE_SECOND_SUR.orange).toBe(COULEURS_V2.ivoireFranc);
    expect(contrasteWcag(TEXTE_SECOND_SUR.orange, COULEURS_V2.orange)).toBeGreaterThanOrEqual(5.8);
  });
});
