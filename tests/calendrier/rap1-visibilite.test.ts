/** RAP-1 · une publication rapatriée apparaît au calendrier ; rien d'autre n'est élargi. Dépôts en mémoire, données fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { estRapatriee } from "@/domaine/types";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { listerCalendrier } = await import("@/services/publications");
const { listerEntrees } = await import("@/services/calendrier");

const ids = (jours: { publications: { id: string }[] }[]): string[] => jours.flatMap((j) => j.publications.map((x) => x.id)).filter((i) => i === "zr_p1_c1" || i === "x");
const base = { reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-11-25T08:30:00.000Z", texte: "Texte fictif", creeLe: "2026-11-20T10:00:00.000Z", modifieLe: "2026-11-20T10:00:00.000Z" };
const rapatriee = { ...base, id: "zr_p1_c1", idExterne: "p1", rapatrieeLe: "2026-11-20T10:00:00.000Z", origineDiffuseur: "import-buffer" };

beforeEach(() => {
  reinitialiserDepots();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("RAP-1 · visibilité au calendrier", () => {
  it("estRapatriee : via zernio + rapatrieeLe + ni vidéo ni visuel", () => {
    expect(estRapatriee(rapatriee as never)).toBe(true);
    expect(estRapatriee({ ...rapatriee, videoId: "v" } as never)).toBe(false);
    expect(estRapatriee({ ...rapatriee, rapatrieeLe: undefined } as never)).toBe(false);
    expect(estRapatriee({ ...rapatriee, via: "buffer" } as never)).toBe(false);
  });

  it("apparaît dans listerCalendrier et dans listerEntrees", async () => {
    await depots().publications.enregistrer(rapatriee as never);
    const jours = await listerCalendrier("2026-11-20T00:00:00.000Z", "2026-11-30T23:59:59.000Z");
    expect(ids(jours)).toEqual(["zr_p1_c1"]);
    const d = depots();
    const entrees = await listerEntrees({ publications: d.publications, creneaux: d.creneauxEditoriaux, videos: d.videos, visuels: d.visuels } as never, "2026-11-20", "2026-11-30");
    const mienne = entrees.filter((e) => e.cle === "publication:zr_p1_c1");
    expect(mienne).toHaveLength(1);
    expect(mienne[0]).toMatchObject({ origine: "publication", titre: "Programmé chez le diffuseur", mediaId: null });
  });

  it("une publication sans source et SANS rapatrieeLe reste ignorée", async () => {
    await depots().publications.enregistrer({ ...rapatriee, id: "x", rapatrieeLe: undefined } as never);
    const jours = await listerCalendrier("2026-11-20T00:00:00.000Z", "2026-11-30T23:59:59.000Z");
    expect(ids(jours)).toEqual([]);
  });

  it("une rapatriée avec retireeLe n'apparaît pas dans la vue par défaut", async () => {
    await depots().publications.enregistrer({ ...rapatriee, retireeLe: "2026-11-21T10:00:00.000Z" } as never);
    const jours = await listerCalendrier("2026-11-20T00:00:00.000Z", "2026-11-30T23:59:59.000Z");
    expect(ids(jours)).toEqual([]);
  });
});
