/**
 * CAL-13c : la grille ordinateur (semaine) passe par le même calcul d'état que le téléphone.
 * Un envoi Buffer refusé, à vérifier ou en cours ne s'affiche plus « Programmé ». Tests de rendu de la page.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { etatAffiche } from "@/components/calendrier/apercu-reseau";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
const listerCalendrier = vi.fn(async () => [] as unknown[]);
vi.mock("@/services/publications", () => ({ listerCalendrier: () => listerCalendrier(), listerAProgrammer: async () => [] }));

const { monter } = await import("../aides/crochets-factices");
const { cleJour } = await import("@/lib/dates");

async function pageAvec(pubs: Record<string, unknown>[], params: Record<string, string> = {}): Promise<string> {
  monter(() => null, {}).rendre();
  listerCalendrier.mockResolvedValueOnce([
    { jour: cleJour(new Date()), publications: pubs.map((p, i) => ({ id: `p${i}`, statut: "programmee", via: "manuel", date: new Date().toISOString(), texte: "Un texte", reseauNom: "Réseau", video: null, ...p })) },
  ]);
  const { default: Page } = await import("../../src/app/(studio)/calendrier/page");
  return renderToStaticMarkup((await Page({ searchParams: Promise.resolve(params) })) as ReactElement);
}
/** Seulement la grille ordinateur (dernier bloc « hidden min-[861px]:block »). */
const grille = (h: string) => h.slice(h.lastIndexOf("hidden min-[861px]:block"));

describe("CAL-13c — état affiché partagé", () => {
  const base = { id: "a", reseau: "linkedin", statut: "programmee", date: "2026-11-20T09:00:00Z", texte: "t", via: "buffer" };
  it("calcule le même état pour chaque cas d'envoi", () => {
    expect(etatAffiche({ ...base, etatEnvoi: "refuse" })).toBe("a_corriger");
    expect(etatAffiche({ ...base, etatEnvoi: "absent" })).toBe("a_corriger");
    expect(etatAffiche({ ...base, statut: "echec" })).toBe("a_corriger");
    expect(etatAffiche({ ...base, etatEnvoi: "a-verifier" })).toBe("a_verifier");
    expect(etatAffiche({ ...base, etatEnvoi: "en-cours" })).toBe("en_cours");
    expect(etatAffiche({ ...base, statut: "brouillon" })).toBe("brouillon_buffer");
    expect(etatAffiche({ ...base, via: "simulation", etatEnvoi: "refuse" })).toBe("essai");
  });
});

describe("CAL-13c — la grille ordinateur ne ment plus", () => {
  beforeEach(() => listerCalendrier.mockReset());

  it("semaine : un envoi refusé est « À corriger », pas « Programmé »", async () => {
    const g = grille(await pageAvec([{ reseau: "linkedin", via: "buffer", etatEnvoi: "refuse" }]));
    expect(g).toContain('data-etat="a_corriger"');
    expect(g).toContain("À corriger");
    expect(g).not.toContain("Programmé");
  });
  it("semaine : « À vérifier » et « Envoi en cours » avec leurs mots", async () => {
    const g = grille(await pageAvec([{ reseau: "linkedin", via: "buffer", etatEnvoi: "a-verifier" }, { reseau: "facebook", via: "buffer", etatEnvoi: "en-cours" }]));
    expect(g).toContain("À vérifier");
    expect(g).toContain("Envoi en cours");
    expect(g).not.toContain("Programmé");
  });
  it("semaine : un envoi normal reste « Programmé » et un essai reste « Essai »", async () => {
    const g = grille(await pageAvec([{ reseau: "linkedin" }, { reseau: "facebook", via: "simulation" }]));
    expect(g).toContain("Programmé");
    expect(g).toContain("Essai");
  });
});
