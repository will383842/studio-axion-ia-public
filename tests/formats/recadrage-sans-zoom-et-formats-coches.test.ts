/**
 * UO-10 — T8 et T11 des formats du face caméra, plus l'état écrit dans docs/formats/ETAT-4-5-ET-RECADRAGE.md.
 *  - T8 : pour un plan 9:16 et une piste de visage fictive, la fenêtre 4:5 n'agrandit jamais l'image au-delà du 9:16
 *    et place les yeux entre 30 et 38 % de la hauteur.
 *  - T11 : le 9:16 est toujours coché ; un format choisi (`entrees.facecamFormats`) est refait d'office.
 *  - Le document cite, pour chaque générateur de src/formats/*, ses ratios déclarés (chemin et ligne) et marque
 *    T9 et T10 « non fait ». Aucun réseau, aucun appel réel.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { realiser, type PisteVisage } from "@/briques/realisation";
import {
  declinaisonsDemandees,
  fenetreFormat,
  formatsDemandes,
  lireFormatsFacecam,
  plansDuFormat,
  RATIOS_FACECAM,
} from "@/briques/formats-facecam";
import { formatsDeLaFabrication } from "@/moteurs/montage-facecam/declinaisons";

const SOURCE = { largeur: 3840, hauteur: 2160 };
const DUREE = 40;
const RACINE = process.cwd();

function mots(debut: number, fin: number) {
  const m = [];
  for (let t = debut, i = 0; t + 0.3 < fin; t += 0.385, i++) m.push({ mot: i % 7 === 3 ? "transformation" : "et", debutSec: +t.toFixed(3), finSec: +(t + 0.3).toFixed(3) });
  return m;
}

/** Piste fictive : visage un peu à droite, yeux à `yeuxY` de la hauteur de la source. */
function piste(yeuxY: number, yeuxX = 0.52): PisteVisage {
  const echantillons = [];
  for (let t = 0; t <= DUREE; t += 0.12) echantillons.push({ t: +t.toFixed(2), yeuxX, yeuxY, boite: [yeuxX - 0.055, yeuxY - 0.115, 0.11, 0.27] as [number, number, number, number], bouche: 0.2, confiance: 1 });
  return { version: 1, largeurSource: SOURCE.largeur, hauteurSource: SOURCE.hauteur, imagesParSec: 25, echantillons, visageTrouvePct: 100 };
}

describe("UO-10 · T8 : fenêtre 4:5 sans zoom au-delà du 9:16, yeux à 30-38 %", () => {
  for (const yeuxY of [0.3, 0.36, 0.42]) {
    it(`piste fictive, yeux à ${yeuxY * 100} % de la source`, () => {
      const p = piste(yeuxY);
      const plan916 = realiser({ gardes: [{ debutSec: 0, finSec: 12 }, { debutSec: 13, finSec: 26 }, { debutSec: 27, finSec: DUREE }], mots: mots(0, DUREE), piste: p, source: SOURCE });
      const plans = plansDuFormat("4:5", plan916.plans, SOURCE, p);
      expect(plans.length).toBe(plan916.plans.length);
      // Le 9:16 le plus agrandi : 1920 de sortie / hauteur de sa fenêtre.
      const zoom916 = Math.max(1, ...plan916.plans.map((x) => 1920 / x.cadre.hauteur));
      for (const x of plans) {
        expect(x.agrandissement).toBeLessThanOrEqual(Math.max(zoom916, 1.16) + 1e-3);
        expect(x.agrandissement).toBeLessThanOrEqual(1.16 + 1e-3);
        expect(x.yeuxHauteur).toBeGreaterThanOrEqual(0.3 - 1e-3);
        expect(x.yeuxHauteur).toBeLessThanOrEqual(0.38 + 1e-3);
      }
    });
  }

  it("fenêtre seule : les trois tailles de plan restent sous 1,16 et les yeux dans la bande", () => {
    for (const taille of [100, 115, 130]) {
      const f = fenetreFormat("4:5", taille, { yeuxX: 0.5, yeuxY: 0.36 }, SOURCE);
      expect(f.agrandissement).toBeLessThanOrEqual(1.16 + 1e-3);
      expect(f.yeuxHauteur).toBeGreaterThanOrEqual(0.3 - 1e-3);
      expect(f.yeuxHauteur).toBeLessThanOrEqual(0.38 + 1e-3);
    }
  });
});

