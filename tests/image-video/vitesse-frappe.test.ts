/**
 * L17 · Vitesse de frappe de la recherche : UNE seule constante (`VITESSE_FRAPPE`, `src/briques/schema-motion/types.ts`),
 * lue par la composition (`planFrappe`, `planFrappeMots`) et par le moteur (heures des mots tapés). Plus aucune copie.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VITESSE_FRAPPE } from "@/briques/schema-motion";
import { planFrappe, planFrappeMots } from "../../studio-rendu/compositions/image-video/plan-objets";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("VITESSE_FRAPPE : une seule source", () => {
  it("définie une fois, dans les types du motion de schéma", () => {
    expect(VITESSE_FRAPPE).toBe(22);
    expect(lire("src/briques/schema-motion/types.ts")).toMatch(/^export const VITESSE_FRAPPE = \d+;$/m);
  });

  it("le moteur et la composition l'importent, aucun ne la recopie ni ne garde un défaut chiffré", () => {
    const moteur = lire("src/moteurs/montage-image-video/mise-en-scene.ts");
    // Le plan des objets vit dans la brique partagée (lu par `studio-rendu` ET par le contrôle Q21 du moteur).
    const compo = lire("src/briques/schema-motion/plan-objets.ts");
    expect(moteur).not.toMatch(/const VITESSE_FRAPPE\b/);
    expect(compo).not.toMatch(/const VITESSE_FRAPPE\b/);
    expect(moteur).toMatch(/import \{[^}]*\bVITESSE_FRAPPE\b[^}]*\} from "@\/briques\/schema-motion"/);
    expect(compo).toMatch(/import \{[^}]*\bVITESSE_FRAPPE\b[^}]*\} from "\.\/index"/);
    expect(compo).toMatch(/function planFrappe\([^)]*vitesse = VITESSE_FRAPPE\)/);
    expect(compo).toMatch(/function planFrappeMots\([^)]*vitesse = VITESSE_FRAPPE\)/);
  });

  it("la composition tape à cette vitesse par défaut (1 s → VITESSE_FRAPPE signes)", () => {
    const texte = "x".repeat(VITESSE_FRAPPE * 3);
    expect(planFrappe(texte, 1, 0).texte).toHaveLength(VITESSE_FRAPPE);
    expect(planFrappeMots(texte, 1, [0]).texte).toHaveLength(VITESSE_FRAPPE);
  });

  it("un mot de N signes, tapé à cette vitesse, finit à N / VITESSE_FRAPPE s (l'heure que le moteur réserve)", () => {
    const mots = "assistant client";
    const fin1 = "assistant".length / VITESSE_FRAPPE;
    // Le 2ᵉ mot ne commence qu'après la fin du 1ᵉʳ : à fin1 - ε rien du 2ᵉ ; juste après fin1 + 0,05 (marge du moteur), il commence.
    expect(planFrappeMots(mots, fin1 - 0.001, [0, fin1 + 0.05]).texte).not.toContain(" ");
    expect(planFrappeMots(mots, fin1 + 0.05 + 1.5 / VITESSE_FRAPPE, [0, fin1 + 0.05]).texte).toBe("assistant c");
  });
});
