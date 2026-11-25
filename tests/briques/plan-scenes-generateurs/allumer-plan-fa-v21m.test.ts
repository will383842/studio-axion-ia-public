/**
 * ALLUMER-PLAN-FA-v21m : le plan de scènes de la face caméra animée est ALLUMÉ par défaut (pièces du stock, sans Claude).
 * Chemin réel `outilsFacecamAnimee` avec un lecteur de réglage double ; aucune base, aucun appel Claude, aucune dépense.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = vi.hoisted(() => vi.fn(async (_id: string, defaut: unknown) => defaut as unknown));
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/_commun")>()), lireParametre: lire }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));

import { outilsFacecamAnimee } from "@/services/facecam-animee";
import { CLES_REGLAGE_PLAN_SCENES } from "@/briques/plan-scenes-generateurs/reglage";
import { intervallesV4, retirerPiecesSousV4 } from "@/briques/plan-scenes-generateurs/filtre-v4";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { PlanValide, SceneValide } from "@/briques/plan-scenes/schema";

const outils = () => outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);

describe("ALLUMER-PLAN-FA-v21m", () => {
  it("sans réglage posé (la lecture rend le défaut) : planScenes vaut {} (allumé), sans aucun appel Claude", async () => {
    lire.mockImplementation(async (_id, defaut) => defaut);
    const o = await outils();
    expect(o.planScenes).toEqual({});
    expect(lire.mock.calls.some(([id]) => id === CLES_REGLAGE_PLAN_SCENES["facecam-animee"])).toBe(true);
    expect((o.planScenes as { appeler?: unknown }).appeler).toBeUndefined();
  });

  it("false écrit en base (coupe-circuit) : planScenes absent (éteint)", async () => {
    lire.mockImplementation(async (id, defaut) => (id === "planScenes.facecamAnimee" ? false : defaut));
    const o = await outils();
    expect(o.planScenes ?? null).toBeNull();
  });

  it("lecture en échec : allumé (le défaut)", async () => {
    lire.mockImplementation(async (id, defaut) => { if (id === "planScenes.facecamAnimee") throw new Error("base indisponible"); return defaut; });
    expect((await outils()).planScenes).toEqual({});
  });

  it("filtre : aucune scène pendant une plaquette v4", () => {
    const plan = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
    const iv = intervallesV4(plan);
    expect(iv.length).toBeGreaterThan(0);
    const sc = (id: string, d: number, f: number) => ({ id, debutMs: d, finMs: f, empreinte: `e-${id}` }) as unknown as SceneValide;
    const brut = { version: "x", facecam: true, dureeMs: 60_000, scenes: [sc("sous", iv[0].debutMs + 100, iv[0].debutMs + 600), sc("loin", 500_000, 501_000)] } as unknown as PlanValide;
    expect(retirerPiecesSousV4(brut, iv).scenes.map((s) => s.id)).toEqual(["loin"]);
  });
});