describe("UO-10 · T11 : 9:16 toujours coché, format choisi refait d'office", () => {
  it("le 9:16 est toujours le premier format, même sans rien demander", () => {
    expect(formatsDemandes()[0]).toBe("9:16");
    expect(formatsDemandes(["4:5"])[0]).toBe("9:16");
    expect(formatsDemandes(["1:1", "16:9"])).toEqual(["9:16", "1:1", "16:9"]);
    expect(RATIOS_FACECAM[0]).toBe("9:16");
    expect(declinaisonsDemandees(["9:16"])).toEqual([]);
    expect(lireFormatsFacecam({ facecamFormats: { version: 1, ratios: ["9:16", "4:5"] } }).ratios).not.toContain("9:16");
  });

  it("un format gardé dans entrees.facecamFormats est refait d'office pour une nouvelle version", () => {
    const entrees = { facecamFormats: { version: 1, ratios: ["4:5", "1:1"] } };
    const refaits = formatsDeLaFabrication({ ratios: ["9:16"], entrees } as never, { coupes: undefined, declinaisons: undefined });
    expect(refaits).toEqual(["4:5", "1:1"]);
    // Nouvelle version = nouvelle fabrication avec les mêmes entrées : même résultat.
    expect(formatsDeLaFabrication({ ratios: ["9:16"], entrees } as never, { coupes: undefined, declinaisons: undefined })).toEqual(refaits);
  });
});

describe("UO-10 · document d'état docs/formats/ETAT-4-5-ET-RECADRAGE.md", () => {
  const chemin = join(RACINE, "docs/formats/ETAT-4-5-ET-RECADRAGE.md");

  it("existe", () => {
    expect(existsSync(chemin)).toBe(true);
  });

  it("cite, pour chaque générateur de src/formats/*/index.ts, ses ratios déclarés avec le chemin et la ligne exacts", () => {
    const doc = readFileSync(chemin, "utf8");
    const dossiers = readdirSync(join(RACINE, "src/formats"), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(RACINE, "src/formats", d.name, "index.ts")));
    let trouves = 0;
    for (const d of dossiers) {
      const rel = `src/formats/${d.name}/index.ts`;
      const lignes = readFileSync(join(RACINE, rel), "utf8").split("\n");
      const i = lignes.findIndex((l) => /^\s{2}ratios:\s*\[/.test(l));
      if (i < 0) continue;
      trouves++;
      expect(doc).toContain(`${rel}:${i + 1}`);
      expect(doc).toContain(lignes[i].trim().replace(/,$/, ""));
    }
    expect(trouves).toBeGreaterThanOrEqual(9);
  });

  it("marque T9 et T10 « non fait » avec ce qui bloque (9:16 seul, rendu figé 1080 × 1920, SORTIE_V4)", () => {
    const doc = readFileSync(chemin, "utf8");
    expect(doc).toMatch(/T9[^\n]*non fait/i);
    expect(doc).toMatch(/T10[^\n]*non fait/i);
    expect(doc).toContain("SORTIE_V4");
    expect(doc).toContain("src/moteurs/montage-facecam-animee/chaine-v4.ts");
    expect(doc).toContain("1080");
    expect(doc).toContain("1920");
  });

  it("cite les tests existants et ne contient aucun montant en euros", () => {
    const doc = readFileSync(chemin, "utf8");
    expect(doc).toContain("tests/facecam-formats.test.ts");
    expect(doc).not.toMatch(/€|euros?\b/i);
  });
});
