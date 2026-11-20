/** RAP-3 finitions · rapatriées introuvables chez le diffuseur (« à vérifier ») : comptage et retrait groupé LOCAL. Données fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
const exiger = vi.fn(async () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: exiger, sessionApi: vi.fn(async () => ({})) }));

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { retirerIntrouvablesAction } = await import("@/app/(studio)/calendrier/actions/retirer-introuvables");
const { lireEcartCalendrier } = await import("@/services/ecart-calendrier");
const { injecterClientZernio } = await import("@/services/zernio");

const base = { reseau: "instagram", statut: "programmee", via: "zernio", etatEnvoi: "envoye", date: "2026-12-25T08:30:00.000Z", texte: "Texte fictif", creeLe: "2026-11-20T10:00:00.000Z", modifieLe: "2026-11-20T10:00:00.000Z", rapatrieeLe: "2026-11-20T10:00:00.000Z", origineDiffuseur: "import-buffer", mediaDiffuseur: { type: "aucun", nombre: 0 } };
const pub = (id: string, o: object = {}) => depots().publications.enregistrer({ ...base, id, idExterne: id, ...o } as never);
let appels: string[];

beforeEach(async () => {
  reinitialiserDepots();
  exiger.mockClear();
  appels = [];
  const faux = creerFauxClientZernio() as unknown as Record<string, unknown>;
  injecterClientZernio(new Proxy(faux, { get: (c, p) => (typeof c[p as string] === "function" ? () => { appels.push(String(p)); throw new Error("appel interdit"); } : c[p as string]) }) as never);
  await pub("zr_a", { etatEnvoi: "a-verifier" });
  await pub("zr_b", { etatEnvoi: "a-verifier", statut: "brouillon" });
  await pub("zr_ok", { etatEnvoi: "envoye" });
  await pub("zr_deja", { etatEnvoi: "a-verifier", retireeLe: "2026-11-20T11:00:00.000Z" });
  await pub("pub_studio", { etatEnvoi: "a-verifier", via: "zernio", rapatrieeLe: undefined, visuelId: "v1" });
  await pub("zr_publiee", { etatEnvoi: "a-verifier", statut: "publiee" });
});

describe("RAP-3 finitions · introuvables", () => {
  it("le comptage ne retient que les rapatriées « à vérifier », non retirées, non publiées", async () => {
    const e = await lireEcartCalendrier();
    expect((e as { introuvables?: number } | null)?.introuvables).toBe(2);
  });
  it("retrait groupé : pose retireeLe sur ces seules rapatriées, n'efface rien, aucun appel au diffuseur, session exigée", async () => {
    const avant = (await depots().publications.lister(() => true)).length;
    const r = await retirerIntrouvablesAction();
    expect(r.ok).toBe(true);
    expect(exiger).toHaveBeenCalled();
    expect(appels).toEqual([]);
    const toutes = await depots().publications.lister(() => true);
    expect(toutes).toHaveLength(avant);
    const retirees = toutes.filter((p) => p.retireeLe).map((p) => p.id).sort();
    expect(retirees).toEqual(["zr_a", "zr_b", "zr_deja"]);
    expect(toutes.find((p) => p.id === "zr_a")).toMatchObject({ statut: "programmee", texte: "Texte fictif", etatEnvoi: "a-verifier" });
    expect(toutes.find((p) => p.id === "zr_deja")?.retireeLe).toBe("2026-11-20T11:00:00.000Z"); // inchangée
    expect(((await lireEcartCalendrier()) as { introuvables?: number } | null)?.introuvables ?? 0).toBe(0);
  });
  it("sans session : refus, rien n'est écrit", async () => {
    exiger.mockRejectedValueOnce(new Error("NON_CONNECTE"));
    await expect(retirerIntrouvablesAction()).rejects.toThrow();
    expect((await depots().publications.lister((p) => !!p.retireeLe)).map((p) => p.id)).toEqual(["zr_deja"]);
  });
  it("rien à retirer : refus clair, rien d'écrit", async () => {
    await retirerIntrouvablesAction();
    const r = await retirerIntrouvablesAction();
    expect(r.ok).toBe(false);
  });
});
