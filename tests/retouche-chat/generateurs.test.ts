import { describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { apercevoirRetouche, appliquerRetouche, revenirAVersion, type PortsRetoucheChat } from "@/services/retouche-chat/service";
import {
  CLES_REGLAGE_RETOUCHE,
  GENERATEURS_RETOUCHE,
  adaptateurRetouche,
  appelPourGenerateur,
  filtrerOperationsGenerateur,
  fabriquerRenduPartiel,
  portsGenerateur,
  retoucheChatActif,
} from "@/services/retouche-chat/generateurs";

const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;
const idsScenes = plan.scenes.map((s) => s.id);

describe("réglage du chat de retouche par générateur", () => {
  it("trois générateurs, une clé chacun, éteint par défaut", async () => {
    expect([...GENERATEURS_RETOUCHE]).toEqual(["avocat", "image-video", "facecam-animee"]);
    expect(CLES_REGLAGE_RETOUCHE["image-video"]).toBe("retoucheChat.imageVideo");
    for (const g of GENERATEURS_RETOUCHE) {
      expect(await retoucheChatActif(g, async (_c, defaut) => defaut)).toBe(false);
      expect(await retoucheChatActif(g, async () => "true")).toBe(false);
      expect(await retoucheChatActif(g, async () => 1)).toBe(false);
      expect(await retoucheChatActif(g, async () => { throw new Error("panne"); })).toBe(false);
      expect(await retoucheChatActif(g, async () => true)).toBe(true);
    }
  });
});

describe("adaptateur : phrase → opérations, propre à chaque générateur", () => {
  it("la consigne dit ce qui est retouchable et ajoute la règle du générateur ; modèle Opus 5.5", async () => {
    const vu: { systeme: string; modele: string }[] = [];
    const base: AppelClaude = async (r) => {
      vu.push({ systeme: r.systeme.map((s) => s.texte).join("\n"), modele: r.modele });
      return { texte: '{"operations":[]}', jetonsEntree: 1, jetonsSortie: 1 } as never;
    };
    for (const g of GENERATEURS_RETOUCHE) {
      await appelPourGenerateur(g, base)({ modele: "claude-opus-5-5", maxTokens: 10, effort: "high", systeme: [{ texte: "BASE", cache: "1h" }], messages: [{ role: "user", contenu: "x" }], json: true });
    }
    expect(vu).toHaveLength(3);
    for (const v of vu) {
      expect(v.modele).toBe("claude-opus-5-5");
      expect(v.systeme).toContain("BASE");
      expect(v.systeme).toMatch(/ne changent jamais/i);
    }
    expect(vu[0]!.systeme).toContain(adaptateurRetouche("avocat").consigne);
    expect(vu[1]!.systeme).not.toBe(vu[2]!.systeme);
  });

  it("jamais la voix sans demande explicite ; jamais d'opération hors liste du générateur", () => {
    const ops = [
      { type: "modifier-script", ancien: "a", nouveau: "b" },
      { type: "ajuster-zoom", sceneId: "s2", facteur: 1.2 },
    ] as never[];
    const sans = filtrerOperationsGenerateur("avocat", ops, "zoom plus doux");
    expect(sans.operations.map((o) => o.type)).toEqual(["ajuster-zoom"]);
    expect(sans.remarques.join(" ")).toMatch(/texte lu/i);
    const avec = filtrerOperationsGenerateur("avocat", ops, "modifie le script : a devient b");
    expect(avec.operations.map((o) => o.type)).toEqual(["modifier-script", "ajuster-zoom"]);
    for (const g of GENERATEURS_RETOUCHE) expect(adaptateurRetouche(g).operations).not.toContain("modifier-script-sans-demande");
  });
});

function ports(opts: { rendre?: boolean } = {}) {
  const versions = new Map<string, PlanValide>([["v1", plan]]);
  const choix: string[] = [];
  const rendreScene = vi.fn(async (_p: PlanValide, id: string) => ({ cle: `scene-${id}-${_p.scenes.find((s) => s.id === id)!.empreinte}` }));
  const assembler = vi.fn(async (_p: PlanValide, cles: Record<string, string>) => ({ fichierCle: "final.mp4", dureeSec: Object.keys(cles).length }));
  const base: PortsRetoucheChat = {
    appeler: async () => {
      throw new Error("pas d'appel réel");
    },
    lireVersionChoisie: async () => ({ versionId: choix.at(-1) ?? "v1", plan: versions.get(choix.at(-1) ?? "v1")! }),
    enregistrerVersion: async (e) => {
      versions.set("v2", e.plan);
      return { versionId: "v2" };
    },
    choisirVersion: async (_v, id) => void choix.push(id),
  };
  const p = portsGenerateur("facecam-animee", base, opts.rendre === false ? {} : { rendreScene, assembler, rendusPrecedents: async () => Object.fromEntries(plan.scenes.map((s) => [s.id, `ancien-${s.id}`])) });
  return { p, rendreScene, assembler, versions, choix };
}

describe("rendu partiel par empreinte de scène", () => {
  it("ne rend que les scènes touchées, reprend les autres de la version d'avant", async () => {
    const { p, rendreScene, assembler } = ports();
    const r = await appliquerRetouche("vid", { demande: "zoom plus doux", operations: [{ type: "ajuster-zoom", sceneId: idsScenes[1], facteur: 1.1 }] }, p);
    expect(r.statut).toBe("rendue");
    expect(rendreScene).toHaveBeenCalledTimes(1);
    expect(rendreScene.mock.calls[0]![1]).toBe(idsScenes[1]);
    const cles = assembler.mock.calls[0]![1] as Record<string, string>;
    expect(cles[idsScenes[0]!]).toBe(`ancien-${idsScenes[0]}`);
    expect(cles[idsScenes[1]!]).toMatch(/^scene-/);
  });

  it("nouvelle version choisie, puis retour arrière par le choix de version ; la voix ne change pas", async () => {
    const { p, choix } = ports();
    const r = await appliquerRetouche("vid", { demande: "d", operations: [{ type: "ajuster-zoom", sceneId: idsScenes[1], facteur: 1.1 }] }, p);
    expect(r).toMatchObject({ statut: "rendue", versionId: "v2" });
    expect(r.statut === "rendue" && r.impact.voixTouchee).toBe(false);
    await revenirAVersion("vid", "v1", p);
    expect(choix).toEqual(["v2", "v1"]);
  });

  it("opération « modifier-script » venue du navigateur sans demande explicite : écartée à l'application aussi", async () => {
    const { p, rendreScene } = ports();
    const r = await appliquerRetouche("vid", { demande: "plus de punch", operations: [{ type: "modifier-script", ancien: plan.mots[0]!.texte, nouveau: "autre" }] }, p);
    expect(r.statut).toBe("inchangee");
    expect(rendreScene).not.toHaveBeenCalled();
  });

  it("aperçu : n'écrit rien, ne rend rien, applique le filtre du générateur", async () => {
    const { p, rendreScene, versions } = ports();
    const a = await apercevoirRetouche("vid", "ajoute du dynamisme", p);
    expect(a.operations.length).toBeGreaterThan(0);
    expect(rendreScene).not.toHaveBeenCalled();
    expect(versions.size).toBe(1);
  });

  it("fabriquerRenduPartiel : sans rendu de scène fourni, rien n'est branché", () => {
    expect(fabriquerRenduPartiel({} as never)).toBeUndefined();
  });
});
