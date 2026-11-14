/**
 * CAL-13c, corrections : la vue Jour dit l'état réel de l'envoi, le panneau « À faire » garde les brouillons Buffer,
 * et la fiche dit une phrase juste pour chaque état d'envoi. Tests de rendu.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { phraseEtat } from "@/components/calendrier/FicheEntree";

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

describe("CAL-13c corrections — vue Jour", () => {
  beforeEach(() => listerCalendrier.mockReset());
  it("un envoi en cours dit « Envoi en cours », pas « État à vérifier »", async () => {
    const h = await pageAvec([{ reseau: "linkedin", via: "buffer", etatEnvoi: "en-cours" }], { vue: "jour" });
    expect(h).toContain("Envoi en cours");
    expect(h).not.toContain("État à vérifier");
  });
  it("un brouillon Buffer dit « Brouillon dans Buffer »", async () => {
    const h = await pageAvec([{ reseau: "linkedin", via: "buffer", statut: "brouillon" }], { vue: "jour" });
    expect(h).toContain("Brouillon dans Buffer");
    expect(h).not.toContain("État à vérifier");
  });
});

describe("CAL-13c corrections — panneau « À faire »", () => {
  beforeEach(() => listerCalendrier.mockReset());
  it("un brouillon Buffer apparaît dans « Brouillons à compléter »", async () => {
    const h = await pageAvec([{ reseau: "linkedin", via: "buffer", statut: "brouillon" }]);
    expect(h).toContain("Brouillons à compléter");
  });
});

describe("CAL-13c corrections — phrases d'état de la fiche", () => {
  const e = { jour: "2026-11-20" };
  it("en cours : un envoi est en cours", () => {
    expect(phraseEtat({ ...e, etat: "en_cours" })).toMatch(/envoi est en cours/);
  });
  it("brouillon Buffer : phrase propre, sans « État à vérifier »", () => {
    const t = phraseEtat({ ...e, etat: "brouillon_buffer" });
    expect(t).toContain("Brouillon déposé dans Buffer");
    expect(t).not.toContain("rien ne part d'ici");
  });
  it("à corriger : refusé par le réseau seulement si Buffer a répondu", () => {
    expect(phraseEtat({ ...e, etat: "a_corriger" })).toContain("Le réseau l'a refusée");
    const absent = phraseEtat({ ...e, etat: "a_corriger", envoiAbsent: true });
    expect(absent).not.toContain("refusée");
    expect(absent).toContain("Buffer");
  });
});
