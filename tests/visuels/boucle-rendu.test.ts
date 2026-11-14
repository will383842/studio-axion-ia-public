/** L2-04 : la boucle reprend sans clic un rendu de carrousel périmé ; un rendu récent n'est pas relancé. Aucun appel réel. */
import { describe, expect, it, vi } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import type { StatutVisuel } from "@/domaine/visuels/statuts";
import type { Visuel } from "@/domaine/visuels/visuel";
import { RENDU_PERIME_MS, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { reprendreRendusPerimes } from "@/visuels/services/boucle-rendu";

const DEPART = Date.parse("2026-10-23T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

function monter(maintenantMs = DEPART) {
  const depot = new DepotMemoire<Visuel>();
  const lancer = vi.fn(async () => undefined);
  const deps = { depot, maintenant: () => iso(maintenantMs) } as unknown as DependancesCarrousels;
  return { depot, lancer, deps };
}

async function poser(depot: DepotMemoire<Visuel>, id: string, statut: StatutVisuel, extra: Partial<Visuel> = {}) {
  await depot.enregistrer({
    id, famille: "carrousel", titre: "Titre inventé", entree: { type: "sujet", sujet: "Un sujet" }, statut, modeTexte: "simulation",
    pourquoi: [], versionSpec: 1, coutCentimes: 0, creeLe: iso(DEPART), modifieLe: iso(DEPART), ...extra,
  });
}

describe("reprise des rendus périmés par la boucle", () => {
  it("un visuel périmé depuis plus de 10 minutes est repris sans clic", async () => {
    const b = monter(DEPART + RENDU_PERIME_MS + 1);
    await poser(b.depot, "vis_vieux", "rendu_en_cours", { renduDemandeLe: iso(DEPART) });
    const r = await reprendreRendusPerimes(b.deps, b.lancer);
    expect(b.lancer).toHaveBeenCalledTimes(1);
    expect(b.lancer).toHaveBeenCalledWith("vis_vieux", b.deps);
    expect(r.repris).toEqual(["vis_vieux"]);
  });

  it("un visuel récent n'est pas relancé", async () => {
    const b = monter(DEPART + RENDU_PERIME_MS - 1_000);
    await poser(b.depot, "vis_recent", "rendu_en_cours", { renduDemandeLe: iso(DEPART) });
    await reprendreRendusPerimes(b.deps, b.lancer);
    expect(b.lancer).not.toHaveBeenCalled();
  });

  it("ignore les autres statuts et la corbeille", async () => {
    const b = monter(DEPART + 3 * RENDU_PERIME_MS);
    await poser(b.depot, "vis_valide", "a_valider");
    await poser(b.depot, "vis_corbeille", "rendu_en_cours", { renduDemandeLe: iso(DEPART), corbeilleLe: iso(DEPART) });
    await reprendreRendusPerimes(b.deps, b.lancer);
    expect(b.lancer).not.toHaveBeenCalled();
  });

  it("un échec sur un visuel n'empêche pas de reprendre les suivants", async () => {
    const b = monter(DEPART + 2 * RENDU_PERIME_MS);
    await poser(b.depot, "vis_1", "rendu_en_cours", { renduDemandeLe: iso(DEPART) });
    await poser(b.depot, "vis_2", "rendu_en_cours", { renduDemandeLe: iso(DEPART) });
    b.lancer.mockRejectedValueOnce(new Error("panne inventée"));
    const r = await reprendreRendusPerimes(b.deps, b.lancer);
    expect(b.lancer).toHaveBeenCalledTimes(2);
    expect(r.echecs).toHaveLength(1);
  });
});
