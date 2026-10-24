import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { TYPES_MINI } from "@/briques/visuels/registre-mini";
import { TAILLES, TITRE, TAILLE_TEXTE_MIN } from "../../studio-rendu/compositions/visuels/commun/constantes";
import { COMPOSANTS_MINI } from "../../studio-rendu/compositions/visuels/mini";

// Sans les dépendances de studio-rendu (CI ciblée des visuels), « remotion » est simulé : les composants se chargent quand même.
// Installé, le vrai module est chargé (son chemin résolu n'est pas « remotion »), le test reste le même.
vi.mock("remotion", () => ({ cancelRender: () => undefined, continueRender: () => undefined, delayRender: () => 0, AbsoluteFill: () => null }));

const RACINE = new URL("../../studio-rendu/compositions/visuels/", import.meta.url);

function sources(dossier: URL): { chemin: string; texte: string }[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const u = new URL(e.name + (e.isDirectory() ? "/" : ""), dossier);
    if (e.isDirectory()) return sources(u);
    return /\.(tsx?|css)$/.test(e.name) ? [{ chemin: u.pathname, texte: readFileSync(u, "utf8") }] : [];
  });
}

describe("composition VisuelPage : aucun texte sous 26 px", () => {
  it("toutes les tailles de texte déclarées valent au moins 26 px", () => {
    expect(TAILLE_TEXTE_MIN).toBe(26);
    for (const [nom, px] of Object.entries(TAILLES)) expect(px, nom).toBeGreaterThanOrEqual(26);
    expect(TITRE.min).toBeGreaterThanOrEqual(90);
    expect(TITRE.max).toBeLessThanOrEqual(170);
  });

  it("aucune taille de police littérale sous 26 px dans les composants", () => {
    for (const { chemin, texte } of sources(RACINE)) {
      for (const m of texte.matchAll(/fontSize\s*[:=]\s*\{?\s*(\d+(?:\.\d+)?)/g)) {
        expect(Number(m[1]), `${chemin} : fontSize ${m[1]}`).toBeGreaterThanOrEqual(26);
      }
      // aucune police par raccourci « font: 20px ... » ni unité em/rem/pt/vw qui échapperait au contrôle
      expect(texte, chemin).not.toMatch(/fontSize\s*:\s*["'`][\d.]+(?:em|rem|pt|vw|vh)/);
      expect(texte, chemin).not.toMatch(/\bfont\s*:\s*["'`]/);
    }
  });

  it("une seule police manuscrite, Kalam, réservée aux annotations (L9) ; aucune URL dans les composants", () => {
    // Kalam n'est déclarée qu'aux trois endroits prévus : son chargeur, sa constante, et les pages qui portent une annotation manuscrite.
    const KALAM_PERMIS = /(?:^|\/)(?:polices\.ts|constantes\.ts|controle-debordement\.tsx|T22\.tsx|T23\.tsx)$/;
    for (const { chemin, texte } of sources(RACINE)) {
      expect(texte, chemin).not.toMatch(/caveat|handwrit|marker/i);
      if (!KALAM_PERMIS.test(chemin)) expect(texte, chemin).not.toMatch(/kalam|cursive/i);
      expect(texte, chemin).not.toMatch(/https?:\/\//i);
    }
  });

  it("aucune couleur hors charte : tout passe par la charte", () => {
    for (const { chemin, texte } of sources(RACINE)) {
      if (chemin.endsWith("polices.ts")) continue;
      expect(texte, chemin).not.toMatch(/#[0-9a-f]{6}\b/i);
    }
  });
});

describe("mini-visuels du registre", () => {
  it.each(TYPES_MINI)("%s a un composant", (id) => {
    expect(typeof COMPOSANTS_MINI[id]).toBe("function");
  });
  it("aucun composant en trop", () => {
    expect(Object.keys(COMPOSANTS_MINI).sort()).toEqual([...TYPES_MINI].sort());
  });
});
