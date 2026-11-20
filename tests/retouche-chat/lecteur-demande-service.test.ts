/**
 * T-EXT-53b : le port facultatif `lecteur` de `apercevoirRetouche`. Doubles seulement, 0 €.
 */
import { describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { OperationRetouche } from "@/briques/operations";
import { appliquerOperations } from "@/services/retouche-chat/appliquer";
import { impactRetouche } from "@/services/retouche-chat/impact";
import { comprendreDemande } from "@/services/retouche-chat/comprendre";
import { creerAppelEssai } from "@/services/retouche-chat/essai-a-blanc";
import { apercevoirRetouche, appliquerRetouche, type PortsRetoucheChat } from "@/services/retouche-chat/service";

const plan: PlanValide = validerPlan(structuredClone(PLAN_DEMO), { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const REPONSE = JSON.stringify({ operations: [{ type: "changer-mot", sceneId: "s2", ancien: "assistant", nouveau: "robot" }] });
const DEMANDES = ["remplace assistant par robot à l'écran", "zoom sur la scène 2", "bonjour"];

function ports(extra: Partial<PortsRetoucheChat> = {}, reponses: string[] = [REPONSE, REPONSE, REPONSE]) {
  const essai = creerAppelEssai(reponses);
  const p: PortsRetoucheChat = {
    appeler: essai.appeler,
    lireVersionChoisie: async () => ({ versionId: "v1", plan }),
    enregistrerVersion: async () => ({ versionId: "v2" }),
    choisirVersion: async () => {},
    rendreScenes: async () => ({ fichierCle: "k", dureeSec: 1 }),
    ...extra,
  };
  return { p, essai };
}

describe("T-EXT-53b : service et lecteur commun", () => {
  it("sans `lecteur` : sortie identique à celle de comprendreDemande (3 demandes), aucune clé neuve", async () => {
    for (const d of DEMANDES) {
      const { p } = ports();
      // Instantané construit avec le chemin d'aujourd'hui.
      const c = await comprendreDemande({ phrase: d, plan }, creerAppelEssai([REPONSE]).appeler);
      const ap = appliquerOperations(plan, c.operations, {});
      const attendu = { demande: d, operations: ap.operations, impact: impactRetouche(plan, ap.plan, ap.operations), remarques: [...c.remarques] };
      const a = await apercevoirRetouche("vid", d, p);
      expect(a.demande).toBe(attendu.demande);
      expect(a.operations).toEqual(attendu.operations);
      expect(a.impact).toEqual(attendu.impact);
      expect("supplementaires" in a).toBe(false);
    }
  });

  it("avec `lecteur` : appelé une fois, comprendreDemande jamais (aucun appel), filtre du générateur appliqué, supplémentaires recopiés", async () => {
    const lecteur = vi.fn(async () => ({ operations: [{ type: "ajouter-dynamisme", intensite: "leger" }, { type: "changer-mot", sceneId: "s2", ancien: "assistant", nouveau: "robot" }] as OperationRetouche[], supplementaires: [{ type: "propre" }], remarques: ["remarque du lecteur"], source: "regles" }));
    const filtrer = vi.fn((operations: OperationRetouche[]) => ({ operations: operations.filter((o) => o.type !== "ajouter-dynamisme"), remarques: ["filtré"] }));
    const { p, essai } = ports({ lecteur, filtrerOperations: filtrer });
    const a = await apercevoirRetouche("vid", "demande", p);
    expect(lecteur).toHaveBeenCalledTimes(1);
    expect(lecteur).toHaveBeenCalledWith("demande", plan);
    expect(essai.appels).toHaveLength(0);
    expect(filtrer).toHaveBeenCalledTimes(1);
    expect(a.operations.map((o) => o.type)).toEqual(["changer-mot"]);
    expect(a.supplementaires).toEqual([{ type: "propre" }]);
    expect(a.remarques).toEqual(expect.arrayContaining(["remarque du lecteur", "filtré"]));
  });

  it("appliquerRetouche ne lit jamais le lecteur ni ne rappelle Claude", async () => {
    const lecteur = vi.fn(async () => ({ operations: [] as OperationRetouche[], remarques: [], source: "claude" }));
    const { p, essai } = ports({ lecteur });
    const r = await appliquerRetouche("vid", { demande: "d", operations: JSON.parse(REPONSE).operations }, p);
    expect(r.statut).toBe("rendue");
    expect(lecteur).not.toHaveBeenCalled();
    expect(essai.appels).toHaveLength(0);
  });

  it("vidéo sans plan : le lecteur n'est pas appelé", async () => {
    const lecteur = vi.fn();
    const { p } = ports({ lecteur: lecteur as never, lireVersionChoisie: async () => null });
    const a = await apercevoirRetouche("vid", "d", p);
    expect(a.operations).toEqual([]);
    expect(lecteur).not.toHaveBeenCalled();
  });
});
