/** Harmonisation H8a : en-tête et étapes de l'assistant (face caméra ET avocat) dans le gabarit de création. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ETAPES_EXPRESS } from "@/assistant/etapes/meta";

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
const assistant = lire("src/assistant/Assistant.tsx");
const express = lire("src/assistant/etapes/Express.tsx");

describe("assistant · étapes de l'express", () => {
  it("deux étapes, « Votre vidéo » puis « Fabrication »", () => {
    expect(ETAPES_EXPRESS.map((e) => e.libelle)).toEqual(["Votre vidéo", "Fabrication"]);
    expect(ETAPES_EXPRESS.map((e) => e.cle)).toEqual(["express", "fabrication"]);
  });
});

describe("assistant · en-tête", () => {
  it("Assistant passe par GabaritCreation, plus d'EnTeteAssistant ni de <h1> maison", () => {
    expect(assistant).toMatch(/<GabaritCreation/);
    expect(assistant).not.toMatch(/EnTeteAssistant/);
    expect(assistant).not.toMatch(/<h1\b/);
  });

  it("Express n'a plus de <h1> : le titre « Votre vidéo » vient de EnTetePage", () => {
    expect(express).not.toMatch(/<h1\b/);
    expect(assistant).toContain("Votre vidéo");
    expect(assistant).toMatch(/ETAPES_EXPRESS/);
  });

  it("le chemin pas à pas garde sa barre d'étapes cliquable et son bouton principal collé", () => {
    expect(assistant).toMatch(/onAller:\s*\(i\)\s*=>\s*void aller\(i\)/);
    expect(assistant).toMatch(/meta\.actionPropre/);
    expect(assistant).toContain("Étape précédente");
  });

  it("le quitter et l'état d'enregistrement du brouillon restent à l'écran", () => {
    expect(assistant).toContain("Quitter l'assistant");
    expect(assistant).toContain("Brouillon enregistré");
    expect(assistant).toContain("Enregistrement…");
  });
});
