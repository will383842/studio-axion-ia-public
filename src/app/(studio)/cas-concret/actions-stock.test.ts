import { beforeEach, describe, expect, it, vi } from "vitest";

// Les points d'entrée par identifiant des scripts validés passent par la porte du stock AVANT d'appeler le service.
const m = vi.hoisted(() => ({ autorise: vi.fn(), controler: vi.fn(async () => []), modifier: vi.fn(async () => ({ casId: "x", numero: 2, empreinte: "e", modifie: true })) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/services/cas-concret-stock-acces", () => ({ trouverCasAutorise: m.autorise }));
vi.mock("@/services/cas-concret-scripts", () => ({
  controlerScriptValideCasConcret: m.controler,
  modifierScriptValideCasConcret: m.modifier,
  controlerScriptAValiderCasConcret: vi.fn(),
  validerScriptCasConcret: vi.fn(),
}));
vi.mock("@/services/cas-concret", () => ({ confirmerCas: vi.fn(), estimerCas: vi.fn(), preparerEtLancer: vi.fn() }));
vi.mock("@/services/cas-concret-voix", () => ({ avecConsigneVoix: (x: unknown) => x }));
vi.mock("@/services/cas-concret-porte-b", () => ({ confirmerFaitPorteB: vi.fn(), demarrerPorteB: vi.fn(), suivrePorteB: vi.fn() }));
vi.mock("@/components/formats/cas-concret/entree/vue", () => ({ versVueCasPorteB: vi.fn() }));

import { controlerScriptValideAction, modifierScriptValideAction } from "./actions";

beforeEach(() => {
  m.autorise.mockReset();
  m.controler.mockClear();
  m.modifier.mockClear();
});

describe("actions serveur : scripts validés d'un cas du stock", () => {
  it("cas du stock, réglage éteint : refus propre, le service n'est pas appelé", async () => {
    m.autorise.mockResolvedValue(undefined);
    const c = await controlerScriptValideAction("stock-x", []);
    const e = await modifierScriptValideAction("stock-x", []);
    for (const r of [c, e]) expect(r).toMatchObject({ ok: false, message: "Ce cas n'est pas disponible." });
    expect(m.controler).not.toHaveBeenCalled();
    expect(m.modifier).not.toHaveBeenCalled();
  });

  it("cas autorisé : comportement inchangé", async () => {
    m.autorise.mockResolvedValue({ id: "ancien" });
    expect((await controlerScriptValideAction("ancien", [])).ok).toBe(true);
    expect((await modifierScriptValideAction("ancien", [])).ok).toBe(true);
    expect(m.controler).toHaveBeenCalledTimes(1);
    expect(m.modifier).toHaveBeenCalledTimes(1);
  });
});
