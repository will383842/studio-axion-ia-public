/**
 * Lot E (5, 6) : « Refaire la phrase » refait UNE phrase, sans prix ni budget affiché ; pour les formats qui ne savent
 * pas (avatar, image → vidéo, face caméra animée) le message est clair et ne parle pas d'argent.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOTE_SANS_RETOUCHE } from "@/services/modifications";
import { RETOUCHE_PAS_DISPONIBLE } from "@/services/fabrication";
import { RETOUCHE_PAS_DISPONIBLE as DU_DOMAINE } from "@/domaine/voix-phrases";

const lire = (p: string) => readFileSync(join(__dirname, "../..", p), "utf8");
const SANS_ARGENT = /\b(prix|budget|plafond|coût|couts?|tarif|devis|payé|payer|centimes?)\b|€/i;

describe("bouton « Refaire la phrase »", () => {
  const src = lire("src/components/prononciations/RefairePhrase.tsx");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("ne demande aucune estimation et n'affiche aucun montant", () => {
    expect(code).not.toMatch(/estimerRetoucheAction|formaterMontant|centimes/);
    expect(code).not.toMatch(/gratuit/);
  });

  it("refait UNE phrase : un seul plan part à la retouche", () => {
    expect(code).toMatch(/\[idDuPlan\]/);
    expect(code).not.toMatch(/Refaire \$\{ids\.length/);
  });
});

describe("formats qui ne savent pas refaire une phrase", () => {
  it("le service et le domaine disent exactement la même chose", () => {
    expect(RETOUCHE_PAS_DISPONIBLE).toBe(DU_DOMAINE);
  });
  it("le message est clair, en vouvoiement, et sans argent", () => {
    for (const m of [RETOUCHE_PAS_DISPONIBLE, NOTE_SANS_RETOUCHE]) {
      expect(m).toMatch(/phrase/i);
      expect(m).toMatch(/refaire la vidéo|refaites la vidéo/i);
      expect(m).not.toMatch(SANS_ARGENT);
      expect(m).not.toMatch(/pas encore disponible/);
    }
  });
  it("la face caméra animée dit la même chose", () => {
    const f = lire("src/moteurs/montage-facecam/index.ts");
    expect(f).not.toContain("La retouche d'un passage n'est pas encore disponible pour cette vidéo.");
    expect(f).toContain("RETOUCHE_PAS_DISPONIBLE");
  });
});
