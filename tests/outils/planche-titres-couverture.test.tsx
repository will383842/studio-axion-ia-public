/** C11-T6b-p : planche d'attente (outil local) des titres de couverture. Rien n'est allumé, aucune prise floutée. */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
// `polices.ts` importe « remotion », absent hors studio-rendu : doublure minimale.
vi.mock("remotion", () => ({ delayRender: () => 0, continueRender: () => undefined, cancelRender: () => undefined }));
import { couleursSur } from "@/briques/jetons-motion";
import { RATIOS_COUVERTURE } from "@/briques/motion/titres-couverture/etapes";

type RatioC = (typeof RATIOS_COUVERTURE)[number];
type Fond = "ivoire" | "noir";
type ModulePlanche = {
  PlancheTitresCouverture: React.FC<{ ratio: RatioC; fond: Fond }>;
  RATIOS_PLANCHE: readonly RatioC[];
  CASES_PLANCHE: readonly string[];
};
let M: ModulePlanche;
beforeAll(async () => {
  // Chemin CALCULÉ : le tsc racine ne suit pas l'import (PIEGE-REMOTION-TSC.md).
  const chemin = ["..", "..", "outils", "planche-titres-couverture", "PlancheTitresCouverture"].join("/");
  M = (await import(/* @vite-ignore */ chemin)) as ModulePlanche;
});

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FONDS: readonly Fond[] = ["ivoire", "noir"];
const ORDRE = ["etape-entree", "etape-tenue", "etape-sortie", "pastille"];
const rendre = (ratio: RatioC, fond: Fond) => renderToStaticMarkup(React.createElement(M.PlancheTitresCouverture, { ratio, fond }));
function caseDe(html: string, id: string): string {
  const m = html.split('data-case="').slice(1).find((s) => s.startsWith(`${id}"`));
  if (!m) throw new Error(`case absente : ${id}`);
  return m;
}
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}

describe("C11-T6b-p planche des titres de couverture", () => {
  it("ratios et cases : ordre fixe", () => {
    expect([...M.RATIOS_PLANCHE]).toEqual([...RATIOS_COUVERTURE]);
    expect([...M.CASES_PLANCHE]).toEqual(ORDRE);
  });
  for (const ratio of RATIOS_COUVERTURE) {
    for (const fond of FONDS) {
      it(`${ratio} ${fond} : 4 cases dans l'ordre, textes exacts, avec prise floutée`, () => {
        const h = rendre(ratio, fond);
        const ids = [...h.matchAll(/data-case="([^"]+)"/g)].map((m) => m[1]);
        expect(ids).toEqual(ORDRE);
        const tenue = caseDe(h, "etape-tenue");
        expect(tenue).toContain("Étape 3");
        expect(tenue).toContain("Le bon réflexe");
        expect(caseDe(h, "pastille")).toContain("Cas concret");
        expect(h).toContain("avec prise floutée (C11-T6b-c)");
        expect(h).toContain("Manrope");
        expect(h).not.toMatch(/<img|<image|href=|filter:blur/);
      });
      it(`${ratio} ${fond} : même entrée, même balisage`, () => {
        expect(rendre(ratio, fond)).toBe(rendre(ratio, fond));
      });
    }
  }
  it("C11-T6b-c : décor flouté sous les 3 cases étape, pas sous la pastille", () => {
    for (const ratio of RATIOS_COUVERTURE) {
      for (const fond of FONDS) {
        const h = rendre(ratio, fond);
        for (const id of ["etape-entree", "etape-tenue", "etape-sortie"]) {
          const c = caseDe(h, id);
          expect(c, id).toContain('data-decor="floute"');
          expect(c, id).toContain("feGaussianBlur");
          // Le flou est vraiment APPLIQUÉ : le groupe porte le filtre de sa case, d'écart-type > 0.
          const fid = `flou-${ratio}-${fond}-${id}`;
          expect(c, id).toContain(`<g filter="url(#${fid})"`);
          const ecart = new RegExp(`<filter id="${fid}"[^>]*><feGaussianBlur stdDeviation="([0-9.]+)"`).exec(c);
          expect(ecart, id).not.toBeNull();
          expect(Number(ecart![1]), id).toBeGreaterThan(0);
          // Le voile (assombrissement) est présent : div de la couleur du texte, opacité > 0.
          const voile = new RegExp(`background:${couleursSur(fond).texte.replace(/[()]/g, "\\$&")};opacity:([0-9.]+)`).exec(c);
          expect(voile, id).not.toBeNull();
          expect(Number(voile![1]), id).toBeGreaterThan(0);
        }
        expect(caseDe(h, "pastille")).not.toContain("data-decor");
      }
    }
  });
  it("gardes statiques sur les deux fichiers de l'outil", () => {
    for (const f of ["outils/planche-titres-couverture/PlancheTitresCouverture.tsx", "outils/planche-titres-couverture/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/@\/services|src\/services|fournisseurs|compositions\/Racine|useCurrentFrame/);
    }
    expect(lire("outils/planche-titres-couverture/PlancheTitresCouverture.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
  it("le script supprime son entrée temporaire (finally) et son texte reste neutre pour les gardes", () => {
    const s = lire("outils/planche-titres-couverture/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain(".planche-titres-couverture-tmp");
  });
  it("garde : aucun fichier de src/ ni studio-rendu/ n'importe l'outil", () => {
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) expect(lire(f), f).not.toMatch(/outils\/planche-titres-couverture|PlancheTitresCouverture/);
  });
});
