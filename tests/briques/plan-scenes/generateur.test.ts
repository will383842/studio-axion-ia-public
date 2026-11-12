import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { genererPlan, MODELE_PLAN_SCENES, construireRequetePlan } from "@/briques/plan-scenes/generateur";
import { PLAN_DEMO, SCRIPT_DEMO } from "@/briques/plan-scenes/demo";
import { schemaPlanStrict } from "@/briques/plan-scenes/schema";
import { ErreurClaude, type ReponseClaude, type RequeteClaude } from "@/fournisseurs/claude/client";

const reponse = (texte: string): ReponseClaude => ({ texte, modeleDemande: MODELE_PLAN_SCENES, modele: MODELE_PLAN_SCENES, replis: [], stopReason: "end_turn", jetons: { entree: 1, cacheLu: 0, cacheEcrit: 0, sortie: 1 } });
const entree = { script: SCRIPT_DEMO, mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false };

describe("générateur de plan (faux fournisseur, aucun appel réel)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", () => {
      throw new Error("fetch interdit dans les tests");
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("modèle réglable par une constante, Opus 5.5 par défaut ; consigne avec le catalogue, réponse JSON", () => {
    expect(MODELE_PLAN_SCENES).toBe("claude-opus-5-5");
    const r = construireRequetePlan(entree);
    expect(r.modele).toBe(MODELE_PLAN_SCENES);
    expect(r.json).toBe(true);
    const consigne = r.systeme.map((b) => b.texte).join("\n");
    for (const id of ["curseur", "carte-kpi", "legende", "bulle-chat"]) expect(consigne).toContain(id);
    expect(r.messages[0]!.contenu).toContain(SCRIPT_DEMO.split(" ")[0]!);
  });

  it("sortie JSON correcte (même entourée de Markdown) : plan validé, empreintes, aucune remarque", async () => {
    const vus: RequeteClaude[] = [];
    const r = await genererPlan(entree, async (q) => {
      vus.push(q);
      return reponse("```json\n" + JSON.stringify(PLAN_DEMO) + "\n```");
    });
    expect(vus).toHaveLength(1);
    expect(schemaPlanStrict.safeParse(r.plan).success).toBe(true);
    expect(r.plan.scenes.map((s) => s.id)).toEqual(PLAN_DEMO.scenes.map((s) => s.id));
    expect(r.remarques).toEqual([]);
    expect(r.source).toBe("llm");
  });

  it("le minutage des mots fait foi (pas celui renvoyé par le LLM)", async () => {
    const autre = { ...PLAN_DEMO, mots: PLAN_DEMO.mots.map((m) => ({ ...m, debutMs: m.debutMs + 5 })) };
    const r = await genererPlan(entree, async () => reponse(JSON.stringify(autre)));
    expect(r.plan.mots).toEqual(PLAN_DEMO.mots);
  });

  it("sortie illisible deux fois : plan de repli niveau 1, remarque, pas d'erreur", async () => {
    let n = 0;
    const r = await genererPlan(entree, async () => {
      n++;
      return reponse("je ne sais pas");
    });
    expect(n).toBe(2);
    expect(r.source).toBe("repli");
    expect(r.plan.scenes.length).toBeGreaterThan(0);
    expect(r.plan.scenes.every((s) => s.niveau === 1)).toBe(true);
    expect(r.remarques.some((m) => m.code === "LLM_ILLISIBLE")).toBe(true);
  });

  it("fournisseur en panne : plan de repli, remarque claire", async () => {
    const r = await genererPlan(entree, async () => {
      throw new ErreurClaude("surcharge", "Claude : surchargé", 529, true);
    });
    expect(r.source).toBe("repli");
    expect(r.remarques.some((m) => m.code === "LLM_INDISPONIBLE")).toBe(true);
  });

  it("deuxième essai réussi après une sortie illisible : le motif est renvoyé au LLM", async () => {
    const vus: RequeteClaude[] = [];
    const r = await genererPlan(entree, async (q) => {
      vus.push(q);
      return reponse(vus.length === 1 ? "{coupé" : JSON.stringify(PLAN_DEMO));
    });
    expect(r.source).toBe("llm");
    expect(vus[1]!.messages.length).toBeGreaterThan(1);
  });
});
