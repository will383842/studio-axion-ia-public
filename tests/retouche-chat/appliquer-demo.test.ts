import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { appliquerRetouche, PHRASE_RENDU_NON_BRANCHE, PHRASE_SANS_PLAN, type PortsRetoucheChat } from "@/services/retouche-chat/service";
import { appliquerRetoucheDemo, PHRASE_RETOUCHE_LANCEE, type LancerDemo } from "@/services/retouche-chat/appliquer-demo";

const plan0 = (): PlanValide => validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const OPS = [{ type: "changer-mot", sceneId: "s2", ancien: "Axion CRM", nouveau: "Axion Pro" }];
const E = { demande: "  change Axion CRM en Axion Pro  ", operations: OPS };

function ports(sur: Partial<PortsRetoucheChat> = {}, avecPlan = true) {
  const p = {
    appeler: vi.fn(),
    lireVersionChoisie: vi.fn(async () => (avecPlan ? { versionId: "v1", plan: plan0() } : null)),
    rendreScenes: vi.fn(async () => ({ fichierCle: "x", dureeSec: 1 })),
    enregistrerVersion: vi.fn(async () => ({ versionId: "v2" })),
    choisirVersion: vi.fn(async () => undefined),
    ...sur,
  };
  return p as typeof p & PortsRetoucheChat;
}
const lancerOk = () => vi.fn<LancerDemo>(async () => ({ statut: "lancee", travailId: "t1" }));

describe("N-26-c1 · appliquerRetoucheDemo (lancement injecté, aucune version écrite)", () => {
  it("a) version sans plan : inchangée + phrase, lancer 0 appel", async () => {
    const lancer = lancerOk();
    const r = await appliquerRetoucheDemo("vid", E, ports({}, false), lancer);
    expect(r.statut).toBe("inchangee");
    expect(r.remarques).toContain(PHRASE_SANS_PLAN);
    expect(lancer).not.toHaveBeenCalled();
  });

  it("b) aucune scène touchée : inchangée, 0 appel", async () => {
    const lancer = lancerOk();
    const r = await appliquerRetoucheDemo("vid", { demande: "rien", operations: [] }, ports(), lancer);
    expect(r.statut).toBe("inchangee");
    expect(lancer).not.toHaveBeenCalled();
  });

  it("c) plan changé : lancee, lancer appelé une fois, aucune version écrite même avec un port de rendu", async () => {
    const lancer = lancerOk();
    const p = ports();
    const r = await appliquerRetoucheDemo("vid", E, p, lancer);
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") throw new Error("attendu lancee");
    expect(r.travailId).toBe("t1");
    expect(r.remarques).toContain(PHRASE_RETOUCHE_LANCEE);
    expect(r.remarques).not.toContain(PHRASE_RENDU_NON_BRANCHE);
    expect(lancer).toHaveBeenCalledTimes(1);
    const arg = lancer.mock.calls[0]![0];
    expect(arg.videoId).toBe("vid");
    expect(arg.versionId).toBe("v1");
    expect(arg.consigne).toBe("change Axion CRM en Axion Pro");
    expect(arg.plan).not.toEqual(plan0());
    expect(p.rendreScenes).not.toHaveBeenCalled();
    expect(p.enregistrerVersion).not.toHaveBeenCalled();
    expect(p.choisirVersion).not.toHaveBeenCalled();
  });

  it("c bis) la consigne est coupée à 500 caractères", async () => {
    const lancer = lancerOk();
    await appliquerRetoucheDemo("vid", { demande: "x".repeat(900), operations: OPS }, ports(), lancer);
    expect(lancer.mock.calls[0]![0].consigne.length).toBe(500);
  });

  it("d) lancer répond plan-pret : plan retouché rendu, raison dans les remarques", async () => {
    const lancer = vi.fn<LancerDemo>(async () => ({ statut: "plan-pret", raison: "Pas de place pour lancer." }));
    const r = await appliquerRetoucheDemo("vid", E, ports(), lancer);
    expect(r.statut).toBe("plan-pret");
    expect(r.remarques).toContain("Pas de place pour lancer.");
    expect(r.remarques).not.toContain(PHRASE_RENDU_NON_BRANCHE);
    if (r.statut === "plan-pret") expect(r.plan).not.toEqual(plan0());
  });

  it("e) lancer qui lève : plan-pret + remarque d'échec", async () => {
    const lancer = vi.fn<LancerDemo>(async () => {
      throw new Error("panne");
    });
    const r = await appliquerRetoucheDemo("vid", E, ports(), lancer);
    expect(r.statut).toBe("plan-pret");
    expect(r.remarques).toContain("La retouche n'a pas pu être lancée : le plan reste prêt.");
  });

  it("f) voix touchée : plan-pret, lancer 0 appel", async () => {
    const lancer = lancerOk();
    const ops = [{ type: "modifier-script", ancien: "38", nouveau: "40" }];
    const p = ports({ filtrerOperations: (o) => ({ operations: o, remarques: [] }) });
    const r = await appliquerRetoucheDemo("vid", { demande: "modifie le script", operations: ops }, p, lancer);
    expect(r.statut).not.toBe("lancee");
    expect(lancer).not.toHaveBeenCalled();
  });

  it("g) parité : impact et remarques identiques à appliquerRetouche sans rendu", async () => {
    const ref = await appliquerRetouche("vid", E, { ...ports(), rendreScenes: undefined });
    if (ref.statut !== "plan-pret") throw new Error("attendu plan-pret");
    const r = await appliquerRetoucheDemo("vid", E, ports(), lancerOk());
    if (r.statut !== "lancee") throw new Error("attendu lancee");
    expect(r.impact).toEqual(ref.impact);
    expect(r.remarques.slice(0, -1)).toEqual(ref.remarques.filter((m) => m !== PHRASE_RENDU_NON_BRANCHE));
  });

  it("h) gardes statiques : rien d'injecté n'est importé, aucun réglage lu", () => {
    const src = readFileSync(join(process.cwd(), "src/services/retouche-chat/appliquer-demo.ts"), "utf8");
    expect(src).not.toMatch(/lireParametre/);
    expect(src).not.toMatch(/from "[^"]*(fabrication|lancer-demo|deps-demo-studio|_commun)[^"]*"/);
    expect(src).not.toMatch(/server-only/);
  });
});
