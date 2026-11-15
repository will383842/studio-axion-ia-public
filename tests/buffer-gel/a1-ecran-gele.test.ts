/**
 * LOT A1 — écran Réglages : la pastille « Gelé » et le bouton « Tester » vivaient dans le bloc de l'ancien outil, retiré en L0-13c.
 * Reste vrai : l'écran ne lit plus l'ancien outil ; jamais « Buffer », « Zernio » ni « API » visible dans l'ancien bloc (I6).
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(studio)/reglages/page.tsx", "utf8");

describe("A1 · bloc de l'ancien outil, retiré (L0-13c)", () => {
  it("plus de bloc, plus de bouton « Tester » de l'ancien outil, fichiers retirés", () => {
    expect(page).not.toMatch(/BlocBuffer|vueBuffer|actions-buffer/);
    expect(existsSync("src/components/reglages/BlocBuffer.tsx")).toBe(false);
    expect(existsSync("src/app/(studio)/reglages/actions-buffer.ts")).toBe(false);
  });

  it("la page ne lit plus l'état gelé ni les comptes de l'ancien outil", () => {
    expect(page).not.toMatch(/gele|canauxEnregistres|testerBuffer/);
  });

  it("la clé stockée de placement des mots-dièse (HSH-01) reste en place", () => {
    expect(page).toContain('id: "buffer", nom: "Outil principal"');
  });
});
