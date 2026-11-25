/** Film d'un dossier sans équipe : le scenario.json du zip et le calage de ses ancres sur le script collé (moteur pur). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calerScenario } from "@/moteurs/montage-tutoriel-outil/calage-scenario";
import { scenarioCalable, scenarioDuDossier } from "@/moteurs/montage-tutoriel-outil/film-dossier";
import type { MotTutoriel } from "@/moteurs/montage-tutoriel-outil/etapes-tutoriel";

const BRUT = readFileSync("outils/maquettes-tableaux-de-bord/05-stocks/scenario.json", "utf8");
const SCRIPT = readFileSync("outils/maquettes-tableaux-de-bord/05-stocks/script-court.txt", "utf8");
const motsDe = (texte: string, pas = 0.4): MotTutoriel[] =>
  texte.split(/\s+/).filter(Boolean).map((mot, i) => ({ mot, debutSec: +(i * pas).toFixed(3), finSec: +(i * pas + pas - 0.05).toFixed(3) }));
const duree = (m: MotTutoriel[]) => Math.round((m.at(-1)!.finSec + 0.3) * 1000);

describe("scenarioDuDossier", () => {
  it("lit le scenario.json à la racine", () => {
    expect(scenarioDuDossier([{ chemin: "index.html", contenu: "<p/>" }, { chemin: "scenario.json", contenu: BRUT }])?.maquette).toBe("05-stocks");
  });
  it("à défaut, prend l'unique scenario.json d'un sous-dossier direct", () => {
    expect(scenarioDuDossier([{ chemin: "05-stocks/scenario.json", contenu: BRUT }])?.maquette).toBe("05-stocks");
  });
  it("la racine l'emporte sur un sous-dossier", () => {
    const autre = JSON.stringify({ ...JSON.parse(BRUT), maquette: "autre" });
    expect(scenarioDuDossier([{ chemin: "a/scenario.json", contenu: autre }, { chemin: "scenario.json", contenu: BRUT }])?.maquette).toBe("05-stocks");
  });
  it("deux sous-dossiers, trop profond, absent, JSON illisible ou schéma refusé : null", () => {
    expect(scenarioDuDossier([{ chemin: "a/scenario.json", contenu: BRUT }, { chemin: "b/scenario.json", contenu: BRUT }])).toBeNull();
    expect(scenarioDuDossier([{ chemin: "a/b/scenario.json", contenu: BRUT }])).toBeNull();
    expect(scenarioDuDossier([{ chemin: "index.html", contenu: "" }])).toBeNull();
    expect(scenarioDuDossier([{ chemin: "scenario.json", contenu: "{pas du json" }])).toBeNull();
    expect(scenarioDuDossier([{ chemin: "scenario.json", contenu: JSON.stringify({ version: "autre" }) }])).toBeNull();
  });
});

describe("scenarioCalable", () => {
  const scenario = scenarioDuDossier([{ chemin: "scenario.json", contenu: BRUT }])!;

  it("le script de la maquette se cale : le scénario est rendu tel quel", () => {
    const mots = motsDe(SCRIPT);
    expect(scenarioCalable(scenario, mots, duree(mots))).toBe(scenario);
  });

  it("mots d'ancrage absents : ancres réparties régulièrement, scénario calable, original intact", () => {
    const texte = Array.from({ length: 120 }, (_, i) => `mot${i % 7}`).join(" ") + " fin.";
    const mots = motsDe(texte);
    const d = duree(mots);
    expect(calerScenario(scenario, mots, d).ok).toBe(false);
    const avant = JSON.stringify(scenario);
    const c = scenarioCalable(scenario, mots, d)!;
    expect(c).not.toBeNull();
    expect(JSON.stringify(scenario)).toBe(avant);
    expect(calerScenario(c, mots, d).ok).toBe(true);
    const N = scenario.etapes.length;
    c.etapes.forEach((e, i) => {
      const idx = Math.floor((i * mots.length) / N);
      const forme = mots[idx]!.mot.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      const rang = mots.slice(0, idx + 1).filter((m) => m.mot.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === forme).length;
      expect(e.ancre).toEqual({ surMot: forme, occurrence: rang });
    });
  });

  it("trop peu de mots, voix de durée nulle : null", () => {
    const mots = motsDe("un deux trois");
    expect(scenarioCalable(scenario, mots, duree(mots))).toBeNull();
    expect(scenarioCalable(scenario, [], 1000)).toBeNull();
    const assez = motsDe(Array.from({ length: 40 }, (_, i) => `m${i}`).join(" "));
    expect(scenarioCalable(scenario, assez, 0)).toBeNull();
  });

  it("saute les mots sans lettre ni chiffre", () => {
    const texte = Array.from({ length: 60 }, (_, i) => (i % 3 === 0 ? "—" : `mot${i}`)).join(" ");
    const mots = motsDe(texte);
    const c = scenarioCalable(scenario, mots, duree(mots))!;
    expect(c).not.toBeNull();
    for (const e of c.etapes) expect((e.ancre as { surMot: string }).surMot).toMatch(/[\p{L}\p{N}]/u);
  });
});
