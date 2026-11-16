import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { trouverDroit } from "../../../src/briques/droits";
import { SONS } from "../../../src/briques/sons";
import empreintes from "./empreintes.json";

const RACINE = new URL("../../../", import.meta.url);
const DOSSIERS = {
  studio: "public/bruitages",
  "interface-claire": "studio-rendu/compositions/interface-claire/sons",
  "v4-lot5": "studio-rendu/compositions/interface-claire/motion-v4/lot5/sons",
} as const;
const NOMBRES = { studio: 24, "interface-claire": 28, "v4-lot5": 3 } as const;
const wavs = (d: string) => readdirSync(new URL(d + "/", RACINE)).filter((f) => f.endsWith(".wav"));

function dureeWav(b: Buffer): number {
  const octetsParSec = b.readUInt32LE(28);
  let p = 12;
  while (p < b.length) {
    const taille = b.readUInt32LE(p + 4);
    if (b.toString("ascii", p, p + 4) === "data") return taille / octetsParSec;
    p += 8 + taille + (taille & 1);
  }
  throw new Error("pas de bloc data");
}

describe("registre des sons existants", () => {
  for (const [banque, dossier] of Object.entries(DOSSIERS)) {
    it(`banque ${banque} : compte et correspondance fichiers/entrées`, () => {
      const fichiers = wavs(dossier);
      expect(fichiers.length).toBe(NOMBRES[banque as keyof typeof NOMBRES]);
      const entrees = SONS.filter((s) => s.banque === banque).map((s) => s.chemin);
      expect(entrees.sort()).toEqual(fichiers.map((f) => `${dossier}/${f}`).sort());
    });
  }

  it("55 entrées, identifiants uniques", () => {
    expect(SONS.length).toBe(55);
    expect(new Set(SONS.map((s) => s.id)).size).toBe(55);
  });

  it("durée = en-tête WAV à 10 ms près", () => {
    for (const s of SONS) {
      const d = dureeWav(readFileSync(new URL(s.chemin, RACINE)));
      expect(Math.abs(d - s.dureeSec), s.id).toBeLessThanOrEqual(0.01);
    }
  });

  it("chaque droitId existe", () => {
    for (const s of SONS) expect(trouverDroit(s.droitId), s.id).toBeDefined();
  });

  it("libellés de licence exacts", () => {
    expect(trouverDroit("son-banque-studio")?.licence).toBe("CC0 1.0");
    expect(trouverDroit("son-interface-claire")?.licence).toBe("CC0 1.0");
    expect(trouverDroit("son-v4-lot5")?.licence).toBe("Création interne Axion-IA");
  });

  it("sons du lot 5 : facecam-animee-v4 + valide-par-decision", () => {
    for (const s of SONS.filter((x) => x.banque === "v4-lot5")) {
      expect(s.posablePar).toContain("facecam-animee-v4");
      expect(s.ecoute).toBe("valide-par-decision");
      expect(s.decision).toBeTruthy();
    }
  });

  it("empreintes sha256 figées", () => {
    expect(Object.keys(empreintes).sort()).toEqual(SONS.map((s) => s.chemin).sort());
    for (const s of SONS) {
      const h = createHash("sha256").update(readFileSync(new URL(s.chemin, RACINE))).digest("hex");
      expect(h, s.chemin).toBe((empreintes as Record<string, string>)[s.chemin]);
    }
  });

  it("aucun fichier de studio-rendu n'importe src/briques/sons", () => {
    const lire = (d: URL): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.name === "node_modules" ? [] : e.isDirectory() ? lire(new URL(e.name + "/", d)) : /\.(tsx?|mjs|js)$/.test(e.name) ? [readFileSync(new URL(e.name, d), "utf8")] : [],
      );
    for (const src of lire(new URL("studio-rendu/", RACINE))) expect(src).not.toMatch(/briques\/sons/);
  });
});
