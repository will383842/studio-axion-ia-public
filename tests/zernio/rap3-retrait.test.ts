/** RAP-3 · « Retirer du calendrier » sur une rapatriée : geste LOCAL (pose retireeLe), jamais d'effacement, jamais d'appel au diffuseur. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
const exiger = vi.fn(async () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: exiger, sessionApi: vi.fn(async () => ({})) }));

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { retirerRapatrieeAction } = await import("@/app/(studio)/calendrier/actions/retirer-rapatriee");
const { injecterClientZernio } = await import("@/services/zernio");

const base = { id: "zr_p1_c1", reseau: "instagram", statut: "programmee", via: "zernio", idExterne: "p1", etatEnvoi: "envoye", date: "2026-12-25T08:30:00.000Z", texte: "Texte fictif", creeLe: "2026-11-20T10:00:00.000Z", modifieLe: "2026-11-20T10:00:00.000Z", rapatrieeLe: "2026-11-20T10:00:00.000Z", origineDiffuseur: "import-buffer", mediaDiffuseur: { type: "aucun", nombre: 0 } };
let appels: string[];

beforeEach(() => {
  reinitialiserDepots();
  exiger.mockClear();
  appels = [];
  const faux = creerFauxClientZernio() as unknown as Record<string, unknown>;
  const piege = new Proxy(faux, { get: (c, p) => (typeof c[p as string] === "function" ? () => { appels.push(String(p)); throw new Error("écriture interdite"); } : c[p as string]) });
  injecterClientZernio(piege as never);
});

describe("RAP-3 · retrait local d'une rapatriée", () => {
  it("pose retireeLe, garde la ligne, le texte et le statut ; aucun appel au diffuseur ; session exigée", async () => {
    await depots().publications.enregistrer(base as never);
    const r = await retirerRapatrieeAction("zr_p1_c1");
    expect(r.ok).toBe(true);
    expect(exiger).toHaveBeenCalled();
    const p = await depots().publications.obtenir("zr_p1_c1");
    expect(p).toMatchObject({ statut: "programmee", texte: "Texte fictif", idExterne: "p1" });
    expect(typeof (p as { retireeLe?: string }).retireeLe).toBe("string");
    expect(appels).toEqual([]);
  });
  it("deux gestes : le second dit « déjà retirée », sans nouvelle écriture", async () => {
    await depots().publications.enregistrer(base as never);
    await retirerRapatrieeAction("zr_p1_c1");
    const avant = (await depots().publications.obtenir("zr_p1_c1")) as { retireeLe?: string };
    const r = await retirerRapatrieeAction("zr_p1_c1");
    expect(r.ok).toBe(false);
    expect(((await depots().publications.obtenir("zr_p1_c1")) as { retireeLe?: string }).retireeLe).toBe(avant.retireeLe);
  });
  it("refuse une publication du Studio, une publiée et une inconnue, sans rien écrire", async () => {
    await depots().publications.enregistrer({ ...base, id: "pub_s", rapatrieeLe: undefined, visuelId: "v1" } as never);
    await depots().publications.enregistrer({ ...base, id: "zr_pub", statut: "publiee" } as never);
    for (const id of ["pub_s", "zr_pub", "inconnue"]) expect((await retirerRapatrieeAction(id)).ok).toBe(false);
    expect(((await depots().publications.obtenir("pub_s")) as { retireeLe?: string }).retireeLe).toBeUndefined();
    expect(((await depots().publications.obtenir("zr_pub")) as { retireeLe?: string }).retireeLe).toBeUndefined();
    expect(appels).toEqual([]);
  });
  it("la rapatriée retirée sort du calendrier mais reste en base", async () => {
    await depots().publications.enregistrer(base as never);
    await retirerRapatrieeAction("zr_p1_c1");
    const { listerCalendrier } = await import("@/services/publications");
    const jours = await listerCalendrier("2026-12-01T00:00:00.000Z", "2026-12-31T23:59:59.000Z");
    expect(jours.flatMap((j) => j.publications)).toHaveLength(0);
    expect(await depots().publications.obtenir("zr_p1_c1")).toBeTruthy();
  }, 60_000);
});
