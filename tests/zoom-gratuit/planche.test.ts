/**
 * C8-Z05b : la planche avant/après du zoom gratuit du cas concret et le rapport de comptage (outil local, rendu lancé à la main).
 * Parties pures seulement ; `outils/` est hors du projet tsc : chemin CALCULÉ + type local (PIEGE-REMOTION-TSC.md).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ligneRapport, zoomsAvocat, zoomsClassique } from "../../outils/zoom-gratuit/compter";

const RACINE = resolve(__dirname, "../..");
const CHEMIN = ["..", "..", "outils", "zoom-gratuit", "planche.mts"].join("/");
type Video = { nom: string; genre: "classique" | "avocat"; dureeSec: number; plans: unknown[] };
type Case = { reglage: string; instant: "debut" | "milieu" | "fin"; t: number; cameraMax: number; echelle: number };
type Module = { casesPlanche: () => Case[]; cellulesPlanche: () => { nom: string; echelle: number }[]; rapportComptage: (v: Video[]) => string[]; lireArguments: (a: string[]) => { sortie?: string; fichierVideos?: string } };
const mod = (await import(/* @vite-ignore */ CHEMIN)) as Module;

describe("cellulesPlanche", () => {
  const cellules = mod.cellulesPlanche();
  it("3 cellules : avant 1,035, après 1,040 et 1,048", () => {
    expect(cellules.map((c) => c.echelle)).toEqual([1.035, 1.04, 1.048]);
    expect(cellules.every((c) => c.echelle > 1 && c.echelle <= 1.048 && c.nom.length > 0)).toBe(true);
  });
  it("1,035 recopié = CAMERA_BASE_MAX de variete.ts, 1,048 = CAMERA_PLUS_MAX", () => {
    const texte = readFileSync(join(RACINE, "src/moteurs/montage-cas-concret/variete.ts"), "utf8");
    expect(texte).toMatch(/CAMERA_BASE_MAX = 1\.035;/);
    expect(texte).toMatch(/export const CAMERA_PLUS_MAX = 1\.048;/);
  });
});

describe("casesPlanche (échelles calculées par le vrai habillage du rendu)", () => {
  const cases = mod.casesPlanche();
  const texte = readFileSync(join(RACINE, "studio-rendu/compositions/cas-concret/plans/habillage.ts"), "utf8");
  const max = Number(/export const ECHELLE_CAMERA_MAX = ([\d.]+);/.exec(texte)?.[1]);
  const de = (reglage: string, instant: string) => cases.find((c) => c.reglage === reglage && c.instant === instant)!;
  it("9 cases : 3 réglages × 3 instants", () => {
    expect(cases).toHaveLength(9);
    expect(new Set(cases.map((c) => c.reglage)).size).toBe(3);
  });
  it("début = 1 ; fin = 1,035 / 1,040 / 1,048 ; milieu strictement entre les deux", () => {
    const fins: Record<string, number> = { avant: 1.035, "apres-1040": 1.04, "apres-plafond": 1.048 };
    for (const [reglage, fin] of Object.entries(fins)) {
      expect(de(reglage, "debut").echelle).toBeCloseTo(1, 10);
      expect(de(reglage, "fin").echelle).toBeCloseTo(fin, 10);
      expect(de(reglage, "milieu").echelle).toBeGreaterThan(1);
      expect(de(reglage, "milieu").echelle).toBeLessThan(fin);
    }
  });
  it("jamais au-dessus de 1,048 ; « avant » à la fin = ECHELLE_CAMERA_MAX lu dans habillage.ts", () => {
    expect(cases.every((c) => c.echelle <= 1.048 + 1e-9)).toBe(true);
    expect(max).toBe(1.035);
    expect(de("avant", "fin").echelle).toBeCloseTo(max, 10);
  });
});

describe("rapportComptage", () => {
  it("une ligne par vidéo + une moyenne, au format de ligneRapport", () => {
    const classique = { nom: "A", genre: "classique" as const, dureeSec: 60, plans: [{ debutSec: 0, finSec: 30, taille: 100, ouverture: "debut" }, { debutSec: 30, finSec: 60, taille: 120, ouverture: "punch-in" }] };
    const avocat = { nom: "B", genre: "avocat" as const, dureeSec: 120, plans: [{ debutSec: 0, finSec: 60, zoom: 1, zoomFin: 1.1 }, { debutSec: 60, finSec: 120, zoom: 1 }] };
    const lignes = mod.rapportComptage([classique, avocat]);
    expect(lignes).toHaveLength(3);
    expect(lignes[0]).toBe(ligneRapport("A (classique)", zoomsClassique(classique.plans as never, 60)));
    expect(lignes[1]).toBe(ligneRapport("B (avocat)", zoomsAvocat(avocat.plans as never, 120)));
    expect(lignes[0]).toContain("1 zoom(s), 1 par minute");
    expect(lignes[1]).toContain("0,5 par minute");
    expect(lignes[2]).toContain("moyenne");
    expect(lignes[2]).toContain("0,75");
  });
  it("aucune vidéo : une seule ligne, sans planter", () => {
    expect(mod.rapportComptage([])).toHaveLength(1);
  });
});

describe("garde", () => {
  it("importer le module ne lance rien ; main gardé par import.meta.url", () => {
    const src = readFileSync(join(RACINE, "outils/zoom-gratuit/planche.mts"), "utf8");
    expect(src).toMatch(/import\.meta\.url/);
    expect(existsSync(join(RACINE, "planche.txt"))).toBe(false);
    expect(existsSync(join(RACINE, "studio-rendu", ".planche-zoom-gratuit-tmp"))).toBe(false);
  });
  it("aucun fichier de src/ ni studio-rendu/ ne cite zoom-gratuit/planche", () => {
    const vus: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f.startsWith(".")) continue;
        const p = join(d, f);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.(tsx?|mts|js)$/.test(f) && readFileSync(p, "utf8").includes("zoom-gratuit/planche")) vus.push(p);
      }
    };
    marche(join(RACINE, "src"));
    marche(join(RACINE, "studio-rendu"));
    expect(vus).toEqual([]);
  });
});

describe("lireArguments (FIX-OUTIL-ZOOM-GRATUIT : le dossier de sortie sans --videos)", () => {
  it("dossier seul : la sortie est le premier argument", () => {
    expect(mod.lireArguments(["sortie"])).toEqual({ sortie: "sortie", fichierVideos: undefined });
  });
  it("--videos avant ou après le dossier", () => {
    expect(mod.lireArguments(["--videos", "f.json", "sortie"])).toEqual({ sortie: "sortie", fichierVideos: "f.json" });
    expect(mod.lireArguments(["sortie", "--videos", "f.json"])).toEqual({ sortie: "sortie", fichierVideos: "f.json" });
  });
  it("sans dossier : pas de sortie (l'outil affiche l'usage)", () => {
    expect(mod.lireArguments([]).sortie).toBeUndefined();
    expect(mod.lireArguments(["--videos", "f.json"]).sortie).toBeUndefined();
  });
});
