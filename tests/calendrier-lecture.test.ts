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

  it("publication de visuel (visuelId, sans vidéo) : au bon jour avec video null ; hors plage, absente", async () => {
    const s = plageSemaine("2026-10-25");
    const posteVisuel = (id: string, date: string) =>
      depots().publications.enregistrer({ id, visuelId: "visuel-test", reseau: "tiktok", statut: "programmee", via: "manuel", date, texte: "t", creeLe: date, modifieLe: date } as never);
    await posteVisuel("pv-dedans", "2026-10-21T10:00:00.000Z"); // mercredi 21/10 12:00 Paris
    await posteVisuel("pv-dehors", "2026-10-26T10:00:00.000Z"); // lundi 26/10, semaine suivante
    const jours = await pub.listerCalendrier(s.debutIso, s.finIso);
    const jour = jours.find((j) => j.jour === "2026-10-21");
    expect(jour?.publications.map((p) => p.id)).toEqual(["pv-dedans"]);
    expect(jour?.publications[0].video).toBeNull();
    expect(JSON.stringify(jours)).not.toMatch(/pv-dehors/);
  });

  it("dimanche 23:30 UTC (= lundi 00:30 Paris) : rangé au lundi 2/11, absent de la semaine du 1er", async () => {
    const v = (await depots().videos.lister((x) => x.statut === "prete"))[0];
    await poser("p-bascule", "2026-11-01T23:30:00.000Z", v.id);
    const suivante = await pub.listerCalendrier(plageSemaine("2026-11-02").debutIso, plageSemaine("2026-11-02").finIso);
    expect(suivante.find((j) => j.jour === "2026-11-02")?.publications.map((p) => p.id)).toContain("p-bascule");
    expect(suivante.filter((j) => j.jour !== "2026-11-02").flatMap((j) => j.publications.map((p) => p.id))).not.toContain("p-bascule");
    const precedente = plageSemaine("2026-11-01"); // semaine du lundi 26/10 au dimanche 1/11
    expect(JSON.stringify(await pub.listerCalendrier(precedente.debutIso, precedente.finIso))).not.toMatch(/p-bascule/);
  });

  it("plage vide : liste vide", async () => {
    expect(await pub.listerCalendrier("2030-01-01T00:00:00.000Z", "2030-01-07T23:59:59.999Z")).toEqual([]);
  });
});
