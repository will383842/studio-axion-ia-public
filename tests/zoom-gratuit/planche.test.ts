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
type Module = { cellulesPlanche: () => { nom: string; echelle: number }[]; rapportComptage: (v: Video[]) => string[] };
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
