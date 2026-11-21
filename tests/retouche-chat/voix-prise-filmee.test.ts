import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { appliquerRetouche, type PortsRetoucheChat } from "@/services/retouche-chat/service";
import {
  CLE_REGLAGE_DEMO_FACECAM,
  GENERATEURS_RETOUCHE,
  GENERATEURS_VOIX_PRISE_FILMEE,
  adaptateurRetouche,
  filtrerOperationsGenerateur,
  portsGenerateur,
  voixEstPriseFilmee,
} from "@/services/retouche-chat/generateurs";

const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;
const REMARQUE = "La voix est votre prise filmée : elle ne se réécrit pas. Pour enlever un passage, demandez de le couper.";
const ops = [
  { type: "modifier-script", ancien: "a", nouveau: "b" },
  { type: "ajuster-zoom", sceneId: "s2", facteur: 1.2 },
] as never[];

describe("voix = prise filmée : modifier-script toujours écarté", () => {
  it("constantes déclarées, liste des générateurs de retouche inchangée", () => {
    expect([...GENERATEURS_VOIX_PRISE_FILMEE]).toEqual(["facecam-animee", "demo-facecam"]);
    expect(voixEstPriseFilmee("demo-facecam")).toBe(true);
    expect(voixEstPriseFilmee("facecam-animee")).toBe(true);
    expect(voixEstPriseFilmee("avocat")).toBe(false);
    expect(voixEstPriseFilmee("image-video")).toBe(false);
    expect(CLE_REGLAGE_DEMO_FACECAM).toBe("retoucheChat.demoFacecam");
    expect([...GENERATEURS_RETOUCHE]).toEqual(["avocat", "image-video", "facecam-animee", "tutoriel-outil", "video-longue", "demo-facecam"]);
  });

  it("facecam animée : écarté avec demande explicite, une seule remarque", () => {
    const r = filtrerOperationsGenerateur("facecam-animee", [...ops, ...ops], "modifie le script : a devient b");
    expect(r.operations.map((o) => o.type)).toEqual(["ajuster-zoom", "ajuster-zoom"]);
    expect(r.remarques).toEqual([REMARQUE]);
  });

  it("facecam animée : écarté sans demande explicite aussi", () => {
    const r = filtrerOperationsGenerateur("facecam-animee", ops, "zoom plus doux");
    expect(r.operations.map((o) => o.type)).toEqual(["ajuster-zoom"]);
    expect(r.remarques).toEqual([REMARQUE]);
  });

  it("avocat et image-vidéo : comportement inchangé", () => {
    for (const g of ["avocat", "image-video"] as const) {
      const avec = filtrerOperationsGenerateur(g, ops, "modifie le script : a devient b");
      expect(avec.operations.map((o) => o.type)).toEqual(["modifier-script", "ajuster-zoom"]);
      expect(avec.remarques).toEqual([]);
      const sans = filtrerOperationsGenerateur(g, ops, "zoom plus doux");
      expect(sans.operations.map((o) => o.type)).toEqual(["ajuster-zoom"]);
      expect(sans.remarques).toEqual(["Le texte lu reste le vôtre : pour le changer, demandez « modifie le script »."]);
    }
  });

  it("consigne facecam : la prise et la voix ne changent jamais, même sur demande", () => {
    expect(adaptateurRetouche("facecam-animee").consigne).toContain("La prise et la voix ne changent jamais, même sur demande.");
    expect(adaptateurRetouche("avocat").consigne).toContain("sauf demande explicite de modifier le script");
  });

  it("de bout en bout : aucune version écrite", async () => {
    const versions: string[] = [];
    const base: PortsRetoucheChat = {
      appeler: async () => {
        throw new Error("pas d'appel réel");
      },
      lireVersionChoisie: async () => ({ versionId: "v1", plan }),
      enregistrerVersion: async () => {
        versions.push("v2");
        return { versionId: "v2" };
      },
      choisirVersion: async () => undefined,
    };
    const p = portsGenerateur("facecam-animee", base);
    const r = await appliquerRetouche("vid", { demande: "modifie le script : a devient b", operations: [{ type: "modifier-script", ancien: plan.mots[0]!.texte, nouveau: "autre" }] }, p);
    expect(r.statut).toBe("inchangee");
    expect(versions).toEqual([]);
  });
});
