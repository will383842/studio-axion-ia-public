/** C11-T8b-p : planche d'attente (outil local) des 9 effets de texte déjà relus, trois instants, deux fonds. */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("remotion", () => ({ delayRender: () => 0, continueRender: () => undefined, cancelRender: () => undefined }));
import { EFFETS_TEXTE } from "../../src/briques/motion/texte-effets/effets";

type Fond = "ivoire" | "noir";
type Module = {
  PlancheEffetsTexte: React.FC<{ fond: Fond }>;
  INSTANTS_PLANCHE: readonly number[];
  LIGNES_PLANCHE: readonly string[];
};
let M: Module;
beforeAll(async () => {
  // Chemin calculé : le tsc racine ne doit pas suivre l'import vers studio-rendu (remotion absent de la racine).
  const chemin = ["..", "..", "outils", "planche-effets-texte", "PlancheEffetsTexte"].join("/");
  M = (await import(/* @vite-ignore */ chemin)) as Module;
});

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FONDS: Fond[] = ["ivoire", "noir"];
const rendre = (fond: Fond) => renderToStaticMarkup(<M.PlancheEffetsTexte fond={fond} />);
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}

describe("C11-T8b-p planche des effets de texte", () => {
  it("lignes = EFFETS_TEXTE (9), trois instants dont l'image 0", () => {
    expect([...M.LIGNES_PLANCHE]).toEqual([...EFFETS_TEXTE]);
    expect(M.LIGNES_PLANCHE).toHaveLength(9);
    expect(M.INSTANTS_PLANCHE).toHaveLength(3);
    expect(M.INSTANTS_PLANCHE[0]).toBe(0);
  });
  for (const fond of FONDS) {
    it(`${fond} : 9 × 3 cases, chaque effet 3 fois, aucun autre effet`, () => {
      const h = rendre(fond);
      expect(h.match(/data-case="/g)?.length).toBe(27);
      expect(h.match(/data-texte-effet="/g)?.length).toBe(27);
      for (const e of EFFETS_TEXTE) {
        expect(h.split(`data-texte-effet="${e}"`).length - 1, e).toBe(3);
        for (const k of [0, 1, 2]) expect(h).toContain(`data-case="${e}#${k}"`);
      }
      const trouves = new Set([...h.matchAll(/data-texte-effet="([^"]+)"/g)].map((m) => m[1]));
      expect([...trouves].sort()).toEqual([...EFFETS_TEXTE].sort());
      expect(h).not.toMatch(/meme|legende-native/);
      expect(h).toContain("Bonjour");
      expect(h).toContain("Salut");
      expect(h).toContain("Manrope");
      expect(h).toContain("9 effets relus");
    });
    it(`${fond} : aucune image extérieure, même entrée = même balisage`, () => {
      const h = rendre(fond);
      expect(h).not.toMatch(/<img|<image|href=/);
      expect(rendre(fond)).toBe(h);
    });
  }
  it("gardes statiques du composant et du script", () => {
    for (const f of ["outils/planche-effets-texte/PlancheEffetsTexte.tsx", "outils/planche-effets-texte/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/@\/services|fournisseurs|compositions\/Racine|useCurrentFrame/);
    }
    const s = lire("outils/planche-effets-texte/PlancheEffetsTexte.tsx");
    expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(s).not.toContain('"flou-mot"');
  });
  it("le script supprime son entrée temporaire (finally) et n'importe que la planche", () => {
    const s = lire("outils/planche-effets-texte/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain(".planche-effets-texte-tmp");
  });
  it("rien dans src/ ni studio-rendu/ n'importe outils/planche-effets-texte", () => {
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) {
      expect(lire(f), f).not.toMatch(/outils\/planche-effets-texte|PlancheEffetsTexte/);
    }
  });
});
