// T-EXT-54d : garde-fous du petit lanceur qui écrit zones.json. Lecture du texte : AUCUN lancement, aucun FFmpeg, aucun navigateur.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const texte = readFileSync("outils/maquettes-tableaux-de-bord/controle/zones-tutoriel.mts", "utf8");
const principal = texte.slice(texte.indexOf("function principal"));

describe("zones-tutoriel.mts", () => {
  it("la garde d'environnement passe avant toute lecture de fichier", () => {
    const garde = principal.indexOf("environnementAutorise(");
    expect(garde).toBeGreaterThan(-1);
    expect(principal.indexOf("lireJson(")).toBeGreaterThan(garde);
    expect(principal.indexOf("readFileSync(")).toBe(-1);
    expect(principal.indexOf("mkdirSync(")).toBeGreaterThan(garde);
  });
  it("aucun processus lancé, aucun réseau, aucun navigateur, aucune IA", () => {
    expect(texte).not.toMatch(/spawn|exec(File)?Sync|child_process|fetch\(|https?:\/\/|playwright|chromium|ffmpeg\s*\(|anthropic/i);
  });
  it("n'écrit que zones.json, hors du dépôt", () => {
    const ecritures = texte.match(/writeFileSync\(([^)]*)\)/g) ?? [];
    expect(ecritures).toHaveLength(1);
    expect(ecritures[0]).toContain('"zones.json"');
    expect(texte).toContain("doit être hors du dépôt");
  });
  it("importe la garde de la capture et la géométrie, rien de la mesure commune", () => {
    expect(texte).toContain('from "../capture/garde"');
    expect(texte).toContain("nettete");
    expect(texte).not.toContain("mesures-video");
  });
  it("dit quand le plan de motion est recalculé", () => {
    expect(texte).toContain("Aucun plan de motion fourni");
  });
});
