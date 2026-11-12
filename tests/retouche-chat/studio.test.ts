import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";

const etat = vi.hoisted(() => ({ versions: new Map<string, Record<string, unknown>>(), videos: new Map<string, Record<string, unknown>>(), choix: [] as string[] }));
vi.mock("@/services/_commun", () => ({
  horodatage: () => ({ creeLe: "2026-11-08T00:00:00.000Z", modifieLe: "2026-11-08T00:00:00.000Z" }),
  depots: () => ({
    videos: { obtenir: async (id: string) => etat.videos.get(id) ?? null },
    versions: {
      obtenir: async (id: string) => etat.versions.get(id) ?? null,
      enregistrer: async (v: Record<string, unknown>) => void etat.versions.set(v.id as string, v),
    },
  }),
}));
vi.mock("@/services/videos", () => ({ choisirVersion: async (_v: string, id: string) => void etat.choix.push(id) }));
vi.mock("@/services/fabrication", () => ({ prochainNumero: async () => 2 }));

import { appelNonBranche, planDuProjet, portsStudio } from "@/services/retouche-chat/studio";
import { apercevoirRetouche, appliquerRetouche } from "@/services/retouche-chat/service";
import { ChatRetouche } from "@/components/retouche-chat/ChatRetouche";

describe("ports du studio (dépôts simulés)", () => {
  it("plan lu dans le projet de montage (retouche, tutoriel) ; absent : null", () => {
    expect(planDuProjet({ tutoriel: { plan: { plan: PLAN_DEMO } } })!.scenes).toHaveLength(3);
    expect(planDuProjet({ retoucheChat: { plan: PLAN_DEMO } })!.scenes[0]!.empreinte).toMatch(/^[0-9a-f]{16}$/);
    expect(planDuProjet({})).toBeNull();
  });

  it("LLM non branché : lecture simple, aucun appel ; rendu non branché : plan prêt sans version", async () => {
    etat.videos.set("vid", { id: "vid", versionChoisieId: "v1" });
    etat.versions.set("v1", { id: "v1", videoId: "vid", numero: 1, commande: {}, projetMontage: { tutoriel: { plan: { plan: PLAN_DEMO } } } });
    await expect(appelNonBranche({} as never)).rejects.toThrow();
    const a = await apercevoirRetouche("vid", "ajoute du dynamisme", portsStudio());
    expect(a.impact.phrase).toBe("3 scènes sur 3 seront refaites, la voix ne change pas.");
    const r = await appliquerRetouche("vid", { demande: "ajoute du dynamisme", operations: a.operations }, portsStudio());
    expect(r.statut).toBe("plan-pret");
    expect(etat.versions.size).toBe(1);
  });

  it("rendu branché : nouvelle version (parent, numéro suivant, plan retouché) puis choisie", async () => {
    const rendreScenes = vi.fn(async () => ({ fichierCle: "r.mp4", dureeSec: 15 }));
    const r = await appliquerRetouche("vid", { demande: "zoom", operations: [{ type: "ajuster-zoom", sceneId: "s2", facteur: 1.1 }] }, portsStudio({ rendreScenes }));
    expect(r.statut).toBe("rendue");
    const id = r.statut === "rendue" ? r.versionId : "";
    const v = etat.versions.get(id)!;
    expect(v).toMatchObject({ parentVersionId: "v1", numero: 2, statut: "prete", noteRetouche: "zoom" });
    expect((v.projetMontage as { retoucheChat: { scenesRefaites: string[] } }).retoucheChat.scenesRefaites).toEqual(["s2"]);
    expect(etat.choix).toEqual([id]);
    expect(rendreScenes).toHaveBeenCalledWith(expect.objectContaining({ scenes: ["s2"], voix: false }));
  });
});

describe("composant de chat", () => {
  it("se rend sans prix, avec la zone de saisie", () => {
    const html = renderToStaticMarkup(createElement(ChatRetouche, { videoId: "vid" }));
    expect(html).toContain("Que voulez-vous changer ?");
    expect(html).not.toMatch(/€|prix/i);
  });
});
