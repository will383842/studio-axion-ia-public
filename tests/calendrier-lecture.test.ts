/** listerCalendrier est testé, pas modifié (D6-02). Base de démonstration, aucun réseau. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./site-videos/helpers";
import { plageSemaine } from "@/lib/calendrier-plages";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const pub = await import("@/services/publications");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(async () => {
  await preparerBase();
  vi.stubGlobal("fetch", async () => {
    throw new Error("réseau interdit");
  });
});
afterEach(() => vi.unstubAllGlobals());

async function poser(id: string, date: string, videoId: string) {
  await depots().publications.enregistrer({ id, videoId, reseau: "tiktok", statut: "programmee", via: "manuel", date, texte: "t", creeLe: date, modifieLe: date } as never);
}

describe("listerCalendrier (lecture)", () => {
  it("range les publications par jour de Paris, bornes de la semaine comprises (passage à l'heure d'hiver)", async () => {
    const v = (await depots().videos.lister((x) => x.statut === "prete"))[0];
    expect(v).toBeTruthy();
    const s = plageSemaine("2026-10-25");
    await poser("p-debut", s.debutIso, v.id); // lundi 00:00 Paris
    await poser("p-nuit", "2026-10-25T01:30:00.000Z", v.id); // dimanche 02:30 Paris (heure d'hiver)
    await poser("p-fin", s.finIso, v.id); // dimanche 23:59 Paris
    await poser("p-avant", "2026-10-18T21:59:59.999Z", v.id); // dimanche précédent 23:59 Paris
    await poser("p-apres", "2026-10-25T23:00:00.000Z", v.id); // lundi 26 00:00 Paris
    const jours = await pub.listerCalendrier(s.debutIso, s.finIso);
    const ids = Object.fromEntries(jours.map((j) => [j.jour, j.publications.map((p) => p.id).sort()]));
    expect(ids["2026-10-19"]).toEqual(["p-debut"]);
    expect(ids["2026-10-25"]).toEqual(["p-fin", "p-nuit"]);
    expect(JSON.stringify(ids)).not.toMatch(/p-avant|p-apres/);
    expect(jours.map((j) => j.jour)).toEqual([...jours.map((j) => j.jour)].sort());
  });

  it("plage vide : liste vide", async () => {
    expect(await pub.listerCalendrier("2030-01-01T00:00:00.000Z", "2030-01-07T23:59:59.999Z")).toEqual([]);
  });
});
