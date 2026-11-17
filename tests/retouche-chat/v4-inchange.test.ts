// S2-13a (garde d'imports). S2-13b ajoutera, après G12-09a, l'identité « lire → appliquer rien → entrées de rendu ». Ne jamais retirer un motif.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Motifs interdits dans le chemin d'un import (ne jamais en retirer).
const MOTIFS_INTERDITS = [
  "VideoAnimeeV4",
  "briques-v4",
  "motion-v4/",
  "interface-claire/",
  "commun-lot",
  "registre-v4",
  "studio-rendu",
];

const RACINE = process.cwd();

type Refus = { ligne: number; motif: string; texte: string };

// Repère les lignes `import`, `export … from`, `import(` dont le chemin contient un motif interdit.
function refusDImports(source: string): Refus[] {
  const refus: Refus[] = [];
  const lignes = source.split("\n");
  // Une instruction peut courir sur plusieurs lignes : on regarde chaque ligne portant un chemin entre guillemets
  // dès qu'un mot-clé d'import/export a été vu dans l'instruction en cours.
  let enInstruction = false;
  lignes.forEach((texte, i) => {
    const debut = /^\s*(import|export)\b/.test(texte) || /\bimport\s*\(/.test(texte) || /\brequire\s*\(/.test(texte);
    if (debut) enInstruction = true;
    if (!enInstruction) return;
    const chemins = [...texte.matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
    const aChemin = /\bfrom\s*["'`]/.test(texte) || /\bimport\s*\(/.test(texte) || /^\s*import\s*["'`]/.test(texte) || /\brequire\s*\(/.test(texte);
    if (aChemin) {
      for (const chemin of chemins) {
        const motif = MOTIFS_INTERDITS.find((m) => chemin.includes(m));
        if (motif) refus.push({ ligne: i + 1, motif, texte: texte.trim() });
      }
      enInstruction = false;
    } else if (/;\s*$/.test(texte)) {
      enInstruction = false;
    }
  });
  return refus;
}

function listerTs(dossier: string, filtre: (nom: string) => boolean): string[] {
  return readdirSync(join(RACINE, dossier))
    .filter(filtre)
    .sort()
    .map((nom) => `${dossier}/${nom}`);
}

function fichiersGardes(): string[] {
  return [
    ...listerTs("src/services/retouche-chat", (n) => /\.tsx?$/.test(n)),
    ...listerTs("src/components/retouche-chat", (n) => /\.tsx?$/.test(n)),
    ...listerTs("src/moteurs/montage-facecam-animee", (n) => /^(projet-v4|master-v4|retouche[-\w]*)\.ts$/.test(n)),
  ];
}

describe("S2-13a · contre-épreuve du filet", () => {
  it("refuse un import de VideoAnimeeV4 par studio-rendu", () => {
    const r = refusDImports('import { X } from "../../studio-rendu/compositions/interface-claire/VideoAnimeeV4";');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].ligne).toBe(1);
  });
  it("accepte un import voisin sans rapport", () => {
    expect(refusDImports('import { projetMontageV4 } from "./projet-v4";')).toEqual([]);
  });
  it("refuse chaque motif, en import, export … from et import()", () => {
    for (const m of MOTIFS_INTERDITS) {
      expect(refusDImports(`import a from "./x/${m}y";`).length, m).toBe(1);
      expect(refusDImports(`export { a } from "./x/${m}y";`).length, m).toBe(1);
      expect(refusDImports(`const a = await import("./x/${m}y");`).length, m).toBe(1);
    }
  });
  it("refuse un import réparti sur plusieurs lignes", () => {
    const r = refusDImports('import {\n  a,\n  b,\n} from "./briques-v4";');
    expect(r.length).toBe(1);
    expect(r[0].ligne).toBe(4);
  });
  it("ne signale pas un simple commentaire ou texte", () => {
    expect(refusDImports("// voir briques-v4 et VideoAnimeeV4\nconst t = 'studio-rendu';")).toEqual([]);
  });
});

describe("S2-13a · garde « v4 inchangée » : la retouche n'importe aucune pièce protégée", () => {
  const fichiers = fichiersGardes();

  it("la liste calculée n'est pas vide et contient projet-v4 et master-v4", () => {
    expect(fichiers.length).toBeGreaterThanOrEqual(20);
    expect(fichiers).toContain("src/moteurs/montage-facecam-animee/projet-v4.ts");
    expect(fichiers).toContain("src/moteurs/montage-facecam-animee/master-v4.ts");
  });

  it("aucun fichier gardé n'importe VideoAnimeeV4, briques-v4, plaquettes, interface-claire, registre-v4 ni studio-rendu", () => {
    const trouvailles: string[] = [];
    for (const f of fichiers) {
      const source = readFileSync(join(RACINE, f), "utf8");
      for (const r of refusDImports(source)) {
        trouvailles.push(`${f}:${r.ligne} (${r.motif}) ${r.texte}`);
      }
    }
    expect(trouvailles).toEqual([]);
  });
});
