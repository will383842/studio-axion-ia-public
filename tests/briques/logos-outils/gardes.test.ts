/** C8-L07 : gardes des logos d'outils (test seul, aucun code de production). Formes neutres, aucun vrai logo. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { empreintePastilleLogo, etatPastilleLogo, geometriePastilleLogo, type DemandePastilleLogo } from "@/briques/sous-titres/pastille-logo";
import { NOMS_OUTILS } from "@/briques/sous-titres/noms-outils";
import type { DessinLogo } from "@/briques/motion/logos-outils/types";

const lire = (p: string) => readFileSync(p, "utf8");
function fichiers(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
/** Code lu par le rendu : la pastille (ST), le dessin, les logos d'outils (LO) et le dessin de la pastille. */
const COTE_RENDU = [
  "studio-rendu/compositions/sous-titres/PastilleLogo.tsx",
  "src/briques/sous-titres/pastille-logo.ts",
  ...fichiers("src/briques/motion/logos-outils").filter((p) => !/\/(index|manifeste)\.ts$/.test(p)),
].filter((p) => existsSync(p));
const code = (p: string) => lire(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TABLE: Record<string, DessinLogo> = { "essai-carre": { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M0 0H24V24H0Z" }]] } };
const outil = NOMS_OUTILS[0]!;
const base: DemandePastilleLogo = { variante: "ligne", outilId: outil.id, largeurImage: 1080, hauteurImage: 1920, tailleTextePx: 64, xCentre: 540, yCentre: 900 };

describe("gardes logos d'outils (C8-L07)", () => {
  it("sans champ logoId : texte seul, mêmes paramètres quelle que soit la table, sortie répétable", () => {
    const sans = geometriePastilleLogo(base, {})!;
    expect(sans.avecLogo).toBe(false);
    expect(sans.logo).toBeNull();
    expect(geometriePastilleLogo(base, TABLE)).toEqual(sans);
    expect(geometriePastilleLogo({ ...base }, {})).toEqual(sans);
    const etat = etatPastilleLogo(1, 0, 5);
    expect(empreintePastilleLogo(geometriePastilleLogo(base, TABLE), etat)).toBe(empreintePastilleLogo(sans, etat));
    // champ présent mais vide ou inconnu : même repli, mêmes rectangles de texte
    for (const logoId of ["", "inconnu"]) {
      const g = geometriePastilleLogo({ ...base, logoId }, TABLE)!;
      expect(g.avecLogo).toBe(false);
      expect(g.texte).toEqual(sans.texte);
      expect(g.pastille).toEqual(sans.pastille);
    }
  });

  it("côté rendu : aucun alias @/, aucun import de droits, ni de logos-outils/index ou manifeste", () => {
    expect(COTE_RENDU.length).toBeGreaterThanOrEqual(3);
    for (const p of COTE_RENDU) {
      const src = code(p);
      expect(src, p).not.toMatch(/from\s+["']@\//);
      expect(src, p).not.toMatch(/(?:from|import\()\s*["'][^"']*\/droits(?:\/|["'])/);
      expect(src, p).not.toMatch(/(?:from|import\()\s*["'][^"']*logos-outils(?:\/(?:index|manifeste))?["']/);
      expect(src, p).not.toMatch(/(?:from|import\()\s*["']\.\/(?:index|manifeste)["']/);
    }
  });

  it("aucun dangerouslySetInnerHTML dans les logos, la pastille et leur dessin", () => {
    for (const p of [...COTE_RENDU, ...fichiers("src/briques/motion/logos-outils")]) expect(code(p), p).not.toContain("dangerouslySetInnerHTML");
  });

  it("lot1/LogoOutil.tsx n'est importée par aucune pièce des logos d'outils ni de la pastille", () => {
    for (const p of [...COTE_RENDU, ...fichiers("src/briques/motion/logos-outils")]) expect(code(p), p).not.toMatch(/LogoOutil["'/]|lot1\//);
  });
});
