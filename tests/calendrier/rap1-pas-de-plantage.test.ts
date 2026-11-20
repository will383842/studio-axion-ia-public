/** RAP-1 · avec une publication rapatriée en base, les services voisins ne lèvent pas (verrous de non-régression). Données fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { depots, reinitialiserDepots } = await import("@/donnees/memoire");

const rapatriee = { id: "zr_p1_c1", reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-11-25T08:30:00.000Z", texte: "t", idExterne: "p1", rapatrieeLe: "2026-11-20T10:00:00.000Z", origineDiffuseur: "import-buffer", etatEnvoi: "envoye", creeLe: "2026-11-20T10:00:00.000Z", modifieLe: "2026-11-20T10:00:00.000Z" };

beforeEach(async () => {
  reinitialiserDepots();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await depots().publications.enregistrer(rapatriee as never);
});

describe("RAP-1 · pas de plantage", () => {
  it("publicationsDues (mesures automatiques) ne lève pas", async () => {
    const { publicationsDues } = await import("@/services/mesures-automatiques");
    const pubs = await depots().publications.lister();
    expect(() => publicationsDues(pubs, Date.parse("2026-12-02T00:00:00.000Z"))).not.toThrow();
  });
  it("le bilan de la semaine ne lève pas", async () => {
    const { bilanSemaineAccueil } = await import("@/services/bilan-semaine");
    await expect(bilanSemaineAccueil(new Date("2026-11-27T10:00:00.000Z"))).resolves.not.toThrow();
  });
  it("construireFileACorriger ne lève pas", async () => {
    const { construireFileACorriger } = await import("@/services/calendrier-reprogrammation");
    expect(() => construireFileACorriger([rapatriee as never])).not.toThrow();
  });
});
