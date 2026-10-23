/** FACE CAMÉRA ANIMÉE — le VRAI coût déjà payé d'une vidéo (dépenses enregistrées), affiché pendant et après la fabrication. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fa = await import("@/services/facecam-animee");

const MDP = "essai-cout-reel-fa";
const ligne = (fournisseur: string, centimes: number) => ({ etape: "Face caméra animée · mise en scène", fournisseur, unite: "appel", quantite: 1, prixUnitaire: { centimes, devise: "EUR" as const }, total: { centimes, devise: "EUR" as const }, nature: "reel" as const });
const depense = (id: string, videoId: string, lignes: ReturnType<typeof ligne>[], extra: object = {}) =>
  ({ id, videoId, lignes, total: { centimes: lignes.reduce((t, l) => t + l.total.centimes, 0), devise: "EUR" as const }, date: "2026-10-17T10:00:00.000Z", creeLe: "2026-10-17T10:00:00.000Z", modifieLe: "2026-10-17T10:00:00.000Z", ...extra }) as never;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("Coût réel d'une vidéo face caméra animée", () => {
  it("additionne ce qui a été payé pour cette vidéo seulement, sans les montants simulés ni les dépenses d'exemple", async () => {
    const d = depots();
    await d.depenses.enregistrer(depense("d1", "v1", [ligne("anthropic", 138)]));
    await d.depenses.enregistrer(depense("d2", "v1", [ligne("anthropic", 62), ligne("simulation", 900)]));
    await d.depenses.enregistrer(depense("d3", "v2", [ligne("anthropic", 500)]));
    await d.depenses.enregistrer(depense("d4", "v1", [ligne("anthropic", 700)], { estDemo: true }));
    expect(await fa.coutReelVideoFA("v1")).toBe(200);
    expect(await fa.coutReelVideoFA("v2")).toBe(500);
    expect(await fa.coutReelVideoFA("v-sans-depense")).toBe(0);
  });
});
