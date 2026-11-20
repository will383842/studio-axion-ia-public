/* eslint-disable @typescript-eslint/no-explicit-any -- lecture de l'exemple du catalogue (type large) */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { creerAppelEssai } from "@/services/retouche-chat/essai-a-blanc";
import { PHRASE_RENDU_NON_BRANCHE, apercevoirRetouche, appliquerRetouche, type PortsRetoucheChat } from "@/services/retouche-chat/service";

// C9-38-b-a (20/11) : le service transmet à « appliquer » la liste des objets permis portée par la version lue.
const OBJET = "objet-gros-chiffre"; // vrai objet inscrit : la liste fermée des pièces lue par le service est figée à l'import
const plan0 = (): PlanValide => validerPlan(structuredClone(PLAN_DEMO), { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const VALIDES = (CATALOGUE_BRIQUES as unknown as Record<string, any>)[OBJET].exemple;

type Version = { versionId: string; plan: PlanValide; objetsPermis?: readonly string[] };
function ports(version: Version, avecRendu = false) {
  const appels: { rendre: unknown[]; enregistrer: unknown[] } = { rendre: [], enregistrer: [] };
  const p: PortsRetoucheChat = {
    appeler: creerAppelEssai([]).appeler,
    lireVersionChoisie: async () => version,
    enregistrerVersion: async (e) => { appels.enregistrer.push(e); return { versionId: "v2" }; },
    choisirVersion: async () => {},
    ...(avecRendu ? { rendreScenes: async (e) => { appels.rendre.push(e); return { fichierCle: "k", dureeSec: 1 }; } } : {}),
  };
  return { p, appels };
}

const ajoutObjet = (plan: PlanValide) => [{ type: "changer-brique", sceneId: plan.scenes[0]!.id, piece: OBJET, parametres: VALIDES }];
const zoom = (plan: PlanValide) => [{ type: "changer-mot", sceneId: plan.scenes[0]!.id, ancien: "Axion", nouveau: "Studio" }];
const demandes = (plan: PlanValide) => [ajoutObjet(plan), zoom(plan), []];

describe("C9-38-b-a : service-retouche et liste d'objets permis", () => {
  it("a) éteint = identique : sans champ, puis objetsPermis vide, mêmes résultats et mêmes arguments", async () => {
    for (const ops of demandes(plan0())) {
      const sans = ports({ versionId: "v1", plan: plan0() }, true);
      const vide = ports({ versionId: "v1", plan: plan0(), objetsPermis: [] }, true);
      const e = { demande: "demande", operations: ops };
      expect(await appliquerRetouche("vid", e, vide.p)).toEqual(await appliquerRetouche("vid", e, sans.p));
      expect(vide.appels).toEqual(sans.appels);
      const a1 = await apercevoirRetouche("vid", "ajoute du dynamisme", ports({ versionId: "v1", plan: plan0() }).p);
      const a2 = await apercevoirRetouche("vid", "ajoute du dynamisme", ports({ versionId: "v1", plan: plan0(), objetsPermis: [] }).p);
      expect(a2).toEqual(a1);
    }
  });

  it("b) avec la liste, la scène objet est gardée (plan-pret) ; sans, elle est remplacée comme aujourd'hui", async () => {
    const plan = plan0();
    const e = { demande: "objet", operations: ajoutObjet(plan) };
    const avec = await appliquerRetouche("vid", e, ports({ versionId: "v1", plan, objetsPermis: [OBJET] }).p);
    expect(avec.statut).toBe("plan-pret");
    if (avec.statut !== "plan-pret") throw new Error("plan-pret attendu");
    expect(avec.plan.scenes[0]!.piece).toBe(OBJET);
    const sans = await appliquerRetouche("vid", e, ports({ versionId: "v1", plan: plan0() }).p);
    const piece = sans.statut === "plan-pret" ? sans.plan.scenes[0]!.piece : null;
    expect(piece).not.toBe(OBJET);
    expect(sans.remarques).toEqual([PHRASE_RENDU_NON_BRANCHE]); // remarque de master, inchangée
  });

  it("c) une liste qui ne contient pas l'objet demandé donne le même résultat que sans liste", async () => {
    const e = { demande: "objet", operations: ajoutObjet(plan0()) };
    const autre = await appliquerRetouche("vid", e, ports({ versionId: "v1", plan: plan0(), objetsPermis: ["autre-objet"] }).p);
    const sans = await appliquerRetouche("vid", e, ports({ versionId: "v1", plan: plan0() }).p);
    expect(autre).toEqual(sans);
  });

  it("d) garde statique : service.ts n'importe ni pieces-permises, ni bibliotheque-video, ni reglages", () => {
    const t = readFileSync("src/services/retouche-chat/service.ts", "utf8");
    const imports = [...t.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const i of imports) expect(i).not.toMatch(/pieces-permises|bibliotheque-video|reglages/);
  });
});
