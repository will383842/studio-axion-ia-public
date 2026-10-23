/**
 * CORRECTEUR 1 (argent) — B7 : la veille des outils ne présente plus un résumé à règles fixes comme venant de Claude.
 * Claude relié n'hérite plus du résumé simulé ; chaque nouveauté porte `simule` ; l'écran dit la vérité. Aucun appel
 * réseau (un faux `fetch` qui échoue s'il est appelé), aucune vraie clé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { creerFournisseurScriptClaude } = await import("@/fournisseurs/claude/inscription");
const { fournisseurScriptSimulation } = await import("@/fournisseurs/simulation/script");
const veille = await import("@/services/veille");

const demande = { outil: "Remotion", role: "montage", versionUtilisee: "4.0.0", versionVue: "4.1.0", notes: "New voice features" };

describe("B7 · résumé de la veille", () => {
  it("le fournisseur Claude n'hérite plus du résumé à règles fixes en se disant réel", () => {
    const fetchInterdit = vi.fn(async () => {
      throw new Error("aucun appel réseau dans les essais");
    }) as unknown as typeof fetch;
    const claude = creerFournisseurScriptClaude("cle-factice", fetchInterdit);
    expect(claude.mode).toBe("reel");
    expect(claude.resumerNouveaute).toBeUndefined();
  });

  it("Claude relié : le résumé est fait par les règles fixes ET marqué simulé", async () => {
    const fetchInterdit = vi.fn(async () => {
      throw new Error("aucun appel réseau dans les essais");
    }) as unknown as typeof fetch;
    const r = await veille.resumerAvec(creerFournisseurScriptClaude("cle-factice", fetchInterdit), demande);
    expect(r.simule).toBe(true);
    expect(r.ceQueCaChange.length).toBeGreaterThan(0);
    expect(fetchInterdit).not.toHaveBeenCalled();
  });

  it("outil d'essai : marqué simulé aussi", async () => {
    const r = await veille.resumerAvec(fournisseurScriptSimulation, demande);
    expect(r.simule).toBe(true);
  });

  it("l'écran ne dit plus « tant que Claude n'est pas relié » (faux une fois Claude relié)", () => {
    const ecran = readFileSync(join(process.cwd(), "src/app/(studio)/veille/_composants/EcranVeille.tsx"), "utf8");
    expect(ecran).not.toMatch(/tant que Claude n(?:&apos;|')est pas relié/);
    expect(ecran).toMatch(/simule/);
  });
});
