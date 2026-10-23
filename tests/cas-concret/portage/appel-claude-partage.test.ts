/**
 * Portage phase 2 · P1 : le chemin de dépense Claude du cas concret est UN seul bloc, `ecritureClaudeCasConcret`, que
 * la fabrication appelle et que la porte B et les retouches appelleront. Il garde tel quel le comportement de master :
 * simulation = 0 appel payant ; Claude actif = pré-vol du budget avant chaque appel (crédit ou budget refusé = aucun
 * appel) ; socle de Will lu seulement quand Claude écrit vraiment. Doubles partout, `fetch` interdit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const b = await import("@/services/cas-concret-branchements");
const { roleEcritureCasConcret, ETAPE_ECRITURE, ETAPE_REFORMULATION } = await import("@/moteurs/montage-cas-concret/ecriture");

import type { EntreeRole } from "@/generateur/roles/types";

const ENTREE = { variable: "<cas-id>x</cas-id>" } as unknown as EntreeRole;
const DEMANDE = { etape: "Cas concret · écriture", coutEstimeUsd: 0.5 } as never;
const etape = (role: { id: string }) => (role.id === roleEcritureCasConcret.id ? ETAPE_ECRITURE : ETAPE_REFORMULATION);

let fetchEspion: ReturnType<typeof vi.fn>;
beforeEach(() => {
  reinitialiserDepots();
  fetchEspion = vi.fn(() => {
    throw new Error("fetch interdit");
  });
  vi.stubGlobal("fetch", fetchEspion);
});
// Vérifié APRÈS chaque test (l'espion est recréé avant chacun) : aucun test de ce fichier n'a fait d'appel réseau.
afterEach(() => {
  expect(fetchEspion).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("P1 · ecritureClaudeCasConcret", () => {
  it("existe et rend les outils d'écriture (appeler, budget, detache)", async () => {
    expect(typeof b.ecritureClaudeCasConcret).toBe("function");
    const o = await b.ecritureClaudeCasConcret("v1", etape, { claudeActif: async () => false, executer: async () => ({ ok: true, simule: true, texte: "" }) });
    expect(typeof o.appeler).toBe("function");
    expect(typeof o.budget.reserver).toBe("function");
    expect(o.detache).toBeDefined();
  });

  it("l'appel passe par `executer` de la vidéo, avec l'étape du rôle et le plafond propre du format", async () => {
    const executer = vi.fn(async () => ({ ok: true as const, simule: false, donnees: { a: 1 }, coutUsd: 0.1 }));
    const o = await b.ecritureClaudeCasConcret("v42", etape, { claudeActif: async () => true, executer, verifierBudget: async () => undefined, socle: async () => undefined });
    const r = await o.appeler(roleEcritureCasConcret, ENTREE);
    expect(r).toMatchObject({ ok: true, donnees: { a: 1 }, coutUsd: 0.1 });
    expect(executer).toHaveBeenCalledTimes(1);
    const [videoId, role, entree, options] = executer.mock.calls[0] as unknown as [string, { id: string }, EntreeRole, { etape: string; plafondPropre: { id: string } }];
    expect([videoId, role.id, entree]).toEqual(["v42", roleEcritureCasConcret.id, ENTREE]);
    expect(options.etape).toBe(ETAPE_ECRITURE);
    expect(options.plafondPropre.id).toBe("ccecr");
  });

  it("simulation : réserver accepte sans toucher au budget (0 $)", async () => {
    const verifierBudget = vi.fn();
    const o = await b.ecritureClaudeCasConcret("v1", etape, { claudeActif: async () => false, verifierBudget });
    expect(await o.budget.reserver(DEMANDE)).toEqual({ ok: true });
    expect(verifierBudget).not.toHaveBeenCalled();
  });

  it("Claude actif : pré-vol du budget ; crédit ou budget refusé = phrase fixe, autre erreur remontée", async () => {
    const avec = (code: string) => b.ecritureClaudeCasConcret("v1", etape, { claudeActif: async () => true, verifierBudget: async () => { throw Object.assign(new Error("brut secret"), { code }); } });
    expect(await (await avec("CREDIT_INSUFFISANT")).budget.reserver(DEMANDE)).toEqual({ ok: false, message: "Crédit Claude insuffisant." });
    expect(await (await avec("BUDGET_DEPASSE")).budget.reserver(DEMANDE)).toEqual({ ok: false, message: "Budget du mois atteint." });
    await expect((await avec("AUTRE")).budget.reserver(DEMANDE)).rejects.toThrow("brut secret");
    const verifierBudget = vi.fn(async () => undefined);
    const ok = await b.ecritureClaudeCasConcret("v1", etape, { claudeActif: async () => true, verifierBudget });
    expect(await ok.budget.reserver(DEMANDE)).toEqual({ ok: true });
    expect(verifierBudget).toHaveBeenCalledTimes(1);
  });

  it("le socle de Will : donné ou injecté seulement quand Claude écrit vraiment, jamais en simulation", async () => {
    const socle = async () => undefined;
    expect((await b.ecritureClaudeCasConcret("v1", etape, { claudeActif: async () => false })).socle).toBeUndefined();
    expect((await b.ecritureClaudeCasConcret("v1", etape, { claudeActif: async () => true })).socle).toBeTypeOf("function");
    expect((await b.ecritureClaudeCasConcret("v1", etape, { claudeActif: async () => false, socle })).socle).toBe(socle);
  });
});
