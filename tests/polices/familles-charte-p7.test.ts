import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defauts, fichiers, relatif } from "../charte/garde-charte";

/**
 * Cliquet P7 (décision de Williams du 21/11 : Manrope partout) : seules les familles de la charte.
 * Ne compte QUE les polices hors charte, fichier par fichier ; la liste de départ ne peut que rétrécir.
 */
const ZONES = [
  "studio-rendu/compositions",
  "src/briques/habillage",
  "src/briques/tableau-scene",
  "src/briques/stylo",
  "src/briques/ecrans-motion",
  "src/briques/schema-motion",
  "src/briques/composition",
  "src/moteurs/montage-image-video/variete",
];
/** Carrousels : autre chaîne, hors de la fiche. */
const HORS_ZONE = "studio-rendu/compositions/visuels/";
/** Fichier exempté : chargeurs gardés (voir POLICES-P7-g). */
const FICHIERS_EXEMPTES = ["studio-rendu/compositions/commune/polices.ts"];
/** Défaut exempté : « JetBrains » est la police du terminal (AUDIT P5, FIX-POLICE-TERMINAL-v20l). */
const POLICE_EXEMPTEE = /JetBrains/;

const BASE = join(process.cwd(), "tests/polices/familles-hors-charte-p7.json");

/** Défauts de police (hors exemptions) d'un source. */
export function policesHorsCharte(src: string, chemin = ""): string[] {
  if (FICHIERS_EXEMPTES.includes(chemin)) return [];
  return defauts(src, chemin).filter((d) => (d.startsWith("police") || d.startsWith("fichier de police")) && !POLICE_EXEMPTEE.test(d));
}

function etatReel(): Record<string, number> {
  const actuel: Record<string, number> = {};
  for (const zone of ZONES) {
    if (!existsSync(join(process.cwd(), zone))) continue;
    for (const f of fichiers(zone)) {
      const r = relatif(f);
      if (r.startsWith(HORS_ZONE)) continue;
      const n = policesHorsCharte(readFileSync(f, "utf8"), r).length;
      if (n > 0) actuel[r] = n;
    }
  }
  return actuel;
}

describe("P7 : seules les familles de la charte (polices)", () => {
  it("le nombre de polices hors charte par fichier ne dépasse jamais la liste de départ (elle ne peut que rétrécir)", () => {
    const actuel = etatReel();
    const base: Record<string, number> = existsSync(BASE) ? JSON.parse(readFileSync(BASE, "utf8")) : {};
    if (process.env.POLICES_P7_ECRIRE === "1") {
      const monte = Object.entries(actuel).filter(([f, n]) => existsSync(BASE) && n > (base[f] ?? 0));
      if (monte.length > 0) throw new Error(`réécriture refusée, un nombre monte : ${monte.map(([f]) => f).join(", ")}`);
      writeFileSync(BASE, JSON.stringify(Object.fromEntries(Object.entries(actuel).sort()), null, 2) + "\n");
      return;
    }
    const plus = Object.entries(actuel).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f} : ${n} (liste : ${base[f] ?? 0})`);
    const moins = Object.entries(base).filter(([f, n]) => (actuel[f] ?? 0) < n).map(([f, n]) => `${f} : ${actuel[f] ?? 0} (liste : ${n})`);
    // Un nombre qui baisse est affiché sans rougir (aucune fiche d'une autre session n'est bloquée).
    if (moins.length > 0) console.info(`P7 : la liste peut rétrécir (POLICES_P7_ECRIRE=1) :\n${moins.join("\n")}`);
    expect(plus).toEqual([]);
  });

  it("la liste de départ est l'état réel au départ : non vide, nombres entiers positifs", () => {
    const base: Record<string, number> = JSON.parse(readFileSync(BASE, "utf8"));
    const total = Object.values(base).reduce((a, n) => a + n, 0);
    expect(Object.keys(base).length).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
    for (const n of Object.values(base)) expect(Number.isInteger(n) && n > 0).toBe(true);
    for (const f of Object.keys(base)) expect(existsSync(join(process.cwd(), f))).toBe(true);
  });

  it("un fichier inventé avec « Anton » entre guillemets sur une ligne fontFamily est vu", () => {
    const src = `export const style = { fontFamily: "Anton, sans-serif", fontSize: 40 };\n`;
    expect(policesHorsCharte(src, "studio-rendu/compositions/inventee/Faux.tsx")).toHaveLength(1);
  });

  it("« JetBrains Mono » n'est pas compté, Manrope non plus", () => {
    const src = `const a = { fontFamily: "JetBrains Mono, monospace" };\nconst b = { fontFamily: "Manrope, sans-serif" };\n`;
    expect(policesHorsCharte(src, "studio-rendu/compositions/inventee/Terminal.tsx")).toEqual([]);
  });

  it("les chargeurs gardés (commune/polices.ts) et les carrousels sont exemptés", () => {
    const src = `const a = { fontFamily: "Inter, sans-serif" };\n`;
    expect(policesHorsCharte(src, "studio-rendu/compositions/commune/polices.ts")).toEqual([]);
    expect(policesHorsCharte(src, "studio-rendu/compositions/commune/autre.ts")).toHaveLength(1);
    expect(Object.keys(etatReel()).some((f) => f.startsWith(HORS_ZONE))).toBe(false);
  });
});
