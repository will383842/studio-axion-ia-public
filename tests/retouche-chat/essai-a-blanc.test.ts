import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { ErreurClaude, type RequeteClaude } from "@/fournisseurs/claude/client";
import { apercevoirRetouche, type PortsRetoucheChat } from "@/services/retouche-chat/service";
import { creerAppelEssai } from "@/services/retouche-chat/essai-a-blanc";

const plan0 = (): PlanValide => validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const ports = (appeler: PortsRetoucheChat["appeler"]): PortsRetoucheChat => ({
  appeler,
  lireVersionChoisie: async () => ({ versionId: "v1", plan: plan0() }),
  enregistrerVersion: async () => ({ versionId: "v2" }),
  choisirVersion: async () => {},
});
const REPONSE = '{"operations":[{"type":"ajouter-dynamisme","intensite":"leger"}]}';
const requete = (t: string): RequeteClaude => ({ modele: "m", maxTokens: 1, effort: "low", systeme: [], messages: [{ role: "user", contenu: t }] });

describe("double de `appeler` (essai à blanc)", () => {
  it("réponse écrite d'avance : opération lue, source LLM, requête enregistrée avec la phrase", async () => {
    const { appeler, appels } = creerAppelEssai([REPONSE]);
    const r = await apercevoirRetouche("vid", "ajoute du dynamisme", ports(appeler));
    expect(r.operations).toEqual([{ type: "ajouter-dynamisme", intensite: "leger" }]);
    expect(appels).toHaveLength(1);
    expect(appels[0]!.messages[0]!.contenu).toContain("ajoute du dynamisme");
  });

  it("source LLM (comprendreDemande directement)", async () => {
    const { comprendreDemande } = await import("@/services/retouche-chat");
    const { appeler } = creerAppelEssai([REPONSE]);
    const c = await comprendreDemande({ phrase: "ajoute du dynamisme", plan: plan0() }, appeler);
    expect(c.source).toBe("llm");
  });

  it("double en panne : lecture simple et remarque", async () => {
    const { comprendreDemande } = await import("@/services/retouche-chat");
    const { appeler, appels } = creerAppelEssai([new ErreurClaude("surcharge", "surcharge")]);
    const c = await comprendreDemande({ phrase: "ajoute du dynamisme", plan: plan0() }, appeler);
    expect(c.source).toBe("simple");
    expect(c.remarques.length).toBeGreaterThan(0);
    expect(appels).toHaveLength(1);
    const r = await apercevoirRetouche("vid", "ajoute du dynamisme", ports(creerAppelEssai([new Error("panne")]).appeler));
    expect(r.operations).toEqual([{ type: "ajouter-dynamisme", intensite: "leger" }]);
  });

  it("double épuisé : ErreurClaude « requete » puis lecture simple", async () => {
    const { appeler, appels } = creerAppelEssai([]);
    await expect(appeler(requete("x"))).rejects.toMatchObject({ code: "requete" });
    expect(appels).toHaveLength(1);
    const r = await apercevoirRetouche("vid", "ajoute du dynamisme", ports(creerAppelEssai([]).appeler));
    expect(r.operations).toEqual([{ type: "ajouter-dynamisme", intensite: "leger" }]);
    expect(r.remarques.length).toBeGreaterThan(0);
  });

  it("réponse complète, copie de la requête, rang, fonction", async () => {
    const { appeler, appels } = creerAppelEssai((q, rang) => (rang === 0 ? `a:${q.messages[0]!.contenu}` : new Error("b")));
    const q = requete("salut");
    const rep = await appeler(q);
    expect(rep).toMatchObject({ texte: "a:salut", modele: "essai-a-blanc", modeleDemande: "essai-a-blanc", replis: [], stopReason: "end_turn" });
    expect(rep.jetons).toEqual({ entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 });
    q.messages[0]!.contenu = "modifié";
    expect(appels[0]!.messages[0]!.contenu).toBe("salut");
    await expect(appeler(q)).rejects.toThrow("b");
    expect(appels).toHaveLength(2);
  });

  it("garde statique : aucun réseau, aucune dépense", () => {
    const src = readFileSync("src/services/retouche-chat/essai-a-blanc.ts", "utf8");
    const imports = [...src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    expect(imports.some((i) => /generation-claude|credits|budget|mode-budget|autonomie|couts|cle-depense|depense-claude|image-video|server-only/.test(i))).toBe(false);
    expect(src).not.toMatch(/\bfetch\s*\(/);
  });
});
