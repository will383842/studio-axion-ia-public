/**
 * D4-F3-a-v20j — les vraies dépendances du « lancer gratuit » du chat de la démo face caméra (lecture + estimation seulement).
 * Doubles injectés par vi.mock ; aucun réseau, 0 €.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationMontage } from "@/moteurs/types";

const etat = vi.hoisted(() => ({
  video: null as null | { id: string; versionChoisieId?: string },
  version: null as null | { id: string; commande: { moteurId: string; formatId: string }; projetMontage?: Record<string, unknown> },
  ordre: [] as string[],
  estimerRetouche: null as null | ((...a: unknown[]) => Promise<{ total: { centimes: number; devise: string } }>),
  parent: { versionId: "v1", projetMontage: undefined as Record<string, unknown> | undefined, pistes: [] as unknown[] },
  lancerRetouche: null as null | ((...a: unknown[]) => Promise<unknown>),
}));

vi.mock("@/services/_commun", () => ({
  depots: () => ({
    videos: { obtenir: async () => etat.video },
    versions: { obtenir: async () => etat.version },
  }),
}));
vi.mock("@/services/fabrication", () => ({
  parentDeLaVersion: async () => etat.parent,
  lancerRetouche: (...a: unknown[]) => etat.lancerRetouche!(...a),
}));
vi.mock("@/services/cas-concret-reglages", () => ({ preparerReglagesMoteur: async () => void etat.ordre.push("reglages") }));
vi.mock("@/moteurs", () => ({
  idMoteurDeCommande: (c: { moteurId: string }) => c.moteurId,
  moteurDeCommande: () => ({ estimerRetouche: (...a: unknown[]) => (etat.ordre.push("estimer"), etat.estimerRetouche!(...a)) }),
}));

const { depsLancerDemoStudio } = await import("@/services/retouche-chat/deps-demo-studio");
const { creerMoteurMontageDemoFacecam } = await import("@/moteurs/montage-demo-facecam");

const COMMANDE = { moteurId: "montage-demo-facecam", formatId: "demo-facecam" };
const REPRISE = { mots: [], calage: {}, dureeSec: 1, synchro: {}, plan: { scenes: [] }, sorties: [], signatureConsignes: "x" };
const OPS: OperationMontage[] = [{ type: "planScenes", plan: { scenes: [] } } as unknown as OperationMontage];
const zero = { centimes: 0, devise: "EUR" };

beforeEach(() => {
  etat.video = { id: "vid", versionChoisieId: "v1" };
  etat.version = { id: "v1", commande: COMMANDE, projetMontage: { reprise: REPRISE } };
  etat.ordre = [];
  etat.parent = { versionId: "v1", projetMontage: { reprise: REPRISE }, pistes: [] };
  etat.estimerRetouche = vi.fn(async () => ({ total: zero }));
  etat.lancerRetouche = vi.fn(async () => ({ retoucheId: "r", travailId: "t" }));
});

describe("refus fermé", () => {
  it("a) vidéo ou version absente : reprise() null, estimer() lève", async () => {
    for (const casse of [() => (etat.video = null), () => (etat.version = null), () => (etat.video = { id: "vid" })]) {
      casse();
      const d = depsLancerDemoStudio("vid", "v1");
      expect(await d.reprise()).toBeNull();
      await expect(d.estimer(OPS)).rejects.toThrow();
    }
    expect(etat.estimerRetouche).not.toHaveBeenCalled();
  });

  it("b) la version choisie a changé depuis l'aperçu : null, lève, 0 appel au moteur", async () => {
    const d = depsLancerDemoStudio("vid", "v0");
    expect(await d.reprise()).toBeNull();
    await expect(d.estimer(OPS)).rejects.toThrow();
    expect(etat.estimerRetouche).not.toHaveBeenCalled();
  });

  it("c) moteur autre que la démo : null, lève, 0 appel", async () => {
    etat.version!.commande = { moteurId: "montage-facecam", formatId: "facecam" };
    const d = depsLancerDemoStudio("vid", "v1");
    expect(await d.reprise()).toBeNull();
    await expect(d.estimer(OPS)).rejects.toThrow();
    expect(etat.estimerRetouche).not.toHaveBeenCalled();
  });

  it("d) sans reprise : null ; avec reprise valide : la reprise", async () => {
    etat.parent = { versionId: "v1", projetMontage: {}, pistes: [] };
    expect(await depsLancerDemoStudio("vid", "v1").reprise()).toBeNull();
    etat.parent = { versionId: "v1", projetMontage: { reprise: REPRISE }, pistes: [] };
    expect(await depsLancerDemoStudio("vid", "v1").reprise()).toBe(REPRISE);
  });
});

describe("estimation identique à lancerRetouche", () => {
  it("e) parité avec fabrication.ts:1133 : réglages d'abord, puis estimerRetouche(commande, [], { operations, parent }) UNE fois", async () => {
    await depsLancerDemoStudio("vid", "v1").estimer(OPS);
    expect(etat.ordre).toEqual(["reglages", "estimer"]);
    expect(etat.estimerRetouche).toHaveBeenCalledTimes(1);
    const [commande, ids, ctx] = (etat.estimerRetouche as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, unknown, { operations: unknown; parent: unknown }];
    expect(commande).toBe(etat.version!.commande);
    expect(ids).toEqual([]);
    expect(ctx.operations).toBe(OPS);
    expect(ctx.parent).toBe(etat.parent);
  });

  it("e bis) sans opération : contexte absent, comme lancerRetouche", async () => {
    await depsLancerDemoStudio("vid", "v1").estimer([]);
    expect((etat.estimerRetouche as ReturnType<typeof vi.fn>).mock.calls[0]![2]).toBeUndefined();
  });

  it("f) le total est rendu tel quel", async () => {
    etat.estimerRetouche = vi.fn(async () => ({ total: { centimes: 1, devise: "EUR" } }));
    expect((await depsLancerDemoStudio("vid", "v1").estimer(OPS)).total.centimes).toBe(1);
    etat.estimerRetouche = vi.fn(async () => ({ total: zero }));
    expect((await depsLancerDemoStudio("vid", "v1").estimer(OPS)).total.centimes).toBe(0);
  });

  it("g) avec le VRAI moteur démo : une retouche planScenes coûte 0", async () => {
    const moteur = creerMoteurMontageDemoFacecam();
    etat.estimerRetouche = (...a: unknown[]) => (moteur.estimerRetouche as (...b: unknown[]) => Promise<{ total: { centimes: number; devise: string } }>)(...a);
    expect((await depsLancerDemoStudio("vid", "v1").estimer(OPS)).total.centimes).toBe(0);
  });
});

describe("lancer", () => {
  it("h) délègue à lancerRetouche avec les arguments reçus, sans en ajouter", async () => {
    const r = await depsLancerDemoStudio("vid", "v1").lancer("vid", [], "consigne", { operations: OPS });
    expect(r).toEqual({ retoucheId: "r", travailId: "t" });
    expect(etat.lancerRetouche).toHaveBeenCalledWith("vid", [], "consigne", { operations: OPS });
  });
});

describe("gardes statiques", () => {
  const texte = readFileSync("src/services/retouche-chat/deps-demo-studio.ts", "utf8");
  it("i) server-only, aucun réglage lu, aucune porte d'argent, aucun montant en dur", () => {
    expect(texte).toMatch(/^import "server-only";/m);
    expect(texte).not.toMatch(/lireParametre/);
    expect(texte).not.toMatch(/verifierEtReserver|reserverPourUsine|depenserSelonOrigine|reactiverSelonOrigine|reserverLot\(/);
    expect(texte).not.toMatch(/estimerRetoucheVideo/);
    expect(texte).not.toMatch(/centimes\s*[:=]\s*\d/);
    expect(texte.split("\n").length).toBeLessThanOrEqual(90);
  });
});
