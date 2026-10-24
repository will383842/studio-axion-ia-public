import { describe, expect, it, vi } from "vitest";
import { CODES_ATTENTE_VALIDATION } from "@/domaine/sujets-traites";

// Dépôts simulés : lireStockCas lit les vidéos du format, puis les travaux des vidéos en échec (chemin marquerAttentes -> videoCompte).
const etat = vi.hoisted(() => ({ videos: [] as unknown[], travaux: [] as unknown[] }));
vi.mock("./_commun", () => ({
  depots: () => ({
    videos: { lister: async (filtre: (v: never) => boolean) => etat.videos.filter((v) => filtre(v as never)) },
    travaux: { lister: async (filtre: (t: never) => boolean, projeter?: (t: never) => unknown) => etat.travaux.filter((t) => filtre(t as never)).map((t) => (projeter ? projeter(t as never) : t)) },
  }),
}));
vi.mock("./auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
vi.mock("./cas-concret-retires", () => ({ lireCasRetires: vi.fn(async () => new Set<string>()) }));
vi.mock("./cas-concret-traites", () => ({ lireCasTraites: vi.fn(async () => new Map()) }));
vi.mock("./cas-concret-scripts-lot", () => ({ scriptsValidesDe: vi.fn(async () => ({})) }));

import { CATALOGUE, estCasStock } from "@/formats/cas-concret/catalogue";
import { lireStockCas } from "./cas-concret-stock-lecture";

const [casA, casB] = CATALOGUE.filter((c) => !estCasStock(c.id)).map((c) => c.id) as [string, string];
const video = (id: string, casId: string, extra: Record<string, unknown> = {}) => ({ id, formatId: "cas-concret", statut: "echec", modifieLe: "2026-10-10T00:00:00Z", entrees: { casConcret: { casId } }, ...extra });

describe("lireStockCas : pause « à valider »", () => {
  it("un échec dont le dernier travail attend Will compte ; un autre échec non", async () => {
    etat.videos = [video("va", casA), video("vb", casB)];
    etat.travaux = [
      { id: "ta", cibleId: "va", type: "fabrication", statut: "echec", creeLe: "2026-10-19T08:00:00.000Z", erreur: { code: CODES_ATTENTE_VALIDATION[0] }, etapes: [] },
      { id: "tb", cibleId: "vb", type: "fabrication", statut: "echec", creeLe: "2026-10-19T08:00:00.000Z", erreur: { code: "IV_VOIX" }, etapes: [] },
    ];
    const lignes = await lireStockCas();
    expect(lignes.find((l) => l.casId === casA)!.videos.comptees).toBe(1);
    expect(lignes.find((l) => l.casId === casB)!.videos.comptees).toBe(0);
  });
});

describe("lireStockCas : cas retirés", () => {
  it("un cas retiré n'est ni compté ni listé (paramètre donné par la page, ou lu ici)", async () => {
    etat.videos = [];
    etat.travaux = [];
    const tous = await lireStockCas();
    expect(tous.some((l) => l.casId === casA)).toBe(true);
    const sans = await lireStockCas(undefined, false, false, undefined, undefined, new Set([casA]));
    expect(sans.some((l) => l.casId === casA)).toBe(false);
    expect(sans.length).toBe(tous.length - 1);
    expect(sans.some((l) => l.casId === casB)).toBe(true);
    const { lireCasRetires } = await import("./cas-concret-retires");
    vi.mocked(lireCasRetires).mockResolvedValueOnce(new Set([casB]));
    expect((await lireStockCas()).some((l) => l.casId === casB)).toBe(false);
  });
});
