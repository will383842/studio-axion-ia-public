import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "../..");
const DOSSIERS = [join(RACINE, "studio-rendu/compositions/visuels"), join(RACINE, "src/briques/visuels")];
/** Les couleurs vivent dans la charte (`src/briques/visuels/charte-carrousel.ts`) : seul ce fichier a le droit d'en écrire. */
const FICHIER_COULEURS = "src/briques/visuels/charte-carrousel.ts";
/** Noms de couleur CSS courants, refusés seulement en valeur de propriété de couleur. */
const NOMS = "black|white|red|green|blue|orange|yellow|purple|pink|gray|grey|brown|cyan|magenta|navy|teal|gold|silver|maroon|lime|olive|aqua|fuchsia|violet|indigo|coral|salmon|crimson";
const PROPRIETE = "(?:color|background(?:-color)?|fill|stroke|border(?:-[a-z]+)*|outline(?:-color)?|box-shadow|text-shadow)";
const COULEURS_LITTERALES: RegExp[] = [
  /(?<![A-Za-z0-9&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![A-Za-z0-9])/,
  /\b(?:rgb|rgba|hsl|hsla)\s*\(/i,
  new RegExp(`\\b${PROPRIETE}["']?\\s*[:=]\\s*["']?[^;,"'}]*(?<![.\\w$])(?:${NOMS})(?![\\w-])`, "i"),
];
/** Exceptions nommées : fichier → raison. Vide tant qu'aucune violation n'existe. */
const EXCEPTIONS: Record<string, string> = {};

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : [];
  });
}

describe("sources des compositions visuelles : aucun code couleur littéral", () => {
  it("aucun #hex, rgb(), hsl() ni nom de couleur CSS hors du fichier de couleurs (et des exceptions nommées)", () => {
    const fautes: string[] = [];
    for (const f of DOSSIERS.flatMap(fichiers)) {
      const rel = relative(RACINE, f);
      if (rel === FICHIER_COULEURS || rel in EXCEPTIONS) continue;
      readFileSync(f, "utf-8").split("\n").forEach((ligne, i) => {
        if (COULEURS_LITTERALES.some((re) => re.test(ligne))) fautes.push(`${rel}:${i + 1}: ${ligne.trim()}`);
      });
    }
    expect(fautes).toEqual([]);
  });
});

describe("détecteur de couleurs littérales", () => {
  const detecte = (ligne: string) => COULEURS_LITTERALES.some((re) => re.test(ligne));
  it.each(['color: "#fff"', "fill='#2B5CE0'", "background: rgb(0, 0, 0)", "color: rgba(0,0,0,.5)", "stroke: hsl(10 20% 30%)", "x: hsla(1,2%,3%,.4)", 'background: "blue"', "fill=\"orange\"", "border: 2px solid red"])("détecte %s", (ligne) => {
    expect(detecte(ligne)).toBe(true);
  });
  it.each(["fill={COULEURS.orange}", "color: COULEURS.encre", "const orange = COULEURS.orange;", "// issue #20262", "fill: bluetooth"])("ne signale pas %s", (ligne) => {
    expect(detecte(ligne)).toBe(false);
  });
});

describe("scripts de rendu : aucun repli sur un navigateur en dur", () => {
  it("aucun script de studio-rendu/scripts ne cite /opt/pw-browsers", () => {
    const fautes = fichiers(join(RACINE, "studio-rendu/scripts")).filter((f) => readFileSync(f, "utf-8").includes("/opt/pw-browsers")).map((f) => relative(RACINE, f));
    expect(fautes).toEqual([]);
  });
});
