import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PALETTE } from "@/briques/charte/axion-2026";

// V7-08a : PageTableau n'emploie que les couleurs de la charte Axion 2026.
// Hors périmètre de ce lot (décision D1 de Williams, OUVERTE) : les fonctions
// `outil` (feutres) et `brosse`, laissées telles quelles ; les autres rgba du
// fichier restent au cliquet (tests/charte/compositions-restantes.json).
const FICHIER = "studio-rendu/compositions/tableau/trois-styles/PageTableau.tsx";
const AUTORISES = new Set(
  [PALETTE.ivoire, PALETTE.gris, PALETTE.noir, PALETTE.terracotta, PALETTE.orange, PALETTE.grisSurNoir, PALETTE.texteSecondaire, PALETTE.blanc].map((h) => h.toUpperCase()),
);

/** Efface les commentaires en gardant les sauts de ligne (les numéros de ligne restent exacts). */
function sansCommentaires(src: string): string {
  const blanc = (m: string) => m.replace(/[^\n]/g, " ");
  return src.replace(/\/\*[\s\S]*?\*\//g, blanc).replace(/(^|[^:])(\/\/.*)$/gm, (_m, a: string, b: string) => a + blanc(b));
}

/** Efface une fonction de premier niveau (de `function nom(` à l'accolade fermante en colonne 0), lignes conservées. */
function sansFonction(src: string, nom: string): string {
  const debut = src.indexOf(`\nfunction ${nom}(`);
  expect(debut, `fonction ${nom} introuvable`).toBeGreaterThanOrEqual(0);
  const fin = src.indexOf("\n}\n", debut) + 2;
  return src.slice(0, debut) + src.slice(debut, fin).replace(/[^\n]/g, " ") + src.slice(fin);
}

const source = readFileSync(FICHIER, "utf8");
const perimetre = sansFonction(sansFonction(sansCommentaires(source), "outil"), "brosse");

type Rgba = { ligne: number; valeur: string; hex: string };

/** Tous les rgba(r,g,b,a) du périmètre, avec leur ligne et le hex (sans l'alpha) de leur couleur. */
function rgbaDuPerimetre(src: string): Rgba[] {
  const sortie: Rgba[] = [];
  src.split("\n").forEach((texte, i) => {
    for (const m of texte.matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,[^)]*\)/g)) {
      const hex = "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
      sortie.push({ ligne: i + 1, valeur: m[0], hex });
    }
  });
  return sortie;
}

/**
 * Exceptions FIGÉES : rgba hors palette non corrigés (ombres, reflets, halos), valeur exacte + ligne + motif.
 * ESCALADE Williams : les ranger sous D1 dépasse la ligne L4 ; ils restent donc ici, au cliquet.
 * Tout autre rgba hors palette fait échouer le test ; modifier cette liste demande l'accord de Williams.
 */
const D1 = "D1 (ESCALADE Williams) : ombre, reflet ou halo laissé tel quel";
const EXCEPTIONS: { ligne: number; valeur: string; motif: string }[] = [
  { ligne: 238, valeur: "rgba(30,20,10,0.4)", motif: D1 },
  { ligne: 261, valeur: "rgba(60,40,20,0.22)", motif: D1 },
  { ligne: 302, valeur: "rgba(40,20,8,${0.28 + 0.15 * lev})", motif: D1 },
  { ligne: 320, valeur: "rgba(255,230,200,0.12)", motif: D1 },
  { ligne: 321, valeur: "rgba(0,0,0,0)", motif: D1 },
  { ligne: 322, valeur: "rgba(60,20,0,0.12)", motif: D1 },
  { ligne: 326, valeur: "rgba(70,25,5,0.18)", motif: D1 },
  { ligne: 792, valeur: "rgba(255,253,250,0)", motif: D1 },
  { ligne: 793, valeur: "rgba(255,253,250,0)", motif: D1 },
  { ligne: 794, valeur: "rgba(255,253,250,0.22)", motif: D1 },
  { ligne: 795, valeur: "rgba(255,253,250,0.06)", motif: D1 },
  { ligne: 796, valeur: "rgba(255,253,250,0.16)", motif: D1 },
  { ligne: 797, valeur: "rgba(255,253,250,0)", motif: D1 },
  { ligne: 798, valeur: "rgba(255,253,250,0)", motif: D1 },
  { ligne: 873, valeur: "rgba(243,235,221,0)", motif: D1 },
  { ligne: 874, valeur: "rgba(214,200,178,0.95)", motif: D1 },
  { ligne: 875, valeur: "rgba(243,235,221,1)", motif: D1 },
  { ligne: 876, valeur: "rgba(60,40,20,0)", motif: D1 },
  { ligne: 880, valeur: "rgba(60,40,20,0.25)", motif: D1 },
  { ligne: 881, valeur: "rgba(60,40,20,0)", motif: D1 },
  { ligne: 925, valeur: "rgba(0,0,0,${f})", motif: D1 },
];

describe("palette V7-08a", () => {
  it("hors outil et brosse (D1), aucun hex hors palette", () => {
    const hors = [...new Set((perimetre.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).filter((h) => !AUTORISES.has(h.toUpperCase())))];
    expect(hors).toEqual([]);
  });

  it("chapitres futurs : texte secondaire sur clair, jamais le gris chaud (1,2:1)", () => {
    const ligne = perimetre.split("\n").find((l) => l.includes("sc.style === \"ardoise\" ?") && l.includes("strokeStyle"));
    expect(ligne).toBeDefined();
    expect(ligne).toContain("PALETTE.texteSecondaire");
    expect(ligne).toContain("PALETTE.grisSurNoir");
    expect(ligne).not.toMatch(/PALETTE\.gris\b/);
  });

  it("rgba : tout rgba du périmètre est un hex de la palette ou une exception D1 figée (valeur + ligne)", () => {
    const hors = rgbaDuPerimetre(perimetre).filter((r) => !AUTORISES.has(r.hex));
    const vus = hors.map((r) => `${r.ligne}|${r.valeur}`);
    const figes = EXCEPTIONS.map((e) => `${e.ligne}|${e.valeur}`);
    expect(vus).toEqual(figes);
    expect(PALETTE.blanc).toBe("#FFFFFF");
  });
});
