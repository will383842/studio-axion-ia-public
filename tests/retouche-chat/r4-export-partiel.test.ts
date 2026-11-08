import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { empreinteExport, exportsARefaire, type CibleExport } from "@/briques/export-partiel";
import { appliquerRetouche, type PortsRetoucheChat } from "@/services/retouche-chat/service";
import { CIBLES_DEMO_FACECAM, CIBLES_TUTORIEL, creerRendreScenes, ciblesDuFormat } from "@/services/retouche-chat/rendu-generateurs";
import { AIDE_CHAT, AideChat } from "@/components/retouche-chat/AideChat";
import { schemaOperation } from "@/services/retouche-chat/schema";

const plan0 = (): PlanValide => validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const cibles: CibleExport[] = [
  { id: "4:5", format: "4:5" },
  { id: "court", format: "9:16", scenes: ["s1", "s3"] },
];

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch interdit dans les tests");
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("empreintes d'export", () => {
  it("stable à l'identique ; change avec la voix, pas avec une scène hors de la version", () => {
    const p = plan0();
    expect(empreinteExport(p, cibles[1]!)).toBe(empreinteExport(p, cibles[1]!));
    const autre = { ...p, scenes: p.scenes.map((s) => (s.id === "s2" ? { ...s, empreinte: "0000000000000000" } : s)) };
    expect(empreinteExport(autre, cibles[1]!)).toBe(empreinteExport(p, cibles[1]!));
    expect(empreinteExport(autre, cibles[0]!)).not.toBe(empreinteExport(p, cibles[0]!));
    expect(empreinteExport(p, cibles[0]!, "voix-2")).not.toBe(empreinteExport(p, cibles[0]!));
  });

  it("ne refait que les exports touchés, dit lesquels restent", () => {
    const p = plan0();
    const nouveau = { ...p, scenes: p.scenes.map((s) => (s.id === "s2" ? { ...s, empreinte: "1111111111111111" } : s)) };
    const r = exportsARefaire(p, nouveau, cibles);
    expect(r.aRefaire).toEqual(["4:5"]);
    expect(r.gardes).toEqual(["court"]);
    expect(r.phrase).toBe("1 format sur 2 sera refait, les autres restent tels quels.");
    expect(exportsARefaire(p, p, cibles).aRefaire).toEqual([]);
    expect(exportsARefaire(p, p, cibles, { voix: "autre" }).aRefaire).toEqual(["4:5", "court"]);
  });
});

describe("branchement Tutoriel d'outil et Démo facecam", () => {
  it("cibles : tutoriel 4:5, 9:16, 1:1 ; démo facecam 9:16 ; autre format : aucune", () => {
    expect(CIBLES_TUTORIEL.map((c) => c.format)).toEqual(["4:5", "9:16", "1:1"]);
    expect(CIBLES_DEMO_FACECAM.map((c) => c.format)).toEqual(["9:16"]);
    expect(ciblesDuFormat("tutoriel-outil")).toBe(CIBLES_TUTORIEL);
    expect(ciblesDuFormat("demo-facecam")).toBe(CIBLES_DEMO_FACECAM);
    expect(ciblesDuFormat("avocat")).toBeNull();
  });

  it("un zoom sur s2 : seule s2 re-rendue, seuls les exports touchés ré-exportés (doubles)", async () => {
    const parent = plan0();
    const rendreScene = vi.fn(async () => ({ fichierCle: "r.mp4", dureeSec: 15 }));
    const exporter = vi.fn(async (e: { cible: CibleExport }) => `export-${e.cible.id}.mp4`);
    const rendreScenes = creerRendreScenes(cibles, { lirePlan: async () => parent, rendreScene, exporter });
    const ports: PortsRetoucheChat = {
      appeler: async () => {
        throw new Error("pas d'appel");
      },
      lireVersionChoisie: async () => ({ versionId: "v1", plan: parent }),
      rendreScenes,
      enregistrerVersion: async () => ({ versionId: "v2" }),
      choisirVersion: async () => undefined,
    };
    const r = await appliquerRetouche("vid", { demande: "zoom", operations: [{ type: "ajuster-zoom", sceneId: "s2", facteur: 1.2 }] }, ports);
    expect(r.statut).toBe("rendue");
    expect(rendreScene).toHaveBeenCalledWith(expect.objectContaining({ scenes: ["s2"], voix: false }));
    expect(exporter).toHaveBeenCalledTimes(1);
    expect(exporter.mock.calls[0]![0].cible.id).toBe("4:5");
  });

  it("légendes et dynamisme passent par la liste fermée des retouches", () => {
    expect(schemaOperation.safeParse({ type: "ajouter-dynamisme", intensite: "fort" }).success).toBe(true);
    expect(schemaOperation.safeParse({ type: "ajouter-piece", sceneId: "s1", piece: "legende", parametres: { texte: "Un clic" } }).success).toBe(true);
  });
});

describe("aide du chat", () => {
  it("chaque retouche de la liste fermée a sa phrase simple, sans prix", () => {
    const types = schemaOperation.options.map((o) => o.shape.type.value);
    const couverts = new Set(AIDE_CHAT.flatMap((a) => a.types));
    for (const t of types) expect(couverts.has(t), t).toBe(true);
    const html = renderToStaticMarkup(createElement(AideChat));
    expect(html).toContain("Ce que le chat peut faire");
    expect(html).not.toMatch(/€|prix|bg-surface[^-]/i);
  });
});
