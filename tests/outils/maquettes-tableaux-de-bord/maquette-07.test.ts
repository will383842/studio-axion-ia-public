/**
 * T-EXT-06 · Maquette 07 « Espace démo · Connaissances » : conforme à la charte, chiffres étiquetés, porte de pilotage.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const RACINE = join(process.cwd(), "outils/maquettes-tableaux-de-bord");
const DOSSIER = join(RACINE, "07-taches");
const index = readFileSync(join(DOSSIER, "index.html"), "utf8");
const provenance = readFileSync(join(DOSSIER, "PROVENANCE.md"), "utf8");
const noms = JSON.parse(readFileSync(join(RACINE, "charte/noms-neutres.json"), "utf8")) as NomsNeutres;

const ETAPES = ["taches", "ensemble", "reponse", "relance", "recherche", "controle", "fin"];

describe("maquette 07", () => {
  it("passe le contrôle de la charte", () => {
    const r = controlerMaquette([{ chemin: "index.html", contenu: index }], noms, "07-taches");
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("n'a plus de bleu d'origine, d'Inter ni de promesse « automatiquement »", () => {
    for (const interdit of ["#3773a3", "#326391", "#eaf1fa", "automatiquement"]) {
      expect(index.toLowerCase()).not.toContain(interdit);
    }
    expect(index).not.toMatch(/\bInter\b/);
    expect(index).toContain("charte/charte.css");
  });

  it("chaque chiffre de la liste est suivi de « exemple » (ou absent)", () => {
    for (const chiffre of ["+ 12 %", "93 %", "97 h", "1 284"]) {
      let depuis = 0;
      for (;;) {
        const i = index.indexOf(chiffre, depuis);
        if (i < 0) break;
        expect(index.slice(i + chiffre.length, i + chiffre.length + 60).toLowerCase(), chiffre).toContain("exemple");
        depuis = i + chiffre.length;
      }
    }
  });

  it("n'affiche aucun montant d'argent", () => {
    expect(index).not.toMatch(/€|\beuros?\b|\bEUR\b/i);
  });

  it("window.demoMaquette déclare les 7 étapes, aller et reinitialiser ; demoVideo est gardé", () => {
    expect(index).toMatch(/window\.demoMaquette\s*=/);
    expect(index).toMatch(/\baller\s*\(\s*id\s*\)/);
    expect(index).toMatch(/\breinitialiser\s*\(\s*\)/);
    for (const id of ETAPES) expect(index, id).toMatch(new RegExp(`\\b${id}\\s*:\\s*\\{`));
    expect(index).toMatch(/window\.demoVideo\s*=/);
    expect(index.indexOf("window.demoVideo=")).toBeLessThan(index.indexOf("window.demoMaquette="));
  });

  it("les sélecteurs des scènes existent dans la maquette", () => {
    for (const sel of ["kpis", "cols", "panel", "table", "blocksp"]) expect(index).toContain(sel);
  });

  it("PROVENANCE.md cite le chemin source", () => {
    expect(provenance).toContain("VIDEO_DEMO_ORBIS_2026/01_TABLEAU_DE_BORD/orbis_mode_video.html");
  });
});
